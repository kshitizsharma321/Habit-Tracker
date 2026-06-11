const express = require('express');
const router = express.Router();
const HabitDefinition = require('../models/HabitDefinition');
const Habit = require('../models/Habit');
const { requireAuth } = require('../middleware/auth');

const { TRACKING_TYPES } = require('../models/HabitDefinition');

// ── Conversion helpers ──────────────────────────────────────────────────

const CONVERSIONS = {
  'completion->quantity': (value) => (value === 'yes' ? 1 : 0),
  'quantity->completion': (value) => (Number(value) > 0 ? 'yes' : 'no'),
};

function convertEntries(entries, oldType, newType) {
  const results = { converted: 0, skipped: 0, sample: [] };
  const key = `${oldType}->${newType}`;
  const converter = CONVERSIONS[key];

  for (const entry of entries) {
    if (entry.value === undefined || entry.value === null) {
      results.skipped++;
      continue;
    }
    const rawValue = entry.value;
    const newValue = converter(rawValue, entry);
    if (results.sample.length < 3) {
      results.sample.push({ date: entry.date, old: rawValue, new: newValue });
    }
    results.converted++;
  }
  return results;
}

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

    let goalData;
    if (trackingType === 'quantity') {
      if (!goal?.value || goal.value < 1) {
        return res.status(400).json({ error: 'Quantity habits require a goal value' });
      }
      goalData = { enabled: true, value: goal.value };
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

    const created = [];
    for (const h of habits) {
      if (!h.name || !h.trackingType || !TRACKING_TYPES.includes(h.trackingType)) continue;
      const def = await HabitDefinition.create({
        userId: req.user._id,
        name: h.name,
        trackingType: h.trackingType,
        unit: h.trackingType === 'quantity' ? (h.unit || '') : undefined,
        goal: h.goal?.enabled ? h.goal : undefined,
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
    const definitions = await HabitDefinition.find({ userId: req.user._id }).sort({ order: 1 });
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const defIds = definitions.map((d) => d._id);

    const habits = await Habit.find({
      userId: req.user._id,
      habitId: { $in: defIds },
      date: todayKey,
    });

    const todayEntries = {};
    habits.forEach((h) => {
      todayEntries[h.habitId.toString()] = {
        value: h.value,
      };
    });

    // Recent entries (last 60 days) for backdate lookup
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const fromKey = `${sixtyDaysAgo.getFullYear()}-${String(sixtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sixtyDaysAgo.getDate()).padStart(2, '0')}`;

    const recentEntries = await Habit.find({
      userId: req.user._id,
      habitId: { $in: defIds },
      date: { $gte: fromKey },
    });

    const allEntries = {};
    recentEntries.forEach((h) => {
      const hid = h.habitId.toString();
      if (!allEntries[hid]) allEntries[hid] = {};
      allEntries[hid][h.date] = { value: h.value };
    });

    res.json({ definitions, todayEntries, allEntries });
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

    // Enforce goal rules on update
    const effectiveType = updates.trackingType || def.trackingType;
    if (updates.goal) {
      if (effectiveType === 'quantity') {
        updates.goal.enabled = true;
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

// ── POST /:id/change-type ──────────────────────────────────────────────

router.post('/:id/change-type', requireAuth, async (req, res) => {
  try {
    const { newType } = req.body;
    if (!newType || !TRACKING_TYPES.includes(newType)) {
      return res.status(400).json({ error: `newType must be one of: ${TRACKING_TYPES.join(', ')}` });
    }

    const def = await HabitDefinition.findOne({ _id: req.params.id, userId: req.user._id });
    if (!def) return res.status(404).json({ error: 'Habit not found' });
    if (def.trackingType === newType) {
      return res.status(400).json({ error: 'Already using this tracking type' });
    }

    const entries = await Habit.find({ habitId: def._id, userId: req.user._id });
    const oldType = def.trackingType;

    const preview = convertEntries(entries, oldType, newType);

    if (entries.length > 0 && req.query.preview === 'true') {
      return res.json({ preview, entryCount: entries.length });
    }

    const converter = CONVERSIONS[`${oldType}->${newType}`];
    def.trackingType = newType;
    if (newType === 'quantity') {
      def.unit = req.body.unit || '';
    } else {
      def.unit = '';
    }

    await def.save();

    if (converter && entries.length > 0) {
      const bulkOps = entries.map((entry) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: { value: converter(entry.value, entry) } },
        },
      }));
      await Habit.bulkWrite(bulkOps);
    }

    res.json({ success: true, changed: entries.length, definition: def });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change habit type', message: error.message });
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
    if (!date || value === undefined) {
      return res.status(400).json({ error: 'Date and value are required' });
    }

    if (def.trackingType === 'completion' && !['yes', 'no'].includes(value)) {
      return res.status(400).json({ error: 'Completion habits require "yes" or "no"' });
    }
    if (def.trackingType === 'quantity' && typeof value !== 'number') {
      return res.status(400).json({ error: 'Quantity habits require a number' });
    }

    const entry = await Habit.findOneAndUpdate(
      { userId: req.user._id, habitId: def._id, date },
      { value },
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
