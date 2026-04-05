const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth:   { type: String, required: true },
    },
    // HH:MM in IST (24-hour), e.g. "21:00"
    reminderTime: { type: String, default: '21:00' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', SubscriptionSchema);
