const express = require('express');
const router = express.Router();
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const { requireAuth } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validateObjectId');
const { getISTDateKey, isValidDateKey, DAY_MS } = require('../lib/dates');
const { normalizeEntryValue } = require('../lib/validate');
const { calculateCurrentStreak, calculateSuccessRate } = require('../lib/streaks');
const { sendError } = require('../lib/errors');

const { TRACKING_TYPES } = require('../models/HabitDefinition');

const NAME_MAX_LENGTH = 60;

function validateName(name) {
  if (!name || !name.trim()) return 'Name is required';
  if (name.trim().length > NAME_MAX_LENGTH) return `Name must be at most ${NAME_MAX_LENGTH} characters`;
  return null;
}

// ── GET / — list all definitions ───────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const definitions = await HabitDefinition.find({ userId: req.user._id }).sort({ order: 1 });
    res.json(definitions);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch habit definitions', error);
  }
});

// ── POST / — create a new habit definition ─────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, trackingType, unit, goal, color, icon } = req.body;

    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ error: nameError });
    if (!trackingType || !TRACKING_TYPES.includes(trackingType)) {
      return res.status(400).json({ error: `trackingType must be one of: ${TRACKING_TYPES.join(', ')}` });
    }

    // Block case-insensitive duplicate names for this user ("Exercise" === "exercise").
    const duplicate = await HabitDefinition.findOne({ userId: req.user._id, name: name.trim() })
      .collation({ locale: 'en', strength: 2 });
    if (duplicate) {
      return res.status(409).json({ error: `You already have a habit called "${duplicate.name}".` });
    }

    let goalData;
    if (trackingType === 'quantity') {
      const goalValue = Number(goal?.value);
      if (!goalValue || !isFinite(goalValue) || goalValue <= 0) {
        return res.status(400).json({ error: 'Quantity habits require a positive goal value' });
      }
      const direction = goal?.direction === 'at_most' ? 'at_most' : 'at_least';
      goalData = { enabled: true, value: Math.round(goalValue * 100) / 100, direction };
    } else {
      goalData = { enabled: false, value: 1 };
    }

    const definition = await HabitDefinition.create({
      userId: req.user._id,
      name,
      trackingType,
      unit: trackingType === 'quantity' ? (unit || '') : '',
      goal: goalData,
      color: color || '#22c55e',
      icon: icon || '📌',
    });

    res.status(201).json(definition);
  } catch (error) {
    sendError(res, 500, 'Failed to create habit', error);
  }
});

// ── POST /bulk — bulk create definitions (onboarding) ──────────────────

router.post('/bulk', requireAuth, async (req, res) => {
  try {
    const { habits } = req.body;
    if (!Array.isArray(habits) || habits.length === 0) {
      return res.status(400).json({ error: 'habits array is required' });
    }

    // Skip case-insensitive duplicates — both already-existing habits and repeats within this batch.
    const existing = await HabitDefinition.find({ userId: req.user._id }).select('name');
    const seenNames = new Set(existing.map((d) => d.name.trim().toLowerCase()));

    const created = [];
    for (const h of habits) {
      if (validateName(h.name) || !h.trackingType || !TRACKING_TYPES.includes(h.trackingType)) continue;
      const nameKey = h.name.trim().toLowerCase();
      if (seenNames.has(nameKey)) continue;

      // Same goal rules as single create: quantity requires a positive goal.
      let goalData;
      if (h.trackingType === 'quantity') {
        const goalValue = Number(h.goal?.value);
        if (!goalValue || !isFinite(goalValue) || goalValue <= 0) continue;
        goalData = {
          enabled: true,
          value: Math.round(goalValue * 100) / 100,
          direction: h.goal?.direction === 'at_most' ? 'at_most' : 'at_least',
        };
      } else {
        goalData = { enabled: false, value: 1 };
      }

      seenNames.add(nameKey);
      const def = await HabitDefinition.create({
        userId: req.user._id,
        name: h.name,
        trackingType: h.trackingType,
        unit: h.trackingType === 'quantity' ? (h.unit || '') : '',
        goal: goalData,
        color: h.color || '#22c55e',
        icon: h.icon || '📌',
      });
      created.push(def);
    }

    res.status(201).json({ count: created.length, habits: created });
  } catch (error) {
    sendError(res, 500, 'Failed to bulk create habits', error);
  }
});

