const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  habitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HabitDefinition',
    default: null,
    index: true,
  },
  date: {
    type: String,
    required: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: true,
});

habitSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });
// Serves the dashboard's date-range scan (Habit.find({ userId, date: { $gte } })),
// which can't use the compound index above because it skips habitId.
habitSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('Habit', habitSchema);
