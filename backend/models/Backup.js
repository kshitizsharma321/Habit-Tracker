const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  habitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HabitDefinition',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  csvContent: {
    type: String,
    required: true,
  },
}, { timestamps: true });

backupSchema.index({ userId: 1, habitId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Backup', backupSchema);
