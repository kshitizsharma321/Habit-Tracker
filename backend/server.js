require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
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
const insightsRoutes = require('./routes/insights');
const { requireAuth } = require('./middleware/auth');
const config = require('./lib/config');
const { sendError } = require('./lib/errors');
const { getSupabase, BACKUP_BUCKET } = require('./lib/supabase');
const { buildUserBackupCsv } = require('./lib/csv');
const { getISTDateKey } = require('./lib/dates');

const app = express();
const PORT = process.env.PORT || 3000;

// Behind Render's proxy — needed for express-rate-limit to see real client IPs.
app.set('trust proxy', 1);

// Origins come from lib/config.js, which refuses to start in production when
// FRONTEND_URL is unset rather than silently allowing only localhost.
app.use(helmet());
app.use(cors({ origin: config.FRONTEND_URLS }));
app.use(express.json({ limit: '1mb' }));

// VAPID setup
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:reminder@habit-tracker.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function ensureIndexes() {
  try {
    try { await Habit.collection.dropIndex('date_1'); } catch {}
    try { await Habit.collection.dropIndex('userId_1_date_1'); } catch {}
    try { await Subscription.collection.dropIndex('endpoint_1'); } catch {}

    // Migrate Backup collection from old per-habit schema to new per-user schema.
    try { await Backup.collection.dropIndex('userId_1_habitId_1_date_1'); } catch {}
    try { await Backup.collection.deleteMany({ habitId: { $exists: true } }); } catch {}

    // Old fileData (Buffer) backups can't be restored without re-uploading — remove them.
    try { await Backup.collection.deleteMany({ fileData: { $exists: true } }); } catch {}

    // Normalize any isAdmin values stored as strings/numbers (manual Atlas edits).
    try { await User.collection.updateMany({ isAdmin: 'true' }, { $set: { isAdmin: true } }); } catch {}
    try { await User.collection.updateMany({ isAdmin: 'false' }, { $set: { isAdmin: false } }); } catch {}
    try { await User.collection.updateMany({ isAdmin: 1 }, { $set: { isAdmin: true } }); } catch {}
    try { await User.collection.updateMany({ isAdmin: 0 }, { $set: { isAdmin: false } }); } catch {}

    // Google-only accounts keep no password credential (audit B18).
    try { await User.collection.updateMany({ googleId: { $ne: null } }, { $unset: { password: '' } }); } catch {}

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

// AI insights (protected; answers { text: null } when unconfigured)
app.use('/api/insights', insightsRoutes);

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ── Push notification subscriptions (protected) ─────────────────────────

const REMINDER_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

app.post('/api/subscriptions', requireAuth, async (req, res) => {
  try {
    const { subscription, reminderTime } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    if (reminderTime !== undefined && !REMINDER_TIME_RE.test(reminderTime)) {
      return res.status(400).json({ error: 'reminderTime must be HH:MM (24h)' });
    }
    // A browser endpoint belongs to whoever is logged in on that browser —
    // reassigning here (on an authenticated save) is the one legitimate takeover path.
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
    sendError(res, 500, 'Failed to save subscription', error);
  }
});

app.delete('/api/subscriptions', requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
    // Scoped to the caller — one user must not be able to remove another's subscription.
    await Subscription.findOneAndDelete({ endpoint, userId: req.user._id });
    res.json({ success: true });
  } catch (error) {
    sendError(res, 500, 'Failed to remove subscription', error);
  }
});

// ── Push helpers + test endpoint ───────────────────────────────────────

async function sendPush(sub, payload) {
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    payload
  );
}

app.post('/api/test-push', requireAuth, async (req, res) => {
  try {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return res.status(503).json({ error: 'VAPID keys not configured on the backend' });
    }
    const { endpoint } = req.body ?? {};
    // Only the caller's own subscriptions — never look up (or claim) other users'.
    const filter = endpoint
      ? { endpoint, userId: req.user._id }
      : { userId: req.user._id };
    const subs = await Subscription.find(filter);
    if (subs.length === 0) {
      return res.json({ sent: 0, message: 'No subscription found on the server — disable and re-enable reminders to register it' });
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
  } catch (error) {
    sendError(res, 500, 'Test push failed', error);
  }
});

