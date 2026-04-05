require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const webpush = require('web-push');
const Habit = require('./models/Habit');
const Subscription = require('./models/Subscription');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

// VAPID setup for Web Push (only active if keys are configured)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:reminder@habit-tracker.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes

// Get all habit data
app.get('/api/habits', async (req, res) => {
  try {
    const habits = await Habit.find().sort({ date: 1 });
    
    // Convert to object format { "2026-01-01": "yes", "2026-01-02": "no" }
    const habitData = {};
    habits.forEach(habit => {
      habitData[habit.date] = habit.response;
    });
    
    res.json(habitData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch habits', message: error.message });
  }
});

// Save or update a habit entry
app.post('/api/habits', async (req, res) => {
  try {
    const { date, response } = req.body;
    
    if (!date || !response) {
      return res.status(400).json({ error: 'Date and response are required' });
    }
    
    if (!['yes', 'no'].includes(response)) {
      return res.status(400).json({ error: 'Response must be "yes" or "no"' });
    }
    
    // Update if exists, create if not
    const habit = await Habit.findOneAndUpdate(
      { date },
      { response },
      { new: true, upsert: true }
    );
    
    res.json({ success: true, habit });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save habit', message: error.message });
  }
});

// Bulk save/update habits (for migration or batch operations)
app.post('/api/habits/bulk', async (req, res) => {
  try {
    const habitData = req.body; // Object with date keys and response values
    
    if (typeof habitData !== 'object') {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    const operations = Object.entries(habitData).map(([date, response]) => ({
      updateOne: {
        filter: { date },
        update: { response },
        upsert: true
      }
    }));
    
    if (operations.length > 0) {
      await Habit.bulkWrite(operations);
    }
    
    res.json({ success: true, count: operations.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save habits in bulk', message: error.message });
  }
});

// Delete a habit entry
app.delete('/api/habits/:date', async (req, res) => {
  try {
    const { date } = req.params;
    await Habit.findOneAndDelete({ date });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete habit', message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// ── Push notification subscriptions ───────────────────────────────────────────

// Save or update a push subscription + reminder time
app.post('/api/subscriptions', async (req, res) => {
  try {
    const { subscription, reminderTime } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }
    await Subscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
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

// Remove a push subscription (user disabled reminders)
app.delete('/api/subscriptions', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });
    await Subscription.findOneAndDelete({ endpoint });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove subscription', message: error.message });
  }
});

// ── Daily reminder cron job ────────────────────────────────────────────────────
// Runs every minute. Sends a push to any subscription whose reminderTime matches
// the current IST time (HH:MM). Render free tier must be kept awake (e.g. UptimeRobot)
// for this to fire reliably — ping /api/health every 5 minutes.

async function sendPush(sub, payload) {
  // Convert Mongoose subdocument to plain object so web-push receives a clean { p256dh, auth }
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
    payload
  );
}

// Test endpoint — sends an immediate push to the requesting browser's subscription
// Body: { endpoint: string } — if omitted, falls back to all subscriptions
app.post('/api/test-push', async (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(503).json({ error: 'VAPID keys not configured on the backend' });
  }
  const { endpoint } = req.body ?? {};
  let subs;
  if (endpoint) {
    // Target only the subscription for THIS browser
    const sub = await Subscription.findOne({ endpoint }).catch(() => null);
    if (!sub) {
      return res.json({ sent: 0, message: 'Your browser subscription was not found on the server — disable and re-enable reminders to register it' });
    }
    subs = [sub];
  } else {
    subs = await Subscription.find({}).catch(() => []);
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
          await Subscription.deleteOne({ endpoint: sub.endpoint });
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
          await Subscription.deleteOne({ endpoint: sub.endpoint });
        }
      }
    })
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
