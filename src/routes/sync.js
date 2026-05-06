const express = require('express');
const router = express.Router();
const Survey = require('../models/Survey');
const { auth } = require('../middleware/auth');

// Bulk sync endpoint - receives multiple surveys from offline storage
router.post('/', auth, async (req, res) => {
  try {
    const { surveys } = req.body;

    if (!Array.isArray(surveys) || surveys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. surveys array required.'
      });
    }

    const results = {
      created: [],
      updated: [],
      failed: []
    };

    for (const survey of surveys) {
      try {
        if (survey.localId) {
          // Check if survey with this localId already exists
          const existing = await Survey.findOne({
            userId: req.user._id,
            localId: survey.localId
          });

          if (existing) {
            // Update existing survey
            const updated = await Survey.findByIdAndUpdate(
              existing._id,
              {
                surveyType: survey.surveyType,
                formData: survey.formData,
                location: survey.location,
                photos: survey.photos,
                signature: survey.signature,
                status: survey.status || 'synced',
                completedAt: survey.completedAt || new Date()
              },
              { new: true }
            );
            results.updated.push({
              localId: survey.localId,
              serverId: updated._id
            });
          } else {
            // Create new survey
            const created = await Survey.create({
              ...survey,
              userId: req.user._id,
              status: 'synced'
            });
            results.created.push({
              localId: survey.localId,
              serverId: created._id
            });
          }
        } else {
          // Create without localId
          const created = await Survey.create({
            ...survey,
            userId: req.user._id,
            status: 'synced'
          });
          results.created.push({
            localId: null,
            serverId: created._id
          });
        }
      } catch (error) {
        results.failed.push({
          localId: survey.localId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Sync completed',
      data: results,
      summary: {
        total: surveys.length,
        created: results.created.length,
        updated: results.updated.length,
        failed: results.failed.length
      }
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Sync failed. Please try again.'
    });
  }
});

// Get sync status - returns surveys that haven't been synced
router.get('/status', auth, async (req, res) => {
  try {
    const pending = await Survey.countDocuments({
      userId: req.user._id,
      status: { $in: ['draft', 'completed'] }
    });

    const lastSynced = await Survey.findOne({
      userId: req.user._id,
      status: 'synced'
    }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        pendingCount: pending,
        lastSyncedAt: lastSynced?.updatedAt || null
      }
    });
  } catch (error) {
    console.error('Sync status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sync status.'
    });
  }
});

module.exports = router;