const mongoose = require('mongoose');

// One backup document per user — the latest snapshot, overwritten on each run.
// The CSV lives in Supabase Storage; filePath is the object path inside the
// 'habit-backups' bucket: "{userId}/latest.csv". `date` records when it was taken.
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
  // Snapshot of the username so the backup is still identifiable after the user is deleted.
  username: {
    type: String,
    default: '',
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

backupSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Backup', backupSchema);
