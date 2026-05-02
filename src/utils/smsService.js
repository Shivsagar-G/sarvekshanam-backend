const https = require('https');
const http = require('http');

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

// MSG91 SMS Service
class MSG91SMSService {
  constructor() {
    this.isConfigured = false;
    this.authKey = null;
    this.senderId = null;
    this.templateId = null;
  }

  initialize() {
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.senderId = process.env.MSG91_SENDER_ID || 'SARVEK';
    this.templateId = process.env.MSG91_TEMPLATE_ID;

    if (this.authKey && this.templateId) {
      this.isConfigured = true;
      console.log('MSG91 SMS service initialized');
    } else {
      console.log('MSG91 not configured. SMS will be logged to console only.');
    }
  }

  async sendOTP(phone, otp) {
    const formattedPhone = `91${phone}`;

    if (this.isConfigured) {
      try {
        // MSG91 API endpoint for sending OTP
        const url = `https://api.msg91.com/api/v5/otp?authkey=${this.authKey}&template_id=${this.templateId}&mobile=${formattedPhone}&otp=${otp}`;

        const response = await this.httpRequest(url);
        const data = JSON.parse(response);

        if (data.type === 'success') {
          console.log(`MSG91 OTP sent successfully to +91${phone}, ID: ${data.id}`);
          return { success: true, messageId: data.id };
        } else {
          console.error('MSG91 API error:', data.message);
          return { success: false, error: data.message };
        }
      } catch (error) {
        console.error('MSG91 SMS error:', error.message);
        return { success: false, error: error.message };
      }
    } else {
      // Demo mode - log to console
      console.log(`=========================================`);
      console.log(`[DEMO MODE] OTP for +91${phone}: ${otp}`);
      console.log(`[MSG91 NOT CONFIGURED] This OTP would be sent via MSG91`);
      console.log(`=========================================`);
      return { success: true, demo: true };
    }
  }

  httpRequest(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  // Verify OTP via MSG91
  async verifyOTP(phone, otp) {
    if (!this.isConfigured) {
      // In demo mode, skip MSG91 verification
      return { success: true, verified: true };
    }

    try {
      const url = `https://api.msg91.com/api/v5/otp/verify?authkey=${this.authKey}&mobile=91${phone}&otp=${otp}`;
      const response = await this.httpRequest(url);
      const data = JSON.parse(response);

      if (data.type === 'success') {
        return { success: true, verified: true };
      } else {
        return { success: false, verified: false, error: data.message };
      }
    } catch (error) {
      return { success: false, verified: false, error: error.message };
    }
  }
}

// Export singleton instance
const msg91Service = new MSG91SMSService();

module.exports = {
  generateOTP,
  validatePhone,
  getOTPExpiry,
  msg91Service
};