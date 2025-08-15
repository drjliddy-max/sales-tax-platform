import express from 'express';
import { FirecrawlService, ComplianceMonitor, TaxRateScheduler, TaxRateAuditLogger } from '@/services/tax-data-collection';
import { validateRequest } from '@/api/middleware';
import Joi from 'joi';

const router = express.Router();

const manualUpdateSchema = Joi.object({
  states: Joi.array().items(Joi.string().length(2).uppercase()).optional(),
  jurisdiction: Joi.string().optional(),
  force: Joi.boolean().default(false)
});

const scheduleSchema = Joi.object({
  cronExpression: Joi.string().required(),
  description: Joi.string().min(5).max(100).required()
});

const firecrawlService = new FirecrawlService();
const complianceMonitor = new ComplianceMonitor();
const scheduler = new TaxRateScheduler();
const auditLogger = new TaxRateAuditLogger();

// Manual tax rate update
router.post('/manual-update', validateRequest(manualUpdateSchema), async (req, res, next) => {
  try {
    const { states, jurisdiction, force } = req.body;
    
    let result;
    if (jurisdiction && states && states.length === 1) {
      const taxData = await firecrawlService.crawlSpecificJurisdiction(states[0], jurisdiction);
      const updateCount = await firecrawlService.updateTaxRatesInDatabase(taxData);
      result = {
        success: true,
        updatedRates: updateCount,
        jurisdiction: `${jurisdiction}, ${states[0]}`,
        timestamp: new Date()
      };
    } else {
      result = await scheduler.manualUpdate(states);
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get compliance alerts
router.get('/compliance-alerts', async (req, res, next) => {
  try {
    const { state, severity, days = 30 } = req.query;
    
    const alerts = await complianceMonitor.performComplianceCheck();
    
    let filteredAlerts = alerts;
    
    if (state) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.affectedStates.includes(state as string)
      );
    }
    
    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.severity === severity
      );
    }
    
    const daysCutoff = new Date();
    daysCutoff.setDate(daysCutoff.getDate() - Number(days));
    
    filteredAlerts = filteredAlerts.filter(alert => 
      alert.createdAt >= daysCutoff
    );
    
    res.json({
      alerts: filteredAlerts,
      summary: {
        total: filteredAlerts.length,
        critical: filteredAlerts.filter(a => a.severity === 'critical').length,
        high: filteredAlerts.filter(a => a.severity === 'high').length,
        medium: filteredAlerts.filter(a => a.severity === 'medium').length,
        low: filteredAlerts.filter(a => a.severity === 'low').length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get audit trail
router.get('/audit-trail', async (req, res, next) => {
  try {
    const { state, jurisdiction, startDate, endDate, eventType } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const auditTrail = await auditLogger.getAuditTrail(
      state as string,
      jurisdiction as string,
      start,
      end,
      eventType as string
    );
    
    res.json({
      auditTrail,
      count: auditTrail.length
    });
  } catch (error) {
    next(error);
  }
});

// Generate audit report
router.get('/audit-report', async (req, res, next) => {
  try {
    const { startDate, endDate, state } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({
        error: 'startDate and endDate are required'
      });
      return;
    }
    
    const report = await auditLogger.generateAuditReport(
      new Date(startDate as string),
      new Date(endDate as string),
      state as string
    );
    
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Get scheduler status
router.get('/scheduler-status', async (req, res, next) => {
  try {
    const status = scheduler.getScheduleStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Create custom schedule
router.post('/schedule', validateRequest(scheduleSchema), async (req, res, next) => {
  try {
    const { cronExpression, description } = req.body;
    
    const taskId = await scheduler.scheduleCustomUpdate(cronExpression, description);
    
    res.status(201).json({
      success: true,
      taskId,
      cronExpression,
      description,
      created: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Remove custom schedule
router.delete('/schedule/:taskId', async (req, res, next) => {
  try {
    const { taskId } = req.params;
    
    const removed = scheduler.removeCustomSchedule(taskId);
    
    if (removed) {
      res.json({
        success: true,
        message: `Schedule ${taskId} removed`
      });
    } else {
      res.status(404).json({
        error: 'Schedule not found or cannot be removed'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Emergency mode controls
router.post('/emergency-mode', async (req, res, next) => {
  try {
    await scheduler.enableEmergencyMode();
    res.json({
      success: true,
      message: 'Emergency mode enabled - hourly updates activated',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/emergency-mode', async (req, res, next) => {
  try {
    await scheduler.disableEmergencyMode();
    res.json({
      success: true,
      message: 'Emergency mode disabled',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Get sources needing update
router.get('/sources-status', async (req, res, next) => {
  try {
    const sourcesNeedingUpdate = await firecrawlService.getSourcesNeedingUpdate();
    
    res.json({
      sourcesNeedingUpdate,
      count: sourcesNeedingUpdate.length,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Approve pending audit log
router.post('/audit/:logId/approve', async (req, res, next) => {
  try {
    const { logId } = req.params;
    const { reviewNotes } = req.body;
    const reviewedBy = req.headers['x-user-id'] as string || 'system';
    
    const approved = await auditLogger.approveAuditLog(logId, reviewedBy, reviewNotes);
    
    if (approved) {
      res.json({
        success: true,
        message: 'Audit log approved'
      });
    } else {
      res.status(404).json({
        error: 'Audit log not found'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get pending reviews
router.get('/pending-reviews', async (req, res, next) => {
  try {
    const { state } = req.query;
    
    const pendingReviews = await auditLogger.getPendingReviews(state as string);
    
    res.json({
      pendingReviews,
      count: pendingReviews.length
    });
  } catch (error) {
    next(error);
  }
});

export default router;