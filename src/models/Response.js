const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: [true, 'Question ID is required'],
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  sessionId: {
    type: String,
    required: [true, 'Session ID is required for guest responses'],
    index: true
  },
  selectedAnswer: {
    type: String,
    required: [true, 'Selected answer is required']
  },
  answerType: {
    type: String,
    enum: ['yesno', 'likedislike', 'mcq', 'rating'],
    default: 'yesno'
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate responses from same user/session for same question
responseSchema.index({ questionId: 1, userId: 1 }, { unique: true });
responseSchema.index({ questionId: 1, sessionId: 1 }, { unique: true });

// Virtual for answer display
responseSchema.virtual('answerDisplay').get(function() {
  if (this.answerType === 'rating') {
    return `${this.selectedAnswer}/10`;
  }
  return this.selectedAnswer;
});

responseSchema.set('toJSON', { virtuals: true });
responseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Response', responseSchema);