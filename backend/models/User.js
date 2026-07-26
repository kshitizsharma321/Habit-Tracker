const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username must be at most 30 characters'],
    match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'],
  },
  // Optional — username is the universal identifier. Sparse unique allows many users with no email.
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  // Google-only accounts have no password at all — login's "use Google Sign-In"
  // branch and the Settings password section both key off its absence.
  password: {
    type: String,
    required: function () { return !this.googleId; },
    minlength: 6,
  },
  name: {
    type: String,
    default: '',
    trim: true,
  },
  googleId: {
    type: String,
    default: null,
  },
  onboardingComplete: {
    type: Boolean,
    default: false,
  },
  // Set by an admin password reset — forces a new password on next login
  // (PUT /auth/password accepts the change without currentPassword while set).
  mustChangePassword: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
