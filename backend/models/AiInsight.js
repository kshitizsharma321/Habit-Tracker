const mongoose = require('mongoose');

// Cached AI "Coach's note" — one generation per habit per IST day, so a small
// user base stays far inside any free tier. TTL cleans old notes after 7 days.
const aiInsightSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // null = the account-wide dashboard digest (one per user per day);
  // set = the per-habit Coach's note.
  habitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HabitDefinition',
    default: null,
  },
  dateKey: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  // Fingerprint of the stats this text was generated from. Caching purely by
  // day made the note go stale the moment the user logged: a digest written at
  // 9am ("nothing logged yet") was still being served at 9pm after everything
  // was done. When the fingerprint changes, the text is regenerated.
  signature: {
    type: String,
    default: null,
  },
  // Regenerations used today. Bounds API spend when someone logs repeatedly —
  // past the cap the last good text is served rather than burning quota.
  generations: {
    type: Number,
    default: 1,
  },
}, { timestamps: true });

aiInsightSchema.index({ userId: 1, habitId: 1, dateKey: 1 }, { unique: true });
aiInsightSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('AiInsight', aiInsightSchema);
