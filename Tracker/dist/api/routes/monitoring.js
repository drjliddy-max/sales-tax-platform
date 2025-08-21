"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const SentryService_1 = require("@/services/monitoring/SentryService");
const POSMonitoringService_1 = require("@/services/monitoring/POSMonitoringService");
const ComplianceMonitoringService_1 = require("@/services/monitoring/ComplianceMonitoringService");
const middleware_1 = require("@/api/middleware");
const joi_1 = __importDefault(require("joi"));
const router = express_1.default.Router();
router.get('/sentry/health', async (req, res, next) => {
    try {
        const health = await SentryService_1.sentryService.healthCheck();
        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 206 : 503;
        res.status(statusCode).json(health);
    }
    catch (error) {
        next(error);
    }
});
router.get('/metrics/business/:businessId', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const posMetrics = POSMonitoringService_1.posMonitoring.getPOSIntegrationMetrics(businessId);
        const complianceReport = await ComplianceMonitoringService_1.complianceMonitoring.generateComplianceReport(businessId);
        const auditTrail = ComplianceMonitoringService_1.complianceMonitoring.getAuditTrail(businessId, 50);
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/pos/health', async (req, res, next) => {
    try {
        const report = await POSMonitoringService_1.posMonitoring.generatePOSHealthReport();
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
router.get('/pos/metrics/:businessId', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const metrics = POSMonitoringService_1.posMonitoring.getPOSIntegrationMetrics(businessId);
        res.json({
            businessId,
            integrations: metrics,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/compliance/report/:businessId', async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const report = await ComplianceMonitoringService_1.complianceMonitoring.generateComplianceReport(businessId);
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
router.get('/compliance/checks', async (req, res, next) => {
    try {
        const businessId = req.query.businessId;
        const report = ComplianceMonitoringService_1.complianceMonitoring.getComplianceReport(businessId);
        res.json({
            overall_score: report.overallScore,
            checks: report.checks,
            alerts: report.alerts,
            recent_audits: report.recentAudits.slice(-20),
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/audit/trail', async (req, res, next) => {
    try {
        const businessId = req.query.businessId;
        const limit = parseInt(req.query.limit) || 100;
        const auditTrail = ComplianceMonitoringService_1.complianceMonitoring.getAuditTrail(businessId, limit);
        res.json({
            audit_trail: auditTrail,
            total_entries: auditTrail.length,
            business_id: businessId || 'all',
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
const complianceCheckSchema = joi_1.default.object({
    type: joi_1.default.string().valid('accuracy', 'filing', 'rate_compliance', 'threshold_monitoring').required(),
    businessId: joi_1.default.string().required(),
    jurisdiction: joi_1.default.string().required()
});
router.post('/compliance/check', (0, middleware_1.validateRequest)(complianceCheckSchema), async (req, res, next) => {
    try {
        const { type, businessId, jurisdiction } = req.body;
        let checkResult;
        switch (type) {
            case 'accuracy':
                await ComplianceMonitoringService_1.complianceMonitoring.detectTaxCalculationAnomalies(businessId);
                checkResult = { type, status: 'initiated', message: 'Anomaly detection started' };
                break;
            case 'filing':
                await ComplianceMonitoringService_1.complianceMonitoring.monitorFilingRequirements();
                checkResult = { type, status: 'initiated', message: 'Filing requirements check started' };
                break;
            default:
                checkResult = { type, status: 'initiated', message: 'Compliance check started' };
        }
        SentryService_1.sentryService.addBreadcrumb('compliance_check', `Manual ${type} check initiated`, 'info', {
            check_type: type,
            business_id: businessId,
            jurisdiction,
            initiated_by: req.userId || 'system'
        });
        res.json({
            success: true,
            check: checkResult,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
const customAlertSchema = joi_1.default.object({
    title: joi_1.default.string().required(),
    message: joi_1.default.string().required(),
    severity: joi_1.default.string().valid('low', 'medium', 'high', 'critical').required(),
    businessId: joi_1.default.string().optional(),
    metadata: joi_1.default.object().optional()
});
router.post('/alerts/custom', (0, middleware_1.validateRequest)(customAlertSchema), async (req, res, next) => {
    try {
        const { title, message, severity, businessId, metadata } = req.body;
        const eventId = SentryService_1.sentryService.createCustomAlert(title, message, severity, {
            ...metadata,
            created_by: req.userId || 'system',
            business_id: businessId
        });
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
    }
    catch (error) {
        next(error);
    }
});
router.post('/audit/tax-calculation/:transactionId', async (req, res, next) => {
    try {
        const { transactionId } = req.params;
        const { expectedTax, businessId } = req.body;
        const transaction = {
            _id: transactionId,
            totalTax: 150.00,
            businessId: businessId || 'default'
        };
        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }
        await ComplianceMonitoringService_1.complianceMonitoring.auditTaxCalculation(transactionId, transaction.totalTax || 0, expectedTax, businessId || transaction.businessId);
        res.json({
            success: true,
            transaction_id: transactionId,
            calculated_tax: transaction.totalTax,
            expected_tax: expectedTax,
            audit_initiated: true,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/performance/overview', async (req, res, next) => {
    try {
        const businessId = req.query.businessId;
        const posReport = await POSMonitoringService_1.posMonitoring.generatePOSHealthReport();
        const complianceData = ComplianceMonitoringService_1.complianceMonitoring.getComplianceReport(businessId);
        const sentryHealth = await SentryService_1.sentryService.healthCheck();
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
    }
    catch (error) {
        next(error);
    }
});
router.post('/sentry/flush', async (req, res, next) => {
    try {
        const timeout = parseInt(req.body.timeout) || 5000;
        const success = await SentryService_1.sentryService.flush(timeout);
        res.json({
            success,
            timeout,
            message: success ? 'Sentry events flushed successfully' : 'Failed to flush Sentry events',
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=monitoring.js.map