const mongoose = require('mongoose');

const TRACKING_TYPES = ['completion', 'quantity'];

const goalSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  value: { type: Number, default: 1, min: 0.01 },
  // 'at_least' = success when value >= target (build-up habits, the default)
  // 'at_most'  = success when value <= target (reduction habits, e.g. screen time)
  direction: { type: String, enum: ['at_least', 'at_most'], default: 'at_least' },
}, { _id: false });

const habitDefinitionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60,
  },
  trackingType: {
    type: String,
    required: true,
    enum: TRACKING_TYPES,
  },
  unit: {
    type: String,
    trim: true,
    default: '',
  },
  goal: {
    type: goalSchema,
    default: () => ({}),
  },
  // Archived habits keep all history but are hidden from Track/Dashboard,
  // reminders, and digests. Distinct from deletion — fully reversible.
  archived: {
    type: Boolean,
    default: false,
  },
  order: {
    type: Number,
    default: 0,
  },
  color: {
    type: String,
    default: '#22c55e',
  },
  icon: {
    type: String,
    default: '📌',
    maxlength: 4,
  },
}, { timestamps: true });

habitDefinitionSchema.index({ userId: 1, order: 1 });

habitDefinitionSchema.pre('save', async function (next) {
  if (this.isNew) {
    const last = await this.constructor
      .findOne({ userId: this.userId })
      .sort({ order: -1 })
      .select('order');
    this.order = last ? last.order + 1 : 0;
  }
  next();
});

module.exports = mongoose.model('HabitDefinition', habitDefinitionSchema);
module.exports.TRACKING_TYPES = TRACKING_TYPES;
