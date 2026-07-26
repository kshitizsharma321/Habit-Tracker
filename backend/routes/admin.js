const express = require('express');
const { requireAuth, signImpersonationToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId');
const User = require('../models/User');
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const Backup = require('../models/Backup');
const Subscription = require('../models/Subscription');
const { getSupabase, BACKUP_BUCKET } = require('../lib/supabase');
const { parseCsvLine, buildUserBackupCsv } = require('../lib/csv');
const { getISTDateKey, isValidDateKey } = require('../lib/dates');
const { normalizeEntryValue } = require('../lib/validate');
const { sendError } = require('../lib/errors');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied: Admin only' });
  }
  next();
}

// Backups are an optional feature — routes that need Supabase answer 503 when unconfigured.
function requireSupabase(req, res, next) {
  if (!getSupabase()) {
    return res.status(503).json({ error: 'Backups are not configured on this server (missing Supabase env vars)' });
  }
  next();
}

router.use(requireAuth);
router.use(requireAdmin);

// ── Shared CSV restore ────────────────────────────────────────────────────────
// Parses a backup CSV (quote-aware — habit names may contain commas) and restores
// entries. targetUserId scopes the restore; otherwise each row's username is looked
// up, optionally recreating deleted accounts when newUserPassword is provided.
// Every value/date passes the same validation as the live entry routes.
async function restoreFromCsvText(text, { targetUserId = null, newUserPassword = null } = {}) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { restored: 0, errors: 0, message: 'File is empty or missing header row' };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name) => headers.indexOf(name);

  const usernameIdx = idx('username');
  const habitIdx = idx('habit name');
  const typeIdx = idx('tracking type');
  const unitIdx = idx('unit');
  const colorIdx = idx('color');
  const iconIdx = idx('icon');
  const goalEnabledIdx = idx('goal enabled');
  const goalValueIdx = idx('goal value');
  const goalDirectionIdx = idx('goal direction');
  const dateIdx = idx('date');
  const valueIdx = idx('value');

  if (habitIdx === -1 || dateIdx === -1 || valueIdx === -1) {
    return { restored: 0, errors: 0, message: 'Missing required columns: Habit Name, Date, Value' };
  }

  const userCache = {};
  const recreatedUsers = new Set();
  let restored = 0;
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCsvLine(lines[i]);
      const habitName = cols[habitIdx];
      const entryDate = cols[dateIdx];
      const rawValue = cols[valueIdx];

      if (!habitName || !entryDate || rawValue === undefined || rawValue === '') { errors++; continue; }
      if (!isValidDateKey(entryDate) || entryDate > getISTDateKey()) { errors++; continue; }

      let userId = targetUserId;
      if (!userId && usernameIdx >= 0) {
        const uname = cols[usernameIdx].replace(/^@/, '').toLowerCase();
        if (!userCache[uname]) {
          let found = await User.findOne({ username: uname });
          if (!found && newUserPassword) {
            // Recreate a deleted account so its backup can be fully restored.
            found = await User.create({ username: uname, password: newUserPassword, onboardingComplete: true });
            recreatedUsers.add(uname);
          }
          if (!found) { errors++; continue; }
          userCache[uname] = found._id;
        }
        userId = userCache[uname];
      }
      if (!userId) { errors++; continue; }

      let def = await HabitDefinition.findOne({ userId, name: habitName });
      if (!def) {
        def = await HabitDefinition.create({
          userId,
          name: habitName,
          trackingType: (typeIdx >= 0 ? cols[typeIdx] : '') || 'completion',
          unit: unitIdx >= 0 ? cols[unitIdx] || '' : '',
          color: colorIdx >= 0 ? cols[colorIdx] || '#22c55e' : '#22c55e',
          icon: iconIdx >= 0 ? cols[iconIdx] || '⭐' : '⭐',
          goal: {
            enabled: goalEnabledIdx >= 0 ? cols[goalEnabledIdx] === 'true' : false,
            value: goalValueIdx >= 0 ? parseFloat(cols[goalValueIdx]) || 1 : 1,
            direction: goalDirectionIdx >= 0 && cols[goalDirectionIdx] === 'at_most' ? 'at_most' : 'at_least',
          },
        });
      }

      const parsedValue = rawValue !== '' && !isNaN(Number(rawValue)) ? Number(rawValue) : rawValue;
      const normalized = normalizeEntryValue(def.trackingType, parsedValue);
      if (!normalized.ok) { errors++; continue; }

      await Habit.findOneAndUpdate(
        { userId, habitId: def._id, date: entryDate },
        { value: normalized.value },
        { upsert: true }
      );
      restored++;
    } catch {
      errors++;
    }
  }

  return { restored, errors, recreated: recreatedUsers.size };
}

