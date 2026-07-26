const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const AiInsight = require('../models/AiInsight');
const { requireAuth } = require('../middleware/auth');
const { getISTDateKey } = require('../lib/dates');
const { isAiConfigured, buildHabitSummary, buildAccountSummary, generateCoachNote, generateDailyDigest } = require('../lib/aiInsights');

const router = express.Router();

// Generation is cached per habit per day, so this limiter only guards abuse.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { text: null },
});

// Ceiling on regenerations per cache row per day. The signature already limits
// regeneration to real data changes (≈ one per log); this caps the pathological
// case — someone editing the same entry over and over — so quota stays bounded.
const MAX_DAILY_GENERATIONS = 6;

// A stable fingerprint of the numbers the prompt was built from. Any change to
// the stats the model was told about invalidates the cached text.
function fingerprint(summary) {
  return crypto.createHash('sha256').update(JSON.stringify(summary)).digest('hex').slice(0, 32);
}

// Shared cache decision. Returns the text to serve, or null meaning "generate".
// Serving a stale row past the cap is deliberate: slightly outdated text beats
// an empty card or a surprise bill.
function resolveCached(cached, signature) {
  if (!cached) return null;
  if (cached.signature === signature) return cached.text;
  if (cached.generations >= MAX_DAILY_GENERATIONS) return cached.text;
  return null;
}

// ── POST /ai — AI "Coach's note" for one habit ─────────────────────────
// Always answers 200 with { text } — text: null means "nothing to show"
// (unconfigured, too little data, quota, or provider error). The AI layer
// must never break the Analytics tab.
router.post('/ai', requireAuth, aiLimiter, async (req, res) => {
  try {
    if (!isAiConfigured()) return res.json({ text: null });

    const { habitId } = req.body;
    if (!mongoose.isValidObjectId(habitId)) return res.json({ text: null });

    const def = await HabitDefinition.findOne({ _id: habitId, userId: req.user._id });
    if (!def) return res.json({ text: null });

    const dateKey = getISTDateKey();
    const rows = await Habit.find({ habitId, userId: req.user._id }).select('date value').lean();
    if (rows.length < 3) return res.json({ text: null });

    // Build the summary BEFORE the cache check — its fingerprint is what decides
    // whether the cached note still describes the user's current data.
    const summary = buildHabitSummary(def, rows);
    const signature = fingerprint(summary);

    const cached = await AiInsight.findOne({ userId: req.user._id, habitId, dateKey });
    const hit = resolveCached(cached, signature);
    if (hit) return res.json({ text: hit, cached: true });

    const text = await generateCoachNote(summary).catch(() => null);
    if (!text) {
      // Generation failed — a stale note still beats an empty card.
      return res.json({ text: cached?.text ?? null });
    }

    await AiInsight.findOneAndUpdate(
      { userId: req.user._id, habitId, dateKey },
      { text, signature, $inc: { generations: cached ? 1 : 0 } },
      { upsert: true },
    );
    res.json({ text });
  } catch (err) {
    console.warn('AI insight route error:', err.message);
    res.json({ text: null });
  }
});

// ── POST /ai-digest — one account-wide daily summary for the Dashboard ─
// Same contract as /ai: always 200 with { text }, null = show the rule-based
// digest instead. Cached once per user per IST day (habitId: null row).
router.post('/ai-digest', requireAuth, aiLimiter, async (req, res) => {
  try {
    if (!isAiConfigured()) return res.json({ text: null });

    const dateKey = getISTDateKey();
    const [definitions, rows] = await Promise.all([
      HabitDefinition.find({ userId: req.user._id, archived: { $ne: true } }).sort({ order: 1 }).lean(),
      Habit.find({ userId: req.user._id }).select('habitId date value').lean(),
    ]);
    if (definitions.length === 0) return res.json({ text: null });

    const rowsByHabit = new Map();
    for (const r of rows) {
      if (!r.habitId) continue;
      const key = String(r.habitId);
      if (!rowsByHabit.has(key)) rowsByHabit.set(key, []);
      rowsByHabit.get(key).push(r);
    }

    const summary = buildAccountSummary(definitions, rowsByHabit, dateKey);
    if (summary.habits.every((h) => h.totalDaysLogged < 3)) return res.json({ text: null });

    // The digest names today's progress ("2 of 5 done"), so it must be keyed on
    // that progress — not just the date. Otherwise the morning's "nothing logged
    // yet" text is still on screen after an evening of logging.
    const signature = fingerprint(summary);
    const cached = await AiInsight.findOne({ userId: req.user._id, habitId: null, dateKey });
    const hit = resolveCached(cached, signature);
    if (hit) return res.json({ text: hit, cached: true });

    const text = await generateDailyDigest(summary).catch(() => null);
    if (!text) return res.json({ text: cached?.text ?? null });

    await AiInsight.findOneAndUpdate(
      { userId: req.user._id, habitId: null, dateKey },
      { text, signature, $inc: { generations: cached ? 1 : 0 } },
      { upsert: true },
    );
    res.json({ text });
  } catch (err) {
    console.warn('AI digest route error:', err.message);
    res.json({ text: null });
  }
});

module.exports = router;
