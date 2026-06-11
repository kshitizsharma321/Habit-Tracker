const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const Backup = require('../models/Backup');
const Subscription = require('../models/Subscription');

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Access denied: Admin only' });
  }
  next();
}

router.use(requireAuth);
router.use(requireAdmin);

// ── Stats overview ────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [users, habits, entries] = await Promise.all([
      User.countDocuments(),
      HabitDefinition.countDocuments(),
      Habit.countDocuments(),
    ]);
    res.json({ users, habits, entries });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats', message: err.message });
  }
});

// ── List all users ────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', message: err.message });
  }
});

// ── Delete user + cascade all their data ─────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
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

// ── Restore entries from uploaded CSV data ────────────────────────────────────
// Accepts: [{ email, habitName, trackingType?, unit?, color?, icon?, date, value }]
router.post('/restore-data', async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    let restored = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const { email, habitName, trackingType, unit, color, icon, date, value } = row;
        if (!email || !habitName || !date || value === undefined) { errors++; continue; }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) { errors++; continue; }

        // Find or create habit definition by (userId, name)
        let def = await HabitDefinition.findOne({ userId: user._id, name: habitName });
        if (!def) {
          def = await HabitDefinition.create({
            userId: user._id,
            name: habitName,
            trackingType: trackingType || 'completion',
            unit: unit || '',
            color: color || '#22c55e',
            icon: icon || '📌',
          });
        }

        await Habit.findOneAndUpdate(
          { userId: user._id, habitId: def._id, date },
          { value },
          { upsert: true }
        );
        restored++;
      } catch {
        errors++;
      }
    }

    res.json({ restored, errors });
  } catch (err) {
    res.status(500).json({ error: 'Restore failed', message: err.message });
  }
});

// ── List available backup dates ───────────────────────────────────────────────
router.get('/backups', async (req, res) => {
  try {
    const backups = await Backup.aggregate([
      {
        $group: {
          _id: '$date',
          habitCount: { $sum: 1 },
          userIds: { $addToSet: '$userId' },
        },
      },
      {
        $project: {
          date: '$_id',
          habitCount: 1,
          userCount: { $size: '$userIds' },
          _id: 0,
        },
      },
      { $sort: { date: -1 } },
      { $limit: 30 },
    ]);
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list backups', message: err.message });
  }
});

// ── Restore from stored MongoDB backup for a given date ───────────────────────
// Uses userId + habitId already stored in Backup records — no CSV format parsing needed.
router.post('/restore-from-backup', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

    const backupRecords = await Backup.find({ date });
    if (backupRecords.length === 0) {
      return res.status(404).json({ error: `No backups found for ${date}` });
    }

    let restored = 0;
    let errors = 0;

    for (const backup of backupRecords) {
      try {
        const lines = backup.csvContent.split('\n').filter((l) => l.trim());
        if (lines.length < 2) continue;

        // Support both old format (Date,Value,...) and enriched format (Email,Habit Name,...,Date,Value)
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const dateIdx = headers.indexOf('date');
        const valueIdx = headers.indexOf('value');
        if (dateIdx === -1 || valueIdx === -1) continue;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',');
          const entryDate = cols[dateIdx]?.trim();
          const rawValue = cols[valueIdx]?.trim();
          if (!entryDate || rawValue === undefined) { errors++; continue; }

          const parsedValue = (rawValue !== '' && !isNaN(Number(rawValue)))
            ? Number(rawValue)
            : rawValue;

          await Habit.findOneAndUpdate(
            { userId: backup.userId, habitId: backup.habitId, date: entryDate },
            { value: parsedValue },
            { upsert: true }
          );
          restored++;
        }
      } catch {
        errors++;
      }
    }

    res.json({ restored, errors, backupsProcessed: backupRecords.length });
  } catch (err) {
    res.status(500).json({ error: 'Restore from backup failed', message: err.message });
  }
});

module.exports = router;
