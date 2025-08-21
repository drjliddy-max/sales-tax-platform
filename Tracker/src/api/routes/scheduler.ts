import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/middleware/clerk';
import { protectAdminRoute } from '@/middleware/auth';
import { SchedulerService } from '@/services/migration/SchedulerService';

const router = express.Router();

// Apply authentication to all scheduler routes
router.use(requireAuth);
router.use(protectAdminRoute); // Only admins can access scheduler utilities

// Initialize service
const schedulerService = new SchedulerService();

// Validation schemas
const scheduledOperationSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  type: Joi.string().valid('backup', 'migration', 'validation', 'cleanup').required(),
  schedule: Joi.object({
    cronExpression: Joi.string().required(),
    timezone: Joi.string().default('UTC'),
    enabled: Joi.boolean().default(true)
  }).required(),
  config: Joi.object().required(),
  retentionDays: Joi.number().min(1).max(365).default(30),
  notifications: Joi.object({
    onSuccess: Joi.boolean().default(false),
    onFailure: Joi.boolean().default(true),
    recipients: Joi.array().items(Joi.string().email()).default([])
  }).optional()
});

const automationRuleSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  trigger: Joi.object({
    type: Joi.string().valid('schedule', 'event', 'threshold', 'manual').required(),
    condition: Joi.string().required(),
    parameters: Joi.object().default({})
  }).required(),
  actions: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('backup', 'validate', 'cleanup', 'notify', 'migrate').required(),
      config: Joi.object().required(),
      order: Joi.number().required()
    })
  ).required(),
  enabled: Joi.boolean().default(true)
});

// ========================
// SCHEDULED OPERATION ROUTES
// ========================

// POST /api/migration/schedule - Create scheduled operation
router.post('/schedule', async (req, res) => {
  try {
    const { error, value } = scheduledOperationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Add createdBy to the schedule data
    const scheduleData = {
      ...value,
      createdBy: req.user.id
    };

    const schedule = await schedulerService.createScheduledOperation(scheduleData);

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Error creating scheduled operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create scheduled operation'
    });
  }
});

// GET /api/migration/schedules/:tenantId - Get tenant schedules
router.get('/schedules/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const schedules = await schedulerService.getScheduledOperations(tenantId);

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedules'
    });
  }
});

// PUT /api/migration/schedule/:id - Update scheduled operation
router.put('/schedule/:id', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const { error, value } = scheduledOperationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const schedule = await schedulerService.updateScheduledOperation(scheduleId, value);

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    console.error('Error updating scheduled operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scheduled operation'
    });
  }
});

// DELETE /api/migration/schedule/:id - Delete scheduled operation
router.delete('/schedule/:id', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const success = await schedulerService.deleteScheduledOperation(scheduleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled operation not found'
      });
    }

    res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('Error deleting scheduled operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete scheduled operation'
    });
  }
});

// POST /api/migration/schedule/:id/trigger - Trigger scheduled operation manually
router.post('/schedule/:id/trigger', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const progress = await schedulerService.triggerScheduledOperation(scheduleId);

    res.json({
      success: true,
      data: progress
    });
  } catch (error) {
    console.error('Error triggering scheduled operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scheduled operation'
    });
  }
});

// POST /api/migration/schedule/:id/pause - Pause schedule
router.post('/schedule/:id/pause', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const success = await schedulerService.pauseSchedule(scheduleId);

    res.json({
      success: true,
      data: { paused: success }
    });
  } catch (error) {
    console.error('Error pausing schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause schedule'
    });
  }
});

// POST /api/migration/schedule/:id/resume - Resume schedule
router.post('/schedule/:id/resume', async (req, res) => {
  try {
    const scheduleId = req.params.id;
    const success = await schedulerService.resumeSchedule(scheduleId);

    res.json({
      success: true,
      data: { resumed: success }
    });
  } catch (error) {
    console.error('Error resuming schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume schedule'
    });
  }
});

// GET /api/migration/scheduler/stats/:tenantId? - Get scheduler statistics
router.get('/scheduler/stats/:tenantId?', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const stats = await schedulerService.getSchedulerStats(tenantId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching scheduler stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduler stats'
    });
  }
});

// GET /api/migration/scheduler/health - Get scheduler health
router.get('/scheduler/health', async (req, res) => {
  try {
    const health = await schedulerService.getScheduleHealth();

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error fetching scheduler health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduler health'
    });
  }
});

// ======================
// AUTOMATION RULE ROUTES
// ======================

// POST /api/migration/automation/rules - Create automation rule
router.post('/automation/rules', async (req, res) => {
  try {
    const { error, value } = automationRuleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const rule = await schedulerService.createAutomationRule(value);

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create automation rule'
    });
  }
});

// GET /api/migration/automation/rules/:tenantId - Get automation rules
router.get('/automation/rules/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const rules = await schedulerService.getAutomationRules(tenantId);

    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch automation rules'
    });
  }
});

// PUT /api/migration/automation/rules/:id - Update automation rule
router.put('/automation/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const { error, value } = automationRuleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const rule = await schedulerService.updateAutomationRule(ruleId, value);

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update automation rule'
    });
  }
});

// DELETE /api/migration/automation/rules/:id - Delete automation rule
router.delete('/automation/rules/:id', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const success = await schedulerService.deleteAutomationRule(ruleId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Automation rule not found'
      });
    }

    res.json({
      success: true,
      data: { deleted: true }
    });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete automation rule'
    });
  }
});

// POST /api/migration/automation/rules/:id/trigger - Trigger automation rule
router.post('/automation/rules/:id/trigger', async (req, res) => {
  try {
    const ruleId = req.params.id;
    const success = await schedulerService.triggerAutomationRule(ruleId);

    res.json({
      success: true,
      data: { triggered: success }
    });
  } catch (error) {
    console.error('Error triggering automation rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger automation rule'
    });
  }
});

export default router;