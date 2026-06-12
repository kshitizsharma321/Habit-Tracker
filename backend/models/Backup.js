const mongoose = require('mongoose');

// One backup document per user per day.
// fileData holds the complete CSV as a binary Buffer so the admin can download
// the exact file and re-upload it to restore data.
const backupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
  fileData: {
    type: Buffer,
    required: true,
  },
  habitCount: {
    type: Number,
    default: 0,
  },
  entryCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

backupSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Backup', backupSchema);
