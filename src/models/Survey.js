const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  surveyType: {
    type: String,
    required: [true, 'Survey type is required'],
    trim: true
  },
  formData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },
  photos: [{
    type: String
  }],
  signature: {
    type: String
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'synced'],
    default: 'draft'
  },
  completedAt: {
    type: Date
  },
  localId: {
    type: String,
    index: true
  }
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
surveySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Survey', surveySchema);