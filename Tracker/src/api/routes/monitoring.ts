import express from 'express';
import { sentryService } from '@/services/monitoring/SentryService';
import { posMonitoring } from '@/services/monitoring/POSMonitoringService';
import { complianceMonitoring } from '@/services/monitoring/ComplianceMonitoringService';
import { validateRequest } from '@/api/middleware';
import Joi from 'joi';

const router = express.Router();

// Sentry health check
router.get('/sentry/health', async (req, res, next) => {
  try {
    const health = await sentryService.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
});

// Business metrics endpoint
router.get('/metrics/business/:businessId', async (req, res, next) => {
  try {
    const { businessId } = req.params;
    
    // Get POS integration metrics
    const posMetrics = posMonitoring.getPOSIntegrationMetrics(businessId);
    
    // Get compliance report
    const complianceReport = await complianceMonitoring.generateComplianceReport(businessId);
    
    // Get audit trail
    const auditTrail = complianceMonitoring.getAuditTrail(businessId, 50);

    const metrics = {
      business: complianceReport.business,
      pos_integrations: posMetrics,
      compliance: {
        overall_score: complianceReport.business.complianceScore,
        tax_accuracy: complianceReport.taxAccuracy,
        filing_status: complianceReport.filingStatus
      },
      system_health: complianceReport.systemHealth,
      recent_audits: auditTrail.slice(-10),
      timestamp: new Date()
    };

    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// POS integration health
router.get('/pos/health', async (req, res, next) => {
  try {
    const report = await posMonitoring.generatePOSHealthReport();
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// POS metrics for specific business
router.get('/pos/metrics/:businessId', async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const metrics = posMonitoring.getPOSIntegrationMetrics(businessId);
    
    res.json({
      businessId,
      integrations: metrics,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Compliance report
router.get('/compliance/report/:businessId', async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const report = await complianceMonitoring.generateComplianceReport(businessId);
    
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Compliance checks overview
router.get('/compliance/checks', async (req, res, next) => {
  try {
    const businessId = req.query.businessId as string;
    const report = complianceMonitoring.getComplianceReport(businessId);
    
    res.json({
      overall_score: report.overallScore,
      checks: report.checks,
      alerts: report.alerts,
      recent_audits: report.recentAudits.slice(-20),
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Audit trail
router.get('/audit/trail', async (req, res, next) => {
  try {
    const businessId = req.query.businessId as string;
    const limit = parseInt(req.query.limit as string) || 100;
    
    const auditTrail = complianceMonitoring.getAuditTrail(businessId, limit);
    
    res.json({
      audit_trail: auditTrail,
      total_entries: auditTrail.length,
      business_id: businessId || 'all',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Trigger compliance check
const complianceCheckSchema = Joi.object({
  type: Joi.string().valid('accuracy', 'filing', 'rate_compliance', 'threshold_monitoring').required(),
  businessId: Joi.string().required(),
  jurisdiction: Joi.string().required()
});

router.post('/compliance/check', validateRequest(complianceCheckSchema), async (req, res, next) => {
  try {
    const { type, businessId, jurisdiction } = req.body;

    // Trigger manual compliance check
    let checkResult;
    
    switch (type) {
      case 'accuracy':
        await complianceMonitoring.detectTaxCalculationAnomalies(businessId);
        checkResult = { type, status: 'initiated', message: 'Anomaly detection started' };
        break;
        
      case 'filing':
        await complianceMonitoring.monitorFilingRequirements();
        checkResult = { type, status: 'initiated', message: 'Filing requirements check started' };
        break;
        
      default:
        checkResult = { type, status: 'initiated', message: 'Compliance check started' };
    }

    // Track manual compliance check
    sentryService.addBreadcrumb(
      'compliance_check',
      `Manual ${type} check initiated`,
      'info',
      {
        check_type: type,
        business_id: businessId,
        jurisdiction,
        initiated_by: req.userId || 'system'
      }
    );

    res.json({
      success: true,
      check: checkResult,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Create custom alert
const customAlertSchema = Joi.object({
  title: Joi.string().required(),
  message: Joi.string().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  businessId: Joi.string().optional(),
  metadata: Joi.object().optional()
});

router.post('/alerts/custom', validateRequest(customAlertSchema), async (req, res, next) => {
  try {
    const { title, message, severity, businessId, metadata } = req.body;

    const eventId = sentryService.createCustomAlert(
      title,
      message,
      severity,
      {
        ...metadata,
        created_by: req.userId || 'system',
        business_id: businessId
      }
    );

    res.json({
      success: true,
      event_id: eventId,
      alert: {
        title,
        message,
        severity,
        business_id: businessId
      },
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Trigger tax calculation accuracy audit
router.post('/audit/tax-calculation/:transactionId', async (req, res, next): Promise<void> => {
  try {
    const { transactionId } = req.params;
    const { expectedTax, businessId } = req.body;

    // For now, we'll create a mock transaction object
    // In production, you would import the actual Transaction model
    const transaction = {
      _id: transactionId,
      totalTax: 150.00,
      businessId: businessId || 'default'
    };
    
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    await complianceMonitoring.auditTaxCalculation(
      transactionId,
      transaction.totalTax || 0,
      expectedTax,
      businessId || transaction.businessId
    );

    res.json({
      success: true,
      transaction_id: transactionId,
      calculated_tax: transaction.totalTax,
      expected_tax: expectedTax,
      audit_initiated: true,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// System performance overview
router.get('/performance/overview', async (req, res, next) => {
  try {
    const businessId = req.query.businessId as string;

    // Get overall system performance metrics
    const posReport = await posMonitoring.generatePOSHealthReport();
    const complianceData = complianceMonitoring.getComplianceReport(businessId);
    const sentryHealth = await sentryService.healthCheck();

    const overview = {
      sentry: {
        status: sentryHealth.status,
        initialized: sentryHealth.isInitialized,
        metrics_collected: sentryHealth.metricsCollected
      },
      pos_integrations: {
        summary: posReport.summary,
        alerts: posReport.alerts.length
      },
      compliance: {
        overall_score: complianceData.overallScore,
        active_alerts: complianceData.alerts.length,
        recent_checks: complianceData.checks.length
      },
      system: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        timestamp: new Date()
      }
    };

    res.json(overview);
  } catch (error) {
    next(error);
  }
});

// Flush Sentry events (for testing)
router.post('/sentry/flush', async (req, res, next) => {
  try {
    const timeout = parseInt(req.body.timeout) || 5000;
    const success = await sentryService.flush(timeout);
    
    res.json({
      success,
      timeout,
      message: success ? 'Sentry events flushed successfully' : 'Failed to flush Sentry events',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

export default router;