// ── Stats overview (excludes admin accounts) ──────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const adminIds = await User.find({ isAdmin: true }).distinct('_id');
    const [users, habits, entries] = await Promise.all([
      User.countDocuments({ isAdmin: { $ne: true } }),
      HabitDefinition.countDocuments({ userId: { $nin: adminIds } }),
      Habit.countDocuments({ userId: { $nin: adminIds } }),
    ]);
    res.json({ users, habits, entries });
  } catch (err) {
    sendError(res, 500, 'Failed to fetch stats', err);
  }
});

// ── List all non-admin users ──────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ isAdmin: { $ne: true } })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    sendError(res, 500, 'Failed to fetch users', err);
  }
});

// ── Get habits for a specific user ───────────────────────────────────────────
router.get('/users/:id/habits', validateObjectId(), async (req, res) => {
  try {
    const habits = await HabitDefinition.find({ userId: req.params.id }).sort({ order: 1 });
    res.json(habits);
  } catch (err) {
    sendError(res, 500, 'Failed to fetch user habits', err);
  }
});

// ── Orphaned backups — backups whose user no longer exists (deleted accounts) ─
router.get('/orphaned-backups', async (req, res) => {
  try {
    const backups = await Backup.find({})
      .select('userId username date habitCount entryCount updatedAt')
      .sort({ updatedAt: -1 });
    const ids = backups.map((b) => b.userId);
    const existing = new Set(
      (await User.find({ _id: { $in: ids } }).select('_id')).map((u) => String(u._id)),
    );
    const orphaned = backups.filter((b) => !existing.has(String(b.userId)));
    res.json(orphaned);
  } catch (err) {
    sendError(res, 500, 'Failed to fetch orphaned backups', err);
  }
});

// ── Get the single latest backup for a user ──────────────────────────────────
router.get('/users/:id/backup', validateObjectId(), async (req, res) => {
  try {
    const backup = await Backup.findOne({ userId: req.params.id })
      .select('date habitCount entryCount updatedAt');
    res.json(backup || null);
  } catch (err) {
    sendError(res, 500, 'Failed to fetch user backup', err);
  }
});

// ── Download the latest backup — returns a short-lived Supabase signed URL ────
router.get('/users/:id/backup/download', validateObjectId(), requireSupabase, async (req, res) => {
  try {
    const backup = await Backup.findOne({ userId: req.params.id });
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    const user = await User.findById(req.params.id).select('username email');
    const rawName = user?.username || backup.username || user?.email || 'user';
    const safeName = rawName.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
    const filename = `habit-backup_${safeName}_${backup.date}.csv`;

    const { data, error } = await getSupabase().storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(backup.filePath, 3600, { download: filename });

    if (error) throw error;
    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    sendError(res, 500, 'Download failed', err);
  }
});

// ── Delete user + cascade all their data ─────────────────────────────────────
router.delete('/users/:id', validateObjectId(), async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.isAdmin) return res.status(400).json({ error: 'Cannot delete another admin account' });

    // The user's Backup (Mongo doc + Supabase CSV) is intentionally PRESERVED so the
    // account can be recovered later from "Orphaned backups". Only live data is removed.
    await Promise.all([
      User.findByIdAndDelete(id),
      HabitDefinition.deleteMany({ userId: id }),
      Habit.deleteMany({ userId: id }),
      Subscription.deleteMany({ userId: id }),
    ]);

    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'Failed to delete user', err);
  }
});

