const { v4: uuidv4 } = require('uuid');

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate phone number format (Indian mobile)
const validatePhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  // Check if it's a valid 10-digit Indian mobile number
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return cleaned;
  }
  return null;
};

// Calculate OTP expiry time
const getOTPExpiry = (minutes = 5) => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + minutes);
  return expiry;
};

module.exports = {
  generateOTP,
  validatePhone,
  getOTPExpiry
};