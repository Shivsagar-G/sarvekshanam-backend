const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    index: true
  },
  otp: {
    type: String,
    required: [true, 'OTP is required']
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  verifiedAt: {
    type: Date
  },
  attempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// TTL index to auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);