// ── GET /dashboard — today + recent entries + current streaks ───────────
// The habit list itself is loaded separately via GET /habit-definitions (cached
// app-wide). Entries are windowed to 60 days to keep the payload small, but
// streaks are computed here over the FULL history so they are never capped by
// the window (a 90-day streak must not display as 60).

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const todayKey = getISTDateKey();
    const fromKey = getISTDateKey(new Date(Date.now() - 60 * DAY_MS));

    const [definitions, allRows] = await Promise.all([
      HabitDefinition.find({ userId: req.user._id }),
      Habit.find({ userId: req.user._id }).select('habitId date value').lean(),
    ]);

    const entryMaps = {}; // habitId -> { date: value } — full history, for streaks
    const todayEntries = {};
    const allEntries = {}; // habitId -> { date: { value } } — 60-day window, for the UI
    for (const row of allRows) {
      const hid = row.habitId?.toString();
      if (!hid) continue; // skip orphaned entries with no habit reference
      (entryMaps[hid] ??= {})[row.date] = row.value;
      if (row.date >= fromKey) {
        (allEntries[hid] ??= {})[row.date] = { value: row.value };
      }
      if (row.date === todayKey) todayEntries[hid] = { value: row.value };
    }

    // Both computed over FULL history — the 60-day `allEntries` window is for
    // rendering only. Deriving these client-side from that window would cap
    // streaks at 60 days and quietly turn "all-time success rate" into
    // "last 60 days", disagreeing with the Detail page's all-time number.
    const streaks = {};
    const successRates = {};
    for (const def of definitions) {
      const map = entryMaps[def._id.toString()] ?? {};
      streaks[def._id] = calculateCurrentStreak(map, def);
      successRates[def._id] = calculateSuccessRate(map, def);
    }

    res.json({ todayEntries, allEntries, streaks, successRates });
  } catch (error) {
    sendError(res, 500, 'Failed to load dashboard', error);
  }
});

// ── PUT /reorder ───────────────────────────────────────────────────────

router.put('/reorder', requireAuth, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
    }

    // The list must be exactly the user's definitions — a partial or duplicated
    // list would silently corrupt the ordering.
    const ownIds = await HabitDefinition.find({ userId: req.user._id }).distinct('_id');
    const ownSet = new Set(ownIds.map(String));
    const sentSet = new Set(orderedIds.map(String));
    if (sentSet.size !== orderedIds.length || sentSet.size !== ownSet.size ||
        [...sentSet].some((id) => !ownSet.has(id))) {
      return res.status(400).json({ error: 'orderedIds must contain each of your habit ids exactly once' });
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, userId: req.user._id },
        update: { order: index },
      },
    }));

    await HabitDefinition.bulkWrite(bulkOps);
    const definitions = await HabitDefinition.find({ userId: req.user._id }).sort({ order: 1 });
    res.json(definitions);
  } catch (error) {
    sendError(res, 500, 'Failed to reorder habits', error);
  }
});

// ── PUT /:id — update a habit definition ───────────────────────────────
// trackingType is deliberately NOT updatable — it is locked after creation
// (entries of the other type would be stranded without conversion).

