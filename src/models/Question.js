const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [1000, 'Question cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['yesno', 'likedislike', 'mcq', 'rating'],
    required: [true, 'Question type is required']
  },
  options: [{
    type: String,
    trim: true,
    maxlength: [200, 'Option cannot exceed 200 characters']
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  totalResponses: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
questionSchema.index({ isActive: 1, createdAt: -1 });
questionSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for question type display
questionSchema.virtual('typeDisplay').get(function() {
  const typeMap = {
    'yesno': 'Yes/No',
    'likedislike': 'Like/Dislike',
    'mcq': 'Multiple Choice',
    'rating': 'Rating'
  };
  return typeMap[this.type] || this.type;
});

questionSchema.set('toJSON', { virtuals: true });
questionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Question', questionSchema);