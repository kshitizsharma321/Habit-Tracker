require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const webpush = require('web-push');
const User = require('./models/User');
const Habit = require('./models/Habit');
const HabitDefinition = require('./models/HabitDefinition');
const Subscription = require('./models/Subscription');
const Backup = require('./models/Backup');
const authRoutes = require('./routes/auth');
const habitDefRoutes = require('./routes/habitDefinitions');
const adminRoutes = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');
const { supabase, BACKUP_BUCKET } = require('./lib/supabase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

// VAPID setup
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:reminder@habit-tracker.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('✅ Connected to MongoDB');
  await ensureIndexes();
})
.catch((err) => console.error('❌ MongoDB connection error:', err));

async function ensureIndexes() {
  try {
    try { await Habit.collection.dropIndex('date_1'); } catch {}
    try { await Habit.collection.dropIndex('userId_1_date_1'); } catch {}
    try { await Subscription.collection.dropIndex('endpoint_1'); } catch {}

    // Migrate Backup collection from old per-habit schema to new per-user schema.
    // Drop the old compound index and remove legacy documents that had a habitId field.
    try { await Backup.collection.dropIndex('userId_1_habitId_1_date_1'); } catch {}
    try { await Backup.collection.deleteMany({ habitId: { $exists: true } }); } catch {}

    // Migrate old fileData (Buffer) backups to new filePath (Supabase) schema.
    // These documents cannot be restored without re-uploading to Supabase — just delete them.
    // The cron or admin "Generate Now" will recreate them in the new format.
    try { await Backup.collection.deleteMany({ fileData: { $exists: true } }); } catch {}

    // Normalize any isAdmin values stored as strings (e.g. "true") to proper booleans.
    // This can happen if the field was set manually via Atlas or a shell command.
    try { await User.collection.updateMany({ isAdmin: 'true' }, { $set: { isAdmin: true } }); } catch {}
    try { await User.collection.updateMany({ isAdmin: 'false' }, { $set: { isAdmin: false } }); } catch {}
    try { await User.collection.updateMany({ isAdmin: 1 }, { $set: { isAdmin: true } }); } catch {}
    try { await User.collection.updateMany({ isAdmin: 0 }, { $set: { isAdmin: false } }); } catch {}

    await Habit.syncIndexes();
    await HabitDefinition.syncIndexes();
    await Subscription.syncIndexes();
    await Backup.syncIndexes();
  } catch (err) {
    console.error('Index sync error:', err.message);
  }
}



// Auth routes (public)
app.use('/api/auth', authRoutes);

// Admin routes (protected)
app.use('/api/admin', adminRoutes);

// Habit Definitions CRUD + entry routes
app.use('/api/habit-definitions', habitDefRoutes);



// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ── Push notification subscriptions (protected) ─────────────────────────

app.post('/api/subscriptions', requireAuth, async (req, res) => {
  try {
    const { subscription, reminderTime } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await Subscription.deleteMany({ endpoint: subscription.endpoint, userId: { $ne: req.user._id } });
    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        userId: req.user._id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        reminderTime: reminderTime ?? '21:00',
      },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save subscription', message: error.message });
  }
});

app.delete('/api/subscriptions', requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
    await Subscription.findOneAndDelete({ endpoint });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove subscription', message: error.message });
  }
});

// ── Daily reminder cron job ────────────────────────────────────────────

async function sendPush(sub, payload) {
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    payload
  );
}

app.post('/api/test-push', requireAuth, async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'VAPID keys not configured on the backend' });
  }
  const { endpoint } = req.body ?? {};
  let subs;
  if (endpoint) {
    const sub = await Subscription.findOne({ endpoint }).catch(() => null);
    if (!sub) {
      return res.json({ sent: 0, message: 'Your browser subscription was not found on the server — disable and re-enable reminders to register it' });
    }
    if (String(sub.userId) !== String(req.user._id)) {
      sub.userId = req.user._id;
      await sub.save();
    }
    subs = [sub];
  } else {
    subs = await Subscription.find({ userId: req.user._id }).catch(() => []);
    if (subs.length === 0) {
      return res.json({ sent: 0, message: 'No subscriptions found — enable reminders in the app first' });
    }
  }
  const payload = JSON.stringify({
    title: '✅ Test Notification',
    body: 'Push notifications are working! 🎉',
  });
  let sent = 0;
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await sendPush(sub, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await Subscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
  res.json({ sent, total: subs.length });
});

cron.schedule('* * * * *', async () => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentTime = `${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}`;

  const subs = await Subscription.find({ reminderTime: currentTime }).catch(() => []);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: '⏰ Habit Reminder',
    body: "Don't forget to log your habit today! 🌿",
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await sendPush(sub, payload);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await Subscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// ── Daily backup cron (runs at 23:55 IST) ────────────────────────────────────
// One CSV file per user covering ALL their habits and ALL entries.
// Stored as a binary Buffer in MongoDB so admin can download → re-upload to restore.
//
// CSV columns: Username, Habit Name, Tracking Type, Unit, Color, Icon,
//              Goal Enabled, Goal Value, Date, Value

function escapeCsvCell(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

cron.schedule('55 18 * * *', async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Backup cron skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }
  try {
    const today = new Date();
    const todayIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateKey = `${todayIST.getFullYear()}-${String(todayIST.getMonth() + 1).padStart(2, '0')}-${String(todayIST.getDate()).padStart(2, '0')}`;

    const users = await User.find({ isAdmin: { $ne: true } });
    let written = 0;

    for (const user of users) {
      const definitions = await HabitDefinition.find({ userId: user._id }).sort({ order: 1 });
      if (definitions.length === 0) continue;

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

      if (entryCount === 0) continue;

      const csv = rows.map((r) => r.join(',')).join('\n');
      const filePath = `${user._id}/latest.csv`;

      const { error: uploadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(filePath, Buffer.from(csv, 'utf8'), {
          contentType: 'text/csv; charset=utf-8',
          upsert: true,
        });

      if (uploadError) {
        console.error(`Backup upload failed for ${username}:`, uploadError.message);
        continue;
      }

      await Backup.findOneAndUpdate(
        { userId: user._id },
        { date: dateKey, username: user.username || '', filePath, habitCount: definitions.length, entryCount },
        { upsert: true, new: true }
      );
      written++;
    }

    if (written > 0) {
      console.log(`📦 Daily backup: ${written} user file(s) uploaded to Supabase for ${dateKey}`);
    }
  } catch (err) {
    console.error('Backup cron error:', err.message);
  }
});
