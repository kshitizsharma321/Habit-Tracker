const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const Backup = require('../models/Backup');
const Subscription = require('../models/Subscription');
const { supabase, BACKUP_BUCKET } = require('../lib/supabase');

const router = express.Router();

function escapeCsvCell(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied: Admin only' });
  }
  next();
}

router.use(requireAuth);
router.use(requireAdmin);

// ── Shared CSV parser ─────────────────────────────────────────────────────────
// Parses a backup CSV (or any compatible upload) and restores entries.
// The targetUserId can be provided to scope the restore; otherwise it looks up
// the username in each row.
async function restoreFromCsvText(text, { targetUserId = null, newUserPassword = null } = {}) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { restored: 0, errors: 0, message: 'File is empty or missing header row' };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
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
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
      const habitName = cols[habitIdx];
      const entryDate = cols[dateIdx];
      const rawValue = cols[valueIdx];

      if (!habitName || !entryDate || rawValue === undefined || rawValue === '') { errors++; continue; }

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

      const parsedValue = rawValue !== '' && !isNaN(Number(rawValue)) ? Number(rawValue) : rawValue;

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

      await Habit.findOneAndUpdate(
        { userId, habitId: def._id, date: entryDate },
        { value: parsedValue },
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
    res.status(500).json({ error: 'Failed to fetch stats', message: err.message });
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
    res.status(500).json({ error: 'Failed to fetch users', message: err.message });
  }
});

// ── Get habits for a specific user ───────────────────────────────────────────
router.get('/users/:id/habits', async (req, res) => {
  try {
    const habits = await HabitDefinition.find({ userId: req.params.id }).sort({ order: 1 });
    res.json(habits);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user habits', message: err.message });
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
    res.status(500).json({ error: 'Failed to fetch orphaned backups', message: err.message });
  }
});

// ── Get the single latest backup for a user ──────────────────────────────────
router.get('/users/:id/backup', async (req, res) => {
  try {
    const backup = await Backup.findOne({ userId: req.params.id })
      .select('date habitCount entryCount updatedAt');
    res.json(backup || null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user backup', message: err.message });
  }
});

// ── Download the latest backup — returns a short-lived Supabase signed URL ────
router.get('/users/:id/backup/download', async (req, res) => {
  try {
    const backup = await Backup.findOne({ userId: req.params.id });
    if (!backup) return res.status(404).json({ error: 'Backup not found' });

    const user = await User.findById(req.params.id).select('username email');
    const rawName = user?.username || backup.username || user?.email || 'user';
    const safeName = rawName.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '');
    const filename = `habit-backup_${safeName}_${backup.date}.csv`;

    const { data, error } = await supabase.storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(backup.filePath, 3600, { download: filename });

    if (error) throw error;
    res.json({ signedUrl: data.signedUrl });
  } catch (err) {
    res.status(500).json({ error: 'Download failed', message: err.message });
  }
});

// ── Delete user + cascade all their data ─────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
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
    res.status(500).json({ error: 'Failed to delete user', message: err.message });
  }
});

// ── Toggle admin role ─────────────────────────────────────────────────────────
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    const user = await User.findByIdAndUpdate(id, { isAdmin }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role', message: err.message });
  }
});

// ── Restore from stored backup (fetches CSV from Supabase) ───────────────────
router.post('/restore-from-backup', async (req, res) => {
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

    const { data: blob, error: downloadError } = await supabase.storage
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
    res.status(500).json({ error: 'Restore from backup failed', message: err.message });
  }
});

// ── Generate a fresh backup for a specific user right now ────────────────────
router.post('/users/:id/generate-backup', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const today = new Date();
    const todayIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateKey = `${todayIST.getFullYear()}-${String(todayIST.getMonth() + 1).padStart(2, '0')}-${String(todayIST.getDate()).padStart(2, '0')}`;

    const definitions = await HabitDefinition.find({ userId: user._id }).sort({ order: 1 });
    if (definitions.length === 0) {
      return res.json({ message: 'No habits found — nothing to back up', date: dateKey, habitCount: 0, entryCount: 0 });
    }

    const username = user.username || user.email || String(user._id);
    const rows = [[
      'Username', 'Habit Name', 'Tracking Type', 'Unit', 'Color', 'Icon',
      'Goal Enabled', 'Goal Value', 'Goal Direction', 'Date', 'Value',
    ]];
    let entryCount = 0;

    for (const def of definitions) {
      const entries = await Habit.find({ habitId: def._id, userId: user._id }).sort({ date: 1 });
      for (const e of entries) {
        rows.push([
          escapeCsvCell(username),
          escapeCsvCell(def.name),
          escapeCsvCell(def.trackingType),
          escapeCsvCell(def.unit || ''),
          escapeCsvCell(def.color || ''),
          escapeCsvCell(def.icon || ''),
          escapeCsvCell(def.goal?.enabled ? 'true' : 'false'),
          escapeCsvCell(def.goal?.enabled ? def.goal.value : ''),
          escapeCsvCell(def.goal?.enabled ? (def.goal.direction || 'at_least') : ''),
          e.date,
          escapeCsvCell(String(e.value)),
        ]);
        entryCount++;
      }
    }

    const csv = rows.map((r) => r.join(',')).join('\n');
    const filePath = `${user._id}/latest.csv`;

    const { error: uploadError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(filePath, Buffer.from(csv, 'utf8'), {
        contentType: 'text/csv; charset=utf-8',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    await Backup.findOneAndUpdate(
      { userId: user._id },
      { date: dateKey, username: user.username || '', filePath, habitCount: definitions.length, entryCount },
      { upsert: true, new: true }
    );

    res.json({ message: 'Backup generated', date: dateKey, habitCount: definitions.length, entryCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate backup', message: err.message });
  }
});

// ── Delete a user's backup ───────────────────────────────────────────────────
router.delete('/users/:id/backup', async (req, res) => {
  try {
    const backup = await Backup.findOneAndDelete({ userId: req.params.id });
    if (!backup) return res.status(404).json({ error: 'Backup not found' });
    // Best-effort: delete from Supabase (don't fail the request if this errors)
    await supabase.storage.from(BACKUP_BUCKET).remove([backup.filePath]).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete backup', message: err.message });
  }
});

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
    res.status(500).json({ error: 'Restore failed', message: err.message });
  }
});

module.exports = router;
