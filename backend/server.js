require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const webpush = require('web-push');
const Habit = require('./models/Habit');
const HabitDefinition = require('./models/HabitDefinition');
const Subscription = require('./models/Subscription');
const Backup = require('./models/Backup');
const authRoutes = require('./routes/auth');
const habitDefRoutes = require('./routes/habitDefinitions');
const adminRoutes = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');

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

/**
 * Ensure indexes match current schemas.
 */
async function ensureIndexes() {
  try {
    try { await Habit.collection.dropIndex('date_1'); } catch {}
    try { await Habit.collection.dropIndex('userId_1_date_1'); } catch {}
    try { await Subscription.collection.dropIndex('endpoint_1'); } catch {}

    await Habit.syncIndexes();
    await HabitDefinition.syncIndexes();
    await Subscription.syncIndexes();
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

// ── Daily CSV backup cron (runs at 23:55 IST) ───────────────────────────
// Format: Email, Habit Name, Tracking Type, Unit, Color, Icon, Date, Value
// Enriched format ensures a backup is fully self-contained for admin restore.

cron.schedule('55 18 * * *', async () => {
  try {
    const today = new Date();
    const todayIST = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const dateKey = `${todayIST.getFullYear()}-${String(todayIST.getMonth() + 1).padStart(2, '0')}-${String(todayIST.getDate()).padStart(2, '0')}`;

    const definitions = await HabitDefinition.find({}).populate('userId', 'email');
    let written = 0;

    for (const def of definitions) {
      const entries = await Habit.find({ habitId: def._id, userId: def.userId }).sort({ date: 1 });
      if (entries.length === 0) continue;

      const userEmail = def.userId?.email || '';
      const escapeCsv = (v) => (String(v).includes(',') ? `"${v}"` : String(v));

      const rows = [['Email', 'Habit Name', 'Tracking Type', 'Unit', 'Color', 'Icon', 'Date', 'Value']];
      for (const e of entries) {
        rows.push([
          escapeCsv(userEmail),
          escapeCsv(def.name),
          escapeCsv(def.trackingType),
          escapeCsv(def.unit || ''),
          escapeCsv(def.color || ''),
          escapeCsv(def.icon || ''),
          e.date,
          String(e.value),
        ]);
      }

      const csv = rows.map((r) => r.join(',')).join('\n');

      await Backup.findOneAndUpdate(
        { userId: def.userId._id || def.userId, habitId: def._id, date: dateKey },
        { csvContent: csv },
        { upsert: true, new: true }
      );
      written++;
    }

    if (written > 0) {
      console.log(`📦 Daily CSV backup: ${written} habits written for ${dateKey}`);
    }
  } catch (err) {
    console.error('Backup cron error:', err.message);
  }
});
