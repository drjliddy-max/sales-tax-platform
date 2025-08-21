"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const clerk_1 = require("@/middleware/clerk");
const auth_1 = require("@/middleware/auth");
const SchedulerService_1 = require("@/services/migration/SchedulerService");
const router = express_1.default.Router();
router.use(clerk_1.requireAuth);
router.use(auth_1.protectAdminRoute);
const schedulerService = new SchedulerService_1.SchedulerService();
const scheduledOperationSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    name: joi_1.default.string().required(),
    description: joi_1.default.string().optional(),
    type: joi_1.default.string().valid('backup', 'migration', 'validation', 'cleanup').required(),
    schedule: joi_1.default.object({
        cronExpression: joi_1.default.string().required(),
        timezone: joi_1.default.string().default('UTC'),
        enabled: joi_1.default.boolean().default(true)
    }).required(),
    config: joi_1.default.object().required(),
    retentionDays: joi_1.default.number().min(1).max(365).default(30),
    notifications: joi_1.default.object({
        onSuccess: joi_1.default.boolean().default(false),
        onFailure: joi_1.default.boolean().default(true),
        recipients: joi_1.default.array().items(joi_1.default.string().email()).default([])
    }).optional()
});
const automationRuleSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    name: joi_1.default.string().required(),
    description: joi_1.default.string().required(),
    trigger: joi_1.default.object({
        type: joi_1.default.string().valid('schedule', 'event', 'threshold', 'manual').required(),
        condition: joi_1.default.string().required(),
        parameters: joi_1.default.object().default({})
    }).required(),
    actions: joi_1.default.array().items(joi_1.default.object({
        type: joi_1.default.string().valid('backup', 'validate', 'cleanup', 'notify', 'migrate').required(),
        config: joi_1.default.object().required(),
        order: joi_1.default.number().required()
    })).required(),
    enabled: joi_1.default.boolean().default(true)
});
router.post('/schedule', async (req, res) => {
    try {
        const { error, value } = scheduledOperationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const scheduleData = {
            ...value,
            createdBy: req.user.id
        };
        const schedule = await schedulerService.createScheduledOperation(scheduleData);
        res.json({
            success: true,
            data: schedule
        });
    }
    catch (error) {
        console.error('Error creating scheduled operation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create scheduled operation'
        });
    }
});
router.get('/schedules/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const schedules = await schedulerService.getScheduledOperations(tenantId);
        res.json({
            success: true,
            data: schedules
        });
    }
    catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch schedules'
        });
    }
});
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
    }
    catch (error) {
        console.error('Error updating scheduled operation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update scheduled operation'
        });
    }
});
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
    }
    catch (error) {
        console.error('Error deleting scheduled operation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete scheduled operation'
        });
    }
});
router.post('/schedule/:id/trigger', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const progress = await schedulerService.triggerScheduledOperation(scheduleId);
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        console.error('Error triggering scheduled operation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger scheduled operation'
        });
    }
});
router.post('/schedule/:id/pause', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const success = await schedulerService.pauseSchedule(scheduleId);
        res.json({
            success: true,
            data: { paused: success }
        });
    }
    catch (error) {
        console.error('Error pausing schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to pause schedule'
        });
    }
});
router.post('/schedule/:id/resume', async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const success = await schedulerService.resumeSchedule(scheduleId);
        res.json({
            success: true,
            data: { resumed: success }
        });
    }
    catch (error) {
        console.error('Error resuming schedule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resume schedule'
        });
    }
});
router.get('/scheduler/stats/:tenantId?', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const stats = await schedulerService.getSchedulerStats(tenantId);
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        console.error('Error fetching scheduler stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scheduler stats'
        });
    }
});
router.get('/scheduler/health', async (req, res) => {
    try {
        const health = await schedulerService.getScheduleHealth();
        res.json({
            success: true,
            data: health
        });
    }
    catch (error) {
        console.error('Error fetching scheduler health:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scheduler health'
        });
    }
});
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
    }
    catch (error) {
        console.error('Error creating automation rule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create automation rule'
        });
    }
});
router.get('/automation/rules/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const rules = await schedulerService.getAutomationRules(tenantId);
        res.json({
            success: true,
            data: rules
        });
    }
    catch (error) {
        console.error('Error fetching automation rules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch automation rules'
        });
    }
});
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
    }
    catch (error) {
        console.error('Error updating automation rule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update automation rule'
        });
    }
});
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
    }
    catch (error) {
        console.error('Error deleting automation rule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete automation rule'
        });
    }
});
router.post('/automation/rules/:id/trigger', async (req, res) => {
    try {
        const ruleId = req.params.id;
        const success = await schedulerService.triggerAutomationRule(ruleId);
        res.json({
            success: true,
            data: { triggered: success }
        });
    }
    catch (error) {
        console.error('Error triggering automation rule:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to trigger automation rule'
        });
    }
});
exports.default = router;
//# sourceMappingURL=scheduler.js.map