// ── Reset a user's password (F1a) ─────────────────────────────────────────────
// Sets a temp password + mustChangePassword; the user is forced to pick a new
// password on next login. Works for locked-out username-only accounts.
router.post('/users/:id/reset-password', validateObjectId(), async (req, res) => {
  try {
    const { tempPassword } = req.body;
    if (!tempPassword || String(tempPassword).length < 6) {
      return res.status(400).json({ error: 'Temp password must be at least 6 characters' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.isAdmin) return res.status(400).json({ error: "Cannot reset another admin's password" });

    target.password = String(tempPassword);
    target.mustChangePassword = true;
    await target.save();
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'Failed to reset password', err);
  }
});

// ── Impersonate a user (F1b) ──────────────────────────────────────────────────
// Returns a short-lived (1h) token for the target user with an `imp` claim.
// Password change + account deletion are blocked while impersonating.
router.post('/users/:id/impersonate', validateObjectId(), async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.isAdmin) return res.status(400).json({ error: 'Cannot impersonate another admin' });

    console.log(`👁 Impersonation: admin @${req.user.username} → @${target.username} (${new Date().toISOString()})`);
    res.json({ token: signImpersonationToken(target._id, req.user._id), username: target.username });
  } catch (err) {
    sendError(res, 500, 'Failed to impersonate user', err);
  }
});

// ── Toggle admin role ─────────────────────────────────────────────────────────
router.put('/users/:id/role', validateObjectId(), async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    const user = await User.findByIdAndUpdate(id, { isAdmin: !!isAdmin }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    sendError(res, 500, 'Failed to update role', err);
  }
});

// ── Restore from stored backup (fetches CSV from Supabase) ───────────────────
router.post('/restore-from-backup', requireSupabase, async (req, res) => {
  try {
    const { userId, newUserPassword } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const backup = await Backup.findOne({ userId });
    if (!backup) {
      return res.status(404).json({ error: 'No backup found for this user' });
    }

    const userExists = await User.exists({ _id: userId });
    if (!userExists && !newUserPassword) {
      return res.status(400).json({ error: 'This account was deleted — provide a password to recreate it from the backup.' });
    }
    if (newUserPassword && String(newUserPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data: blob, error: downloadError } = await getSupabase().storage
      .from(BACKUP_BUCKET)
      .download(backup.filePath);

    if (downloadError) throw downloadError;

    const arrayBuffer = await blob.arrayBuffer();
    const text = Buffer.from(arrayBuffer).toString('utf8');

    // User still here → restore in place; deleted → recreate from the CSV's username.
    const result = await restoreFromCsvText(
      text,
      userExists ? { targetUserId: userId } : { newUserPassword },
    );
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'Restore from backup failed', err);
  }
});

// ── Generate a fresh backup for a specific user right now ────────────────────
router.post('/users/:id/generate-backup', validateObjectId(), requireSupabase, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dateKey = getISTDateKey();
    const built = await buildUserBackupCsv(user._id);
    if (!built) {
      return res.json({ message: 'No habits or entries found — nothing to back up', date: dateKey, habitCount: 0, entryCount: 0 });
    }

    const filePath = `${user._id}/latest.csv`;
    const { error: uploadError } = await getSupabase().storage
      .from(BACKUP_BUCKET)
      .upload(filePath, Buffer.from(built.csv, 'utf8'), {
        contentType: 'text/csv; charset=utf-8',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    await Backup.findOneAndUpdate(
      { userId: user._id },
      { date: dateKey, username: user.username || '', filePath, habitCount: built.habitCount, entryCount: built.entryCount },
      { upsert: true, new: true }
    );

    res.json({ message: 'Backup generated', date: dateKey, habitCount: built.habitCount, entryCount: built.entryCount });
  } catch (err) {
    sendError(res, 500, 'Failed to generate backup', err);
  }
});

// NOTE: There is deliberately NO delete-backup endpoint. Backups are the last
// line of defense — deleting an orphaned backup would permanently destroy a
// deleted account's only remaining data. Cleanup, if ever needed, is a manual
// operation in the Supabase dashboard. (Decision: July 2026, audit F13.)

// ── Restore from uploaded CSV (same format as backup) ────────────────────────
// Accepts JSON-wrapped raw CSV text in the same format the backup cron generates.
router.post('/restore-from-csv', async (req, res) => {
  try {
    const { csvText, newUserPassword } = req.body;
    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ error: 'csvText (string) is required in the request body' });
    }
    if (newUserPassword && String(newUserPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const result = await restoreFromCsvText(csvText, { newUserPassword: newUserPassword || null });
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'Restore failed', err);
  }
});

module.exports = router;
