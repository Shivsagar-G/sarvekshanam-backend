const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    index: true,
    match: /^[6-9]\d{9}$/
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  role: {
    type: String,
    enum: ['field_worker', 'supervisor', 'admin'],
    default: 'field_worker'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Hash phone number for additional security
userSchema.pre('save', async function(next) {
  if (!this.isModified('phone')) return next();
  // Phone is stored as-is for user convenience
  next();
});

module.exports = mongoose.model('User', userSchema);