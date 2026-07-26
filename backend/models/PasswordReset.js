const mongoose = require('mongoose');

// Single-use password-reset tokens. Only the SHA-256 hash is stored — the raw
// token exists solely inside the emailed link, so a DB leak can't reset accounts.
const passwordResetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

// Mongo deletes expired tokens itself (checked ~every 60s, which is fine —
// the route also verifies expiresAt so a not-yet-swept token can't be used).
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
