const https = require('https');

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate phone number format (Indian mobile)
const validatePhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
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

// MSG91 SMS Service using FLOW API
class MSG91SMSService {
  constructor() {
    this.isConfigured = false;
    this.authKey = null;
    this.templateId = null;
  }

  initialize() {
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.templateId = process.env.MSG91_TEMPLATE_ID;

    if (this.authKey && this.templateId) {
      this.isConfigured = true;
      console.log('✅ MSG91 Flow SMS service initialized');
    } else {
      console.log('⚠️ MSG91 not configured. Running in DEMO mode.');
    }
  }

  async sendOTP(phone, otp) {
    if (!this.isConfigured) {
      console.log(`\n========= DEMO MODE =========`);
      console.log(`OTP for +91${phone}: ${otp}`);
      console.log(`=============================\n`);
      return { success: true, demo: true };
    }

    try {
      const postData = JSON.stringify({
        template_id: this.templateId,
        recipients: [
          {
            mobiles: `91${phone}`,
            OTP: otp
          }
        ]
      });

      const options = {
        hostname: 'api.msg91.com',
        path: '/api/v5/flow/',
        method: 'POST',
        headers: {
          'authkey': this.authKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const response = await this.httpPostRequest(options, postData);

      console.log('📩 MSG91 Response:', response);

      return { success: true };
    } catch (error) {
      console.error('❌ MSG91 SMS error:', error.message);
      return { success: false, error: error.message };
    }
  }

  httpPostRequest(options, postData) {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async verifyOTP() {
    return { success: true, verified: true };
  }
}

const msg91Service = new MSG91SMSService();

module.exports = {
  generateOTP,
  validatePhone,
  getOTPExpiry,
  msg91Service
};