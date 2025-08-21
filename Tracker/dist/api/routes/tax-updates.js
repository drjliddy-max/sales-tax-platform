"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tax_data_collection_1 = require("@/services/tax-data-collection");
const middleware_1 = require("@/api/middleware");
const joi_1 = __importDefault(require("joi"));
const router = express_1.default.Router();
const manualUpdateSchema = joi_1.default.object({
    states: joi_1.default.array().items(joi_1.default.string().length(2).uppercase()).optional(),
    jurisdiction: joi_1.default.string().optional(),
    force: joi_1.default.boolean().default(false)
});
const scheduleSchema = joi_1.default.object({
    cronExpression: joi_1.default.string().required(),
    description: joi_1.default.string().min(5).max(100).required()
});
const firecrawlService = new tax_data_collection_1.FirecrawlService();
const complianceMonitor = new tax_data_collection_1.ComplianceMonitor();
const scheduler = new tax_data_collection_1.TaxRateScheduler();
const auditLogger = new tax_data_collection_1.TaxRateAuditLogger();
router.post('/manual-update', (0, middleware_1.validateRequest)(manualUpdateSchema), async (req, res, next) => {
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
        }
        else {
            result = await scheduler.manualUpdate(states);
        }
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/compliance-alerts', async (req, res, next) => {
    try {
        const { state, severity, days = 30 } = req.query;
        const alerts = await complianceMonitor.performComplianceCheck();
        let filteredAlerts = alerts;
        if (state) {
            filteredAlerts = filteredAlerts.filter(alert => alert.affectedStates.includes(state));
        }
        if (severity) {
            filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
        }
        const daysCutoff = new Date();
        daysCutoff.setDate(daysCutoff.getDate() - Number(days));
        filteredAlerts = filteredAlerts.filter(alert => alert.createdAt >= daysCutoff);
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/audit-trail', async (req, res, next) => {
    try {
        const { state, jurisdiction, startDate, endDate, eventType } = req.query;
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const auditTrail = await auditLogger.getAuditTrail(state, jurisdiction, start, end, eventType);
        res.json({
            auditTrail,
            count: auditTrail.length
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/audit-report', async (req, res, next) => {
    try {
        const { startDate, endDate, state } = req.query;
        if (!startDate || !endDate) {
            res.status(400).json({
                error: 'startDate and endDate are required'
            });
            return;
        }
        const report = await auditLogger.generateAuditReport(new Date(startDate), new Date(endDate), state);
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
router.get('/scheduler-status', async (req, res, next) => {
    try {
        const status = scheduler.getScheduleStatus();
        res.json(status);
    }
    catch (error) {
        next(error);
    }
});
router.post('/schedule', (0, middleware_1.validateRequest)(scheduleSchema), async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
});
router.delete('/schedule/:taskId', async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const removed = scheduler.removeCustomSchedule(taskId);
        if (removed) {
            res.json({
                success: true,
                message: `Schedule ${taskId} removed`
            });
        }
        else {
            res.status(404).json({
                error: 'Schedule not found or cannot be removed'
            });
        }
    }
    catch (error) {
        next(error);
    }
});
router.post('/emergency-mode', async (req, res, next) => {
    try {
        await scheduler.enableEmergencyMode();
        res.json({
            success: true,
            message: 'Emergency mode enabled - hourly updates activated',
            timestamp: new Date()
        });
    }
    catch (error) {
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
    }
    catch (error) {
        next(error);
    }
});
router.get('/sources-status', async (req, res, next) => {
    try {
        const sourcesNeedingUpdate = await firecrawlService.getSourcesNeedingUpdate();
        res.json({
            sourcesNeedingUpdate,
            count: sourcesNeedingUpdate.length,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/audit/:logId/approve', async (req, res, next) => {
    try {
        const { logId } = req.params;
        const { reviewNotes } = req.body;
        const reviewedBy = req.headers['x-user-id'] || 'system';
        const approved = await auditLogger.approveAuditLog(logId, reviewedBy, reviewNotes);
        if (approved) {
            res.json({
                success: true,
                message: 'Audit log approved'
            });
        }
        else {
            res.status(404).json({
                error: 'Audit log not found'
            });
        }
    }
    catch (error) {
        next(error);
    }
});
router.get('/pending-reviews', async (req, res, next) => {
    try {
        const { state } = req.query;
        const pendingReviews = await auditLogger.getPendingReviews(state);
        res.json({
            pendingReviews,
            count: pendingReviews.length
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=tax-updates.js.map