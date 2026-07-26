const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Habit = require('../models/Habit');
const HabitDefinition = require('../models/HabitDefinition');
const Subscription = require('../models/Subscription');
const PasswordReset = require('../models/PasswordReset');
const { signToken, requireAuth } = require('../middleware/auth');
const { buildUserBackupCsv } = require('../lib/csv');
const { getISTDateKey } = require('../lib/dates');
const config = require('../lib/config');
const { sendError } = require('../lib/errors');
const { isEmailConfigured, sendPasswordResetEmail, sendGoogleAccountNotice } = require('../lib/email');

const router = express.Router();

// Brute-force / enumeration protection on the unauthenticated endpoints.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again in a few minutes' },
});
const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down a little' },
});
// Stricter than credentialLimiter — each forgot-password hit can send an email.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests — please try again in a few minutes' },
});

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

function validateEmail(email) {
  return email?.toLowerCase().trim();
}

function validatePassword(password) {
  if (!password || password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
}

function validateUsername(username) {
  if (!username) return 'Username is required';
  const clean = username.toLowerCase().trim();
  if (clean.length < 3) return 'Username must be at least 3 characters';
  if (clean.length > 30) return 'Username must be at most 30 characters';
  if (!/^[a-z0-9_]+$/.test(clean)) return 'Username can only contain lowercase letters, numbers, and underscores';
  return null;
}

async function generateUniqueUsername(base) {
  const sanitized = (base || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 28);
  const seed = sanitized.length >= 3 ? sanitized : sanitized.padEnd(3, '0');
  let candidate = seed;
  let n = 0;
  while (await User.findOne({ username: candidate })) {
    n++;
    candidate = `${seed.slice(0, 27)}${n}`;
  }
  return candidate;
}

router.post('/register', credentialLimiter, async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    if ((username && typeof username !== 'string') || (password && typeof password !== 'string')) {
      return res.status(400).json({ error: 'Username and password must be strings' });
    }

    const usernameError = validateUsername(username);
    if (usernameError) return res.status(400).json({ error: usernameError });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const cleanUsername = username.toLowerCase().trim();
    const existingByUsername = await User.findOne({ username: cleanUsername });
    if (existingByUsername) return res.status(409).json({ error: 'Username already taken' });

    // Email is optional — username is the universal identifier. No placeholder emails.
    let normalizedEmail;
    if (email) {
      normalizedEmail = validateEmail(email);
      const existingByEmail = await User.findOne({ email: normalizedEmail });
      if (existingByEmail) return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = await User.create({ username: cleanUsername, email: normalizedEmail, password, name: name || '' });
    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (error) {
    sendError(res, 500, 'Registration failed', error);
  }
});

router.post('/login', credentialLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanInput = username.toLowerCase().trim();
    // Support login by username OR email (backward compat for existing sessions)
    const user = await User.findOne({ $or: [{ username: cleanInput }, { email: cleanInput }] });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    if (!user.password) {
      return res.status(401).json({
        error: 'This account uses Google Sign-In. Please sign in with Google.',
      });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (error) {
    sendError(res, 500, 'Login failed', error);
  }
});

router.post('/google', credentialLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }
    if (!googleClient) {
      return res.status(503).json({ error: 'Google Sign-In is not configured on the server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const username = await generateUniqueUsername(name || email.split('@')[0]);
      // No password — Google is the only credential. login()'s "use Google
      // Sign-In" branch relies on password being absent.
      user = await User.create({
        username,
        email,
        name: name || '',
        googleId,
      });
    } else {
      let changed = false;
      if (!user.googleId) { user.googleId = googleId; changed = true; }
      if (!user.name && name) { user.name = name; changed = true; }
      if (!user.username) {
        user.username = await generateUniqueUsername(name || email.split('@')[0]);
        changed = true;
      }
      if (changed) await user.save();
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (error) {
    sendError(res, 500, 'Google sign-in failed', error);
  }
});

// ── Self-serve password reset (F1c) ─────────────────────────────────────
// Anti-enumeration: this route ALWAYS answers the same 200, whether the
// account exists, has an email, or the send fails — the response must never
// reveal whether an account exists.
const RESET_OK = {
  success: true,
  message: 'If that account has an email on file, a reset link is on its way.',
};

router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail || typeof usernameOrEmail !== 'string') {
      return res.status(400).json({ error: 'Username or email is required' });
    }
    if (!isEmailConfigured()) {
      // Same generic body — a probe can't tell "no mailer" from "no account".
      console.warn('forgot-password requested but email env (GMAIL_USER + GMAIL_APP_PASSWORD) is not set');
      return res.json(RESET_OK);
    }

    const cleanInput = usernameOrEmail.toLowerCase().trim();
    const user = await User.findOne({ $or: [{ username: cleanInput }, { email: cleanInput }] });
    if (!user || !user.email) return res.json(RESET_OK);

    if (!user.password) {
      // Google-only account — nothing to reset; tell the owner privately by mail.
      await sendGoogleAccountNotice({ to: user.email, username: user.username });
      return res.json(RESET_OK);
    }

    // One active link per account; the raw token lives only in the email.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await PasswordReset.deleteMany({ userId: user._id });
    await PasswordReset.create({
      userId: user._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    // config.FRONTEND_URL is the canonical origin — already validated at boot,
    // and guaranteed non-localhost in production (the server refuses to start
    // otherwise), so a reset link can never point at localhost from prod.
    await sendPasswordResetEmail({
      to: user.email,
      username: user.username,
      resetUrl: `${config.FRONTEND_URL}/reset-password?token=${rawToken}`,
    });

    res.json(RESET_OK);
  } catch (error) {
    // Send failures included — never turn them into a distinguishable response.
    console.error('forgot-password error:', error.message);
    res.json(RESET_OK);
  }
});

