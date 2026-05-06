const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Question = require('../models/Question');
const { auth } = require('../middleware/auth');

// Validation schema for question
const questionSchema = Joi.object({
  questionText: Joi.string().required().max(1000),
  type: Joi.string().valid('yesno', 'likedislike', 'mcq', 'rating').required(),
  options: Joi.array().items(Joi.string().max(200)),
  isActive: Joi.boolean().default(true)
});

// Get all active questions
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;

    const query = { isActive: true };
    if (type) {
      query.type = type;
    }

    const total = await Question.countDocuments(query);
    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: questions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions'
    });
  }
});

// Get random question for swipe feed
router.get('/random', async (req, res) => {
  try {
    const { exclude } = req.query;
    const excludeIds = exclude ? exclude.split(',') : [];

    const query = { isActive: true };
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds };
    }

    const count = await Question.countDocuments(query);
    if (count === 0) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No more questions available'
      });
    }

    const random = Math.floor(Math.random() * count);
    const question = await Question.findOne(query).skip(random);

    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Get random question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch random question'
    });
  }
});

// Get multiple questions for swipe feed
router.get('/feed', async (req, res) => {
  try {
    const { limit = 10, exclude } = req.query;
    const excludeIds = exclude ? exclude.split(',') : [];

    const query = { isActive: true };
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds };
    }

    const questions = await Question.find(query)
      .sort({ totalResponses: -1, createdAt: -1 }) // Prioritize questions with responses
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: questions
    });
  } catch (error) {
    console.error('Get questions feed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch questions feed'
    });
  }
});

// Get single question
router.get('/:id', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    res.status(200).json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch question'
    });
  }
});

// Create new question (authenticated)
router.post('/', auth, async (req, res) => {
  try {
    const { error, value } = questionSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // For MCQ type, options are required
    if (value.type === 'mcq' && (!value.options || value.options.length < 2)) {
      return res.status(400).json({
        success: false,
        message: 'MCQ questions must have at least 2 options'
      });
    }

    const question = await Question.create({
      ...value,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: question
    });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create question'
    });
  }
});

// Update question (authenticated)
router.put('/:id', auth, async (req, res) => {
  try {
    const { error, value } = questionSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      value,
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found or not authorized'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      data: question
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update question'
    });
  }
});

// Delete question (authenticated)
router.delete('/:id', auth, async (req, res) => {
  try {
    const question = await Question.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found or not authorized'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete question'
    });
  }
});

module.exports = router;