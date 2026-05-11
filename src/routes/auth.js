const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const OTP = require('../models/OTP');
const User = require('../models/User');
const { generateOTP, validatePhone, getOTPExpiry, msg91Service } = require('../utils/smsService');

// Initialize SMS service
msg91Service.initialize();

// Validation schemas
const phoneSchema = Joi.object({
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required()
});

const otpSchema = Joi.object({
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required()
});

// Rate limiting - simple in-memory store (use Redis in production)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3;

function checkRateLimit(phone) {
  const now = Date.now();
  const key = `otp_request:${phone}`;

  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, firstRequest: now });
    return true;
  }

  const record = requestCounts.get(key);

  // Reset if window expired
  if (now - record.firstRequest > RATE_LIMIT_WINDOW) {
    requestCounts.set(key, { count: 1, firstRequest: now });
    return true;
  }

  // Check limit
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count++;
  return true;
}

// Request OTP
router.post('/request-otp', async (req, res) => {
  try {
    const { error, value } = phoneSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Must be a valid 10-digit Indian mobile number.'
      });
    }

    const { phone } = value;

    // Check rate limit
    if (!checkRateLimit(phone)) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please wait before trying again.',
        retryAfter: 60
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry(5); // 5 minutes expiry

    // Delete any existing OTPs for this phone
    await OTP.deleteMany({ phone });

    // Create new OTP
    const otpRecord = await OTP.create({
      phone,
      otp,
      expiresAt
    });

    // Send OTP via MSG91 (or demo mode)
    const smsResult = await msg91Service.sendOTP(phone, otp);

    // In production, don't return OTP in response
    const response = {
      success: true,
      message: 'OTP sent successfully',
      // Only include OTP in demo/development mode
      ...(process.env.NODE_ENV !== 'production' && { demo_otp: otp })
    };

    // If SMS failed, include error info (but don't fail the request)
    if (!smsResult.success && !smsResult.demo) {
      console.error('SMS delivery failed:', smsResult.error);
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Request OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { error, value } = otpSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request format.'
      });
    }

    const { phone, otp } = value;

    // Find the most recent OTP for this phone
    const otpRecord = await OTP.findOne({
      phone,
      verifiedAt: { $exists: false }
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new OTP.'
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Too many attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      // Increment attempts
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`
      });
    }

    // Mark OTP as verified
    otpRecord.verifiedAt = new Date();
    await otpRecord.save();

    // Find or create user
    let user = await User.findOne({ phone });

    if (!user) {
      // Create new user with default name from phone
      user = await User.create({
        phone,
        name: `User ${phone.slice(-4)}`
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'sarvekshanam-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.'
    });
  }
});

// Refresh token
router.post('/refresh-token', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided.'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sarvekshanam-secret-key');
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive.'
        });
      }

      // Generate new token
      const newToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'sarvekshanam-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(200).json({
        success: true,
        token: newToken
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.'
      });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token.'
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided.'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sarvekshanam-secret-key');
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided.'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sarvekshanam-secret-key');

    const { name, email } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    const user = await User.findByIdAndUpdate(
      decoded.userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile.'
    });
  }
});

// Logout (client-side token removal, but can track for analytics)
router.post('/logout', async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});
// MSG91 Verified Login
router.post('/msg91-login', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number'
      });
    }

    // Find or create user
    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({
        phone,
        name: `User ${phone.slice(-4)}`
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'sarvekshanam-secret-key',
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );

    return res.status(200).json({
      success: true,
      message: 'MSG91 login successful',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('MSG91 Login Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});
module.exports = router;