router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const reset = await PasswordReset.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
    if (!reset) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired — request a new one' });
    }

    const user = await User.findById(reset.userId);
    if (!user) {
      await PasswordReset.deleteOne({ _id: reset._id });
      return res.status(400).json({ error: 'This reset link is invalid or has expired — request a new one' });
    }

    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();
    // Single-use: burn every outstanding link for this account.
    await PasswordReset.deleteMany({ userId: user._id });

    res.json({ success: true, message: 'Password updated — you can sign in now' });
  } catch (error) {
    sendError(res, 500, 'Password reset failed', error);
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.get('/check-username', lookupLimiter, async (req, res) => {
  const { u } = req.query;
  if (!u || typeof u !== 'string') return res.status(400).json({ error: 'Username query param required' });
  const clean = u.toLowerCase().trim();
  const validationError = validateUsername(clean);
  if (validationError) return res.json({ available: false, error: validationError });
  const existing = await User.findOne({ username: clean });
  res.json({ available: !existing });
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { email, name, username } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name.trim();

    if (username !== undefined) {
      const newUsername = username.toLowerCase().trim();
      const usernameError = validateUsername(newUsername);
      if (usernameError) return res.status(400).json({ error: usernameError });
      const conflict = await User.findOne({ username: newUsername, _id: { $ne: req.user._id } });
      if (conflict) return res.status(409).json({ error: 'Username already taken' });
      updates.username = newUsername;
    }

    if (email !== undefined) {
      // Empty string → null (clears the email); never store "" which breaks sparse-unique
      const newEmail = email.trim() ? validateEmail(email) : null;
      if (newEmail) {
        const existing = await User.findOne({ email: newEmail, _id: { $ne: req.user._id } });
        if (existing) return res.status(409).json({ error: 'Email already in use' });
      }
      updates.email = newEmail;
    }
    if (req.body.onboardingComplete !== undefined) {
      updates.onboardingComplete = req.body.onboardingComplete;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user });
  } catch (error) {
    sendError(res, 500, 'Failed to update profile', error);
  }
});

router.put('/password', requireAuth, async (req, res) => {
  try {
    if (req.impersonatorId) {
      return res.status(403).json({ error: 'Password cannot be changed while impersonating a user' });
    }

    const { currentPassword, newPassword } = req.body;
    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

    // Admin reset sets mustChangePassword — the user proves identity with the
    // temp password at login, so the forced change skips the currentPassword check.
    if (req.user.mustChangePassword) {
      req.user.password = newPassword;
      req.user.mustChangePassword = false;
      await req.user.save();
      return res.json({ success: true, message: 'Password updated successfully' });
    }

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (!req.user.password) {
      return res.status(400).json({ error: 'Google accounts cannot change password here' });
    }

    const valid = await req.user.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    req.user.password = newPassword;
    await req.user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    sendError(res, 500, 'Failed to change password', error);
  }
});

// ── Self-serve data export — the user's full backup CSV ─────────────────
router.get('/export', requireAuth, async (req, res) => {
  try {
    const built = await buildUserBackupCsv(req.user._id);
    if (!built) {
      return res.json({ csv: null, message: 'No habit data to export yet — log a few entries first.' });
    }
    const safeName = (req.user.username || 'user').replace(/[^a-zA-Z0-9-_]+/g, '_');
    res.json({
      csv: built.csv,
      filename: `habit-data_${safeName}_${getISTDateKey()}.csv`,
      habitCount: built.habitCount,
      entryCount: built.entryCount,
    });
  } catch (error) {
    sendError(res, 500, 'Export failed', error);
  }
});

router.delete('/account', requireAuth, async (req, res) => {
  try {
    if (req.impersonatorId) {
      return res.status(403).json({ error: 'Accounts cannot be deleted while impersonating a user' });
    }
    const userId = req.user._id;
    const [habitDefs, habits, subs] = await Promise.all([
      HabitDefinition.find({ userId }).select('_id'),
      Habit.countDocuments({ userId }),
      Subscription.countDocuments({ userId }),
    ]);

    await Promise.all([
      Habit.deleteMany({ userId }),
      HabitDefinition.deleteMany({ userId }),
      Subscription.deleteMany({ userId }),
      User.deleteOne({ _id: userId }),
    ]);

    res.json({
      success: true,
      deleted: { habits: habits, definitions: habitDefs.length, subscriptions: subs },
    });
  } catch (error) {
    sendError(res, 500, 'Failed to delete account', error);
  }
});

module.exports = router;
