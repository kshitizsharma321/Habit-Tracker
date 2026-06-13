const mongoose = require('mongoose');

// One backup document per user per day.
// The actual CSV is stored in Supabase Storage; filePath holds the object path
// inside the 'habit-backups' bucket: "{userId}/{date}.csv"
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
  filePath: {
    type: String,
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
