const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Survey = require('../models/Survey');
const { auth } = require('../middleware/auth');

// Validation schema for survey
const surveySchema = Joi.object({
  surveyType: Joi.string().required(),
  formData: Joi.object().required(),
  location: Joi.object({
    type: Joi.string().valid('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2)
  }),
  photos: Joi.array().items(Joi.string()),
  signature: Joi.string().allow('', null),
  status: Joi.string().valid('draft', 'completed'),
  localId: Joi.string()
});

// Get all surveys for user
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const query = { userId: req.user._id };

    if (status) {
      query.status = status;
    }

    const total = await Survey.countDocuments(query);
    const surveys = await Survey.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: surveys,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get surveys error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch surveys.'
    });
  }
});

// Get single survey
router.get('/:id', auth, async (req, res) => {
  try {
    const survey = await Survey.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: survey
    });
  } catch (error) {
    console.error('Get survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch survey.'
    });
  }
});

// Create new survey
router.post('/', auth, async (req, res) => {
  try {
    const { error, value } = surveySchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const survey = await Survey.create({
      ...value,
      userId: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Survey created successfully',
      data: survey
    });
  } catch (error) {
    console.error('Create survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create survey.'
    });
  }
});

// Update survey
router.put('/:id', auth, async (req, res) => {
  try {
    const { error, value } = surveySchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const survey = await Survey.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { ...value, completedAt: value.status === 'completed' ? new Date() : undefined },
      { new: true, runValidators: true }
    );

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Survey updated successfully',
      data: survey
    });
  } catch (error) {
    console.error('Update survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update survey.'
    });
  }
});

// Delete survey (only drafts)
router.delete('/:id', auth, async (req, res) => {
  try {
    const survey = await Survey.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
      status: 'draft'
    });

    if (!survey) {
      return res.status(404).json({
        success: false,
        message: 'Survey not found or cannot delete completed surveys.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Survey deleted successfully'
    });
  } catch (error) {
    console.error('Delete survey error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete survey.'
    });
  }
});

// Get survey stats
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const [total, completed, draft, synced] = await Promise.all([
      Survey.countDocuments({ userId }),
      Survey.countDocuments({ userId, status: 'completed' }),
      Survey.countDocuments({ userId, status: 'draft' }),
      Survey.countDocuments({ userId, status: 'synced' })
    ]);

    // Get today's count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Survey.countDocuments({
      userId,
      createdAt: { $gte: today }
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        completed,
        draft,
        synced,
        todayCount
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics.'
    });
  }
});

module.exports = router;