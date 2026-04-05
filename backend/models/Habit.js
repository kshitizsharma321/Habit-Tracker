const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  response: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Habit', habitSchema);