// ── JSON 404 + central error handler ───────────────────────────────────
// Without these, unknown /api paths return HTML that breaks the client's JSON parsing.

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Daily reminder cron job (smart) ────────────────────────────────────
// Skips users who already logged everything today, and names the habits
// still pending so the push is worth tapping.

cron.schedule('* * * * *', async () => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const currentTime = `${String(nowIST.getHours()).padStart(2, '0')}:${String(nowIST.getMinutes()).padStart(2, '0')}`;

  const subs = await Subscription.find({ reminderTime: currentTime }).catch(() => []);
  if (subs.length === 0) return;

  try {
    const userIds = [...new Set(subs.map((s) => String(s.userId)))];
    const todayKey = getISTDateKey();
    const [defs, todaysEntries] = await Promise.all([
      HabitDefinition.find({ userId: { $in: userIds }, archived: { $ne: true } }).select('userId name order').sort({ order: 1 }).lean(),
      Habit.find({ userId: { $in: userIds }, date: todayKey }).select('userId habitId').lean(),
    ]);

    const defsByUser = new Map();
    for (const d of defs) {
      const uid = String(d.userId);
      if (!defsByUser.has(uid)) defsByUser.set(uid, []);
      defsByUser.get(uid).push(d);
    }
    const loggedByUser = new Map();
    for (const e of todaysEntries) {
      const uid = String(e.userId);
      if (!loggedByUser.has(uid)) loggedByUser.set(uid, new Set());
      loggedByUser.get(uid).add(String(e.habitId));
    }

    const payloadByUser = new Map();
    for (const uid of userIds) {
      const userDefs = defsByUser.get(uid) ?? [];
      if (userDefs.length === 0) continue; // nothing to remind about
      const logged = loggedByUser.get(uid) ?? new Set();
      const pending = userDefs.filter((d) => !logged.has(String(d._id)));
      if (pending.length === 0) continue; // everything done — no nagging

      const names = pending.slice(0, 3).map((d) => d.name).join(', ');
      const extra = pending.length > 3 ? ` +${pending.length - 3} more` : '';
      payloadByUser.set(uid, JSON.stringify({
        title: '⏰ Habit Reminder',
        body: `Still pending today: ${names}${extra} 🌿`,
      }));
    }

    await Promise.allSettled(
      subs.map(async (sub) => {
        const payload = payloadByUser.get(String(sub.userId));
        if (!payload) return; // user done for the day or has no habits
        try {
          await sendPush(sub, payload);
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await Subscription.deleteOne({ _id: sub._id });
          }
        }
      })
    );
  } catch (err) {
    console.error('Reminder cron error:', err.message);
  }
});

// ── Daily backup cron (23:55 IST) ──────────────────────────────────────
// One CSV per user covering ALL habits and entries, uploaded to Supabase Storage
// at {userId}/latest.csv (overwritten each run). MongoDB keeps only the file path.

cron.schedule('55 18 * * *', async () => {
  const supabase = getSupabase();
  if (!supabase) {
    console.warn('⚠️  Backup cron skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }
  try {
    const dateKey = getISTDateKey();
    const users = await User.find({ isAdmin: { $ne: true } });
    let written = 0;

    for (const user of users) {
      const built = await buildUserBackupCsv(user._id);
      if (!built) continue;

      const filePath = `${user._id}/latest.csv`;
      const { error: uploadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(filePath, Buffer.from(built.csv, 'utf8'), {
          contentType: 'text/csv; charset=utf-8',
          upsert: true,
        });

      if (uploadError) {
        console.error(`Backup upload failed for ${user.username || user._id}:`, uploadError.message);
        continue;
      }

      await Backup.findOneAndUpdate(
        { userId: user._id },
        { date: dateKey, username: user.username || '', filePath, habitCount: built.habitCount, entryCount: built.entryCount },
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

// ── Boot — connect to MongoDB first, only then accept traffic ──────────

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    await ensureIndexes();
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
      config.logStartupSummary();
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });
