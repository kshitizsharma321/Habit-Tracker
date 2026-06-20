const express = require('express');
const router = express.Router();
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const { requireAuth } = require('../middleware/auth');

const { TRACKING_TYPES } = require('../models/HabitDefinition');

// ── GET / — list all definitions ───────────────────────────────────────

router.get('/', requireAuth, async (req, res) => {
  try {
    const definitions = await HabitDefinition.find({ userId: req.user._id }).sort({ order: 1 });
    res.json(definitions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch habit definitions', message: error.message });
  }
});

// ── POST / — create a new habit definition ─────────────────────────────

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, trackingType, unit, goal, color, icon } = req.body;

    if (!name || !trackingType) {
      return res.status(400).json({ error: 'Name and trackingType are required' });
    }
    if (!TRACKING_TYPES.includes(trackingType)) {
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
    res.status(500).json({ error: 'Failed to create habit', message: error.message });
  }
});

// ── POST /bulk ─────────────────────────────────────────────────────────

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
      if (!h.name || !h.trackingType || !TRACKING_TYPES.includes(h.trackingType)) continue;
      const nameKey = h.name.trim().toLowerCase();
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      const def = await HabitDefinition.create({
        userId: req.user._id,
        name: h.name,
        trackingType: h.trackingType,
        unit: h.trackingType === 'quantity' ? (h.unit || '') : undefined,
        goal: h.goal?.enabled
          ? { enabled: true, value: h.goal.value, direction: h.goal.direction === 'at_most' ? 'at_most' : 'at_least' }
          : undefined,
        color: h.color || '#22c55e',
        icon: h.icon || '📌',
      });
      created.push(def);
    }

    res.status(201).json({ count: created.length, habits: created });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk create habits', message: error.message });
  }
});

// ── GET /dashboard — today's entries for all habits ─────────────────────

router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // The habit list itself is loaded separately via GET /habit-definitions (cached app-wide),
    // so the dashboard only needs entries. One query for the last 60 days covers both today's
    // entries and the backdate lookup window — no definitions round-trip, no defIds filter.
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const fromKey = `${sixtyDaysAgo.getFullYear()}-${String(sixtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sixtyDaysAgo.getDate()).padStart(2, '0')}`;

    const recentEntries = await Habit.find({
      userId: req.user._id,
      date: { $gte: fromKey },
    });

    const todayEntries = {};
    const allEntries = {};
    recentEntries.forEach((h) => {
      const hid = h.habitId?.toString();
      if (!hid) return; // skip orphaned entries with no habit reference
      if (!allEntries[hid]) allEntries[hid] = {};
      allEntries[hid][h.date] = { value: h.value };
      if (h.date === todayKey) todayEntries[hid] = { value: h.value };
    });

    res.json({ todayEntries, allEntries });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard', message: error.message });
  }
});

// ── PUT /reorder ───────────────────────────────────────────────────────

router.put('/reorder', requireAuth, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds array is required' });
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
    res.status(500).json({ error: 'Failed to reorder habits', message: error.message });
  }
});

// ── PUT /:id — update a habit definition ───────────────────────────────

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const updates = {};
    const fields = ['name', 'trackingType', 'unit', 'goal', 'color', 'icon'];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.trackingType && !TRACKING_TYPES.includes(updates.trackingType)) {
      return res.status(400).json({ error: `trackingType must be one of: ${TRACKING_TYPES.join(', ')}` });
    }

    if (updates.name) {
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
    const effectiveType = updates.trackingType || def.trackingType;
    if (updates.goal) {
      if (effectiveType === 'quantity') {
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
    res.status(500).json({ error: 'Failed to update habit', message: error.message });
  }
});

// ── DELETE /:id ────────────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const entryCount = await Habit.countDocuments({ habitId: def._id, userId: req.user._id });
    await Habit.deleteMany({ habitId: def._id, userId: req.user._id });
    await HabitDefinition.deleteOne({ _id: def._id });

    res.json({ success: true, deletedEntries: entryCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete habit', message: error.message });
  }
});

// ── Entry routes ───────────────────────────────────────────────────────

router.get('/:id/entries', requireAuth, async (req, res) => {
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
    res.status(500).json({ error: 'Failed to fetch entries', message: error.message });
  }
});

router.post('/:id/entries', requireAuth, async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const { date, value } = req.body;
    if (!date || value === undefined || value === null) {
      return res.status(400).json({ error: 'Date and value are required' });
    }

    let finalValue = value;
    if (def.trackingType === 'completion') {
      if (!['yes', 'no'].includes(value)) {
        return res.status(400).json({ error: 'Completion habits require "yes" or "no"' });
      }
    } else if (def.trackingType === 'quantity') {
      if (typeof value !== 'number' || !isFinite(value) || value < 0) {
        return res.status(400).json({ error: 'Quantity habits require a non-negative number' });
      }
      finalValue = Math.round(value * 100) / 100;
    }

    const entry = await Habit.findOneAndUpdate(
      { userId: req.user._id, habitId: def._id, date },
      { value: finalValue },
      { new: true, upsert: true },
    );

    res.json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save entry', message: error.message });
  }
});

router.post('/:id/entries/bulk', requireAuth, async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries array is required' });
    }

    const operations = entries.map((e) => ({
      updateOne: {
        filter: { userId: req.user._id, habitId: def._id, date: e.date },
        update: { value: e.value },
        upsert: true,
      },
    }));

    let processed = 0;
    const CHUNK = 50;
    for (let i = 0; i < operations.length; i += CHUNK) {
      const chunk = operations.slice(i, i + CHUNK);
      await Habit.bulkWrite(chunk);
      processed += chunk.length;
    }

    res.json({ success: true, count: processed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bulk save entries', message: error.message });
  }
});

router.delete('/:id/entries/:date', requireAuth, async (req, res) => {
  try {
    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });

    await Habit.findOneAndDelete({ userId: req.user._id, habitId: def._id, date: req.params.date });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete entry', message: error.message });
  }
});

module.exports = router;
