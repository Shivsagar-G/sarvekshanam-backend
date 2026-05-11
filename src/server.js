require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const surveyRoutes = require('./routes/surveys');
const syncRoutes = require('./routes/sync');
const questionsRoutes = require('./routes/questions');
const responsesRoutes = require('./routes/responses');

const app = express();

// ===============================
// CONNECT DATABASE
// ===============================
connectDB();

// ===============================
// CORS CONFIGURATION
// ===============================
const allowedOrigins = [
  process.env.CORS_ORIGIN,

  // Local development
  'http://localhost:3000',
  'http://localhost:5173',

  // Minimax deployed frontends
  'https://gh2s9nersll9.space.minimax.io',
  'https://8od3f1e773h4.space.minimax.io',
  'https://cx53jrwikjjs.space.minimax.io',
  'https://t5f4pf7ti58w.space.minimax.io'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {

    // Allow requests without origin
    if (!origin) {
      return callback(null, true);
    }

    // Allow configured origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log('Blocked by CORS:', origin);

    return callback(null, false);
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ],

  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// ===============================
// MIDDLEWARE
// ===============================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===============================
// HEALTH CHECK
// ===============================
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Sarvekshanam API is running',
    timestamp: new Date().toISOString()
  });
});

// ===============================
// API ROUTES
// ===============================
app.use('/api/auth', authRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/responses', responsesRoutes);

// ===============================
// 404 HANDLER
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ===============================
// ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  console.error('Server Error:', err);

  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
