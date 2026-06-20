const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Habit = require('../models/Habit');
const HabitDefinition = require('../models/HabitDefinition');
const Subscription = require('../models/Subscription');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

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

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;

    const usernameError = validateUsername(username);
    if (usernameError) return res.status(400).json({ error: usernameError });

    const pwError = validatePassword(password);
    if (pwError) return res.status(400).json({ error: pwError });

    const cleanUsername = username.toLowerCase().trim();
    const existingByUsername = await User.findOne({ username: cleanUsername });
    if (existingByUsername) return res.status(409).json({ error: 'Username already taken' });

    // Email: required for account recovery; auto-generate placeholder if omitted
    const normalizedEmail = email ? validateEmail(email) : `${cleanUsername}@placeholder.local`;
    if (email) {
      const existingByEmail = await User.findOne({ email: normalizedEmail });
      if (existingByEmail) return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = await User.create({ username: cleanUsername, email: normalizedEmail, password, name: name || '' });
    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
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
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

router.post('/google', async (req, res) => {
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
      user = await User.create({
        username,
        email,
        name: name || '',
        googleId,
        password: Math.random().toString(36).slice(2),
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
    res.status(500).json({ error: 'Google sign-in failed', message: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.get('/check-username', async (req, res) => {
  const { u } = req.query;
  if (!u) return res.status(400).json({ error: 'Username query param required' });
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
    res.status(500).json({ error: 'Failed to update profile', message: error.message });
  }
});

router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const pwError = validatePassword(newPassword);
    if (pwError) return res.status(400).json({ error: pwError });

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
    res.status(500).json({ error: 'Failed to change password', message: error.message });
  }
});

router.delete('/account', requireAuth, async (req, res) => {
  try {
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
    res.status(500).json({ error: 'Failed to delete account', message: error.message });
  }
});

module.exports = router;