router.put('/:id', requireAuth, validateObjectId(), async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const updates = {};
    const fields = ['name', 'unit', 'goal', 'color', 'icon', 'archived'];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }
    if (updates.archived !== undefined) updates.archived = !!updates.archived;

    if (updates.name !== undefined) {
      const nameError = validateName(updates.name);
      if (nameError) return res.status(400).json({ error: nameError });
      const duplicate = await HabitDefinition.findOne({
        userId: req.user._id,
        name: updates.name.trim(),
        _id: { $ne: def._id },
      }).collation({ locale: 'en', strength: 2 });
      if (duplicate) {
        return res.status(409).json({ error: `You already have a habit called "${duplicate.name}".` });
      }
    }

    // Enforce goal rules on update
    if (updates.goal) {
      if (def.trackingType === 'quantity') {
        const goalValue = Number(updates.goal.value);
        if (!goalValue || !isFinite(goalValue) || goalValue <= 0) {
          return res.status(400).json({ error: 'Quantity habits require a positive goal value' });
        }
        updates.goal.enabled = true;
        updates.goal.value = Math.round(goalValue * 100) / 100;
        updates.goal.direction = updates.goal.direction === 'at_most' ? 'at_most' : 'at_least';
      } else {
        updates.goal.enabled = false;
      }
    }

    Object.assign(def, updates);
    await def.save();
    res.json(def);
  } catch (error) {
    sendError(res, 500, 'Failed to update habit', error);
  }
});

// ── DELETE /:id ────────────────────────────────────────────────────────

router.delete('/:id', requireAuth, validateObjectId(), async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const entryCount = await Habit.countDocuments({ habitId: def._id, userId: req.user._id });
    await Habit.deleteMany({ habitId: def._id, userId: req.user._id });
    await HabitDefinition.deleteOne({ _id: def._id });

    res.json({ success: true, deletedEntries: entryCount });
  } catch (error) {
    sendError(res, 500, 'Failed to delete habit', error);
  }
});

// ── Entry routes ───────────────────────────────────────────────────────

router.get('/:id/entries', requireAuth, validateObjectId(), async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const entries = await Habit.find({ habitId: def._id, userId: req.user._id }).sort({ date: 1 });
    const data = {};
    entries.forEach((e) => {
      data[e.date] = e.value;
    });
    res.json(data);
  } catch (error) {
    sendError(res, 500, 'Failed to fetch entries', error);
  }
});

router.post('/:id/entries', requireAuth, validateObjectId(), async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const { date, value } = req.body;
    if (!date || value === undefined || value === null) {
      return res.status(400).json({ error: 'Date and value are required' });
    }
    if (!isValidDateKey(date)) {
      return res.status(400).json({ error: 'Date must be a valid YYYY-MM-DD key' });
    }
    if (date > getISTDateKey()) {
      return res.status(400).json({ error: 'Cannot log entries for future dates' });
    }

    const normalized = normalizeEntryValue(def.trackingType, value);
    if (!normalized.ok) return res.status(400).json({ error: normalized.error });

    const entry = await Habit.findOneAndUpdate(
      { userId: req.user._id, habitId: def._id, date },
      { value: normalized.value },
      { new: true, upsert: true },
    );

    // Return the fresh streak so the client can display/celebrate without
    // recomputing from its (60-day-windowed) dashboard cache.
    const rows = await Habit.find({ habitId: def._id, userId: req.user._id }).select('date value').lean();
    const entryMap = {};
    for (const row of rows) entryMap[row.date] = row.value;
    const currentStreak = calculateCurrentStreak(entryMap, def);

    res.json({ success: true, entry, currentStreak });
  } catch (error) {
    sendError(res, 500, 'Failed to save entry', error);
  }
});

router.delete('/:id/entries/:date', requireAuth, validateObjectId(), async (req, res) => {
  try {
    if (!isValidDateKey(req.params.date)) {
      return res.status(400).json({ error: 'Date must be a valid YYYY-MM-DD key' });
    }
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    await Habit.findOneAndDelete({ userId: req.user._id, habitId: def._id, date: req.params.date });
    res.json({ success: true });
  } catch (error) {
    sendError(res, 500, 'Failed to delete entry', error);
  }
});

module.exports = router;
