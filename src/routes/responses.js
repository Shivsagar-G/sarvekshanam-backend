const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Response = require('../models/Response');
const Question = require('../models/Question');
const { auth } = require('../middleware/auth');

// Validation schema for response
const responseSchema = Joi.object({
  questionId: Joi.string().required(),
  selectedAnswer: Joi.string().required(),
  answerType: Joi.string().valid('yesno', 'likedislike', 'mcq', 'rating').default('yesno'),
  sessionId: Joi.string().required()
});

// Helper to generate session ID for guest users
const generateGuestSessionId = () => {
  return 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Submit a response (authenticated or guest)
router.post('/', async (req, res) => {
  try {
    const { error, value } = responseSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { questionId, selectedAnswer, answerType, sessionId } = value;

    // Verify question exists and is active
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    if (!question.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This question is no longer active'
      });
    }

    // Prepare response data
    const responseData = {
      questionId,
      selectedAnswer,
      answerType: answerType || question.type,
      sessionId
    };

    // Add user ID if authenticated
    if (req.user) {
      responseData.userId = req.user._id;
    } else {
      // For guest users, use the sessionId as identifier
      responseData.userId = null;
    }

    // Try to create or update response (upsert)
    let response;
    try {
      response = await Response.create(responseData);

      // Increment totalResponses on the question
      await Question.findByIdAndUpdate(questionId, {
        $inc: { totalResponses: 1 }
      });
    } catch (err) {
      // Handle duplicate key error (user already responded)
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'You have already responded to this question'
        });
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      message: 'Response submitted successfully',
      data: response
    });
  } catch (error) {
    console.error('Submit response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit response'
    });
  }
});

// Get response statistics for a question
router.get('/stats/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Get all responses for this question
    const responses = await Response.find({ questionId });
    const totalResponses = responses.length;

    if (totalResponses === 0) {
      return res.status(200).json({
        success: true,
        data: {
          questionId,
          totalResponses: 0,
          stats: {},
          percentages: {}
        }
      });
    }

    // Calculate statistics based on question type
    let stats = {};
    let percentages = {};

    if (question.type === 'yesno' || question.type === 'likedislike') {
      // Count yes/no or like/dislike
      const counts = {};
      responses.forEach(r => {
        counts[r.selectedAnswer] = (counts[r.selectedAnswer] || 0) + 1;
      });

      stats = counts;
      percentages = Object.fromEntries(
        Object.entries(counts).map(([key, count]) => [
          key,
          Math.round((count / totalResponses) * 100)
        ])
      );
    } else if (question.type === 'mcq') {
      // Count MCQ options
      const counts = {};
      question.options.forEach(opt => {
        counts[opt] = 0;
      });

      responses.forEach(r => {
        if (counts[r.selectedAnswer] !== undefined) {
          counts[r.selectedAnswer]++;
        }
      });

      stats = counts;
      percentages = Object.fromEntries(
        Object.entries(counts).map(([key, count]) => [
          key,
          Math.round((count / totalResponses) * 100)
        ])
      );
    } else if (question.type === 'rating') {
      // Calculate rating statistics
      const ratings = responses.map(r => parseInt(r.selectedAnswer));
      const sum = ratings.reduce((a, b) => a + b, 0);
      const avg = sum / totalResponses;
      const min = Math.min(...ratings);
      const max = Math.max(...ratings);

      // Count distribution
      const distribution = {};
      for (let i = 1; i <= 10; i++) {
        distribution[i] = ratings.filter(r => r === i).length;
      }

      stats = {
        average: Math.round(avg * 10) / 10,
        min,
        max,
        distribution
      };

      percentages = Object.fromEntries(
        Object.entries(distribution).map(([key, count]) => [
          key,
          Math.round((count / totalResponses) * 100)
        ])
      );
    }

    res.status(200).json({
      success: true,
      data: {
        questionId,
        totalResponses,
        questionType: question.type,
        stats,
        percentages
      }
    });
  } catch (error) {
    console.error('Get response stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch response statistics'
    });
  }
});

// Check if user has responded to a question
router.get('/check/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const existingResponse = await Response.findOne({
      questionId,
      sessionId
    });

    res.status(200).json({
      success: true,
      hasResponded: !!existingResponse,
      data: existingResponse || null
    });
  } catch (error) {
    console.error('Check response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check response status'
    });
  }
});

// Get guest session ID (creates one if not exists)
router.post('/session', (req, res) => {
  const sessionId = generateGuestSessionId();
  res.status(200).json({
    success: true,
    sessionId
  });
});

module.exports = router;