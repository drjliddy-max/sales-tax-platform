"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const clerk_1 = require("@/middleware/clerk");
const auth_1 = require("@/middleware/auth");
const ValidationService_1 = require("@/services/migration/ValidationService");
const router = express_1.default.Router();
router.use(clerk_1.requireAuth);
router.use(auth_1.protectAdminRoute);
const validationService = new ValidationService_1.ValidationService();
const migrationPlanValidationSchema = joi_1.default.object({
    defaultTenantName: joi_1.default.string().required(),
    defaultTenantSlug: joi_1.default.string().required(),
    assignAllToDefaultTenant: joi_1.default.boolean().default(true),
    businessToTenantMapping: joi_1.default.object().optional(),
    preserveExistingData: joi_1.default.boolean().default(true),
    batchSize: joi_1.default.number().min(1).max(1000).default(100),
    enableProgressTracking: joi_1.default.boolean().default(true),
    createBackup: joi_1.default.boolean().default(true),
    dryRun: joi_1.default.boolean().default(false)
});
const customValidationSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    ruleIds: joi_1.default.array().items(joi_1.default.string()).required()
});
const integrityFixSchema = joi_1.default.object({
    fixOrphanedRecords: joi_1.default.boolean().default(false),
    fixBrokenReferences: joi_1.default.boolean().default(false),
    createMissingRecords: joi_1.default.boolean().default(false),
    deleteInvalidRecords: joi_1.default.boolean().default(false)
});
const scheduleIntegritySchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    cronExpression: joi_1.default.string().required(),
    autoFix: joi_1.default.boolean().default(false),
    notifyOnIssues: joi_1.default.boolean().default(true),
    emailNotifications: joi_1.default.array().items(joi_1.default.string().email()).default([])
});
router.post('/validate-plan', async (req, res) => {
    try {
        const { error, value } = migrationPlanValidationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const result = await validationService.validateMigrationPlan(value);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error validating migration plan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate migration plan'
        });
    }
});
router.get('/validate-tenant/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const report = await validationService.validateTenantData(tenantId);
        res.json({
            success: true,
            data: report
        });
    }
    catch (error) {
        console.error('Error validating tenant data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate tenant data'
        });
    }
});
router.get('/validate-integrity/:tenantId?', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const result = await validationService.validateDataIntegrity(tenantId);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error validating data integrity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate data integrity'
        });
    }
});
router.get('/validate-isolation', async (req, res) => {
    try {
        const result = await validationService.validateTenantIsolation();
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error validating tenant isolation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate tenant isolation'
        });
    }
});
router.post('/validate-batch', async (req, res) => {
    try {
        const result = await validationService.validateBatchMigration(req.body);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error validating batch migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate batch migration'
        });
    }
});
router.post('/validate-post-migration', async (req, res) => {
    try {
        const { tenantId } = req.body;
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'tenantId is required'
            });
        }
        const result = await validationService.validatePostMigration(tenantId);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error validating post-migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate post-migration'
        });
    }
});
router.get('/validation-rules', async (req, res) => {
    try {
        const rules = await validationService.getValidationRules();
        res.json({
            success: true,
            data: rules
        });
    }
    catch (error) {
        console.error('Error getting validation rules:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get validation rules'
        });
    }
});
router.post('/validate-custom', async (req, res) => {
    try {
        const { error, value } = customValidationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const result = await validationService.runCustomValidation(value.tenantId, value.ruleIds);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error running custom validation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run custom validation'
        });
    }
});
router.get('/check-referential-integrity/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const result = await validationService.checkReferentialIntegrity(tenantId);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error checking referential integrity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check referential integrity'
        });
    }
});
router.post('/fix-integrity/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const { error, value } = integrityFixSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const result = await validationService.fixIntegrityIssues(tenantId, value);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error fixing integrity issues:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fix integrity issues'
        });
    }
});
router.post('/schedule-integrity-check', async (req, res) => {
    try {
        const { error, value } = scheduleIntegritySchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const success = await validationService.scheduleIntegrityCheck(value.tenantId, {
            cronExpression: value.cronExpression,
            autoFix: value.autoFix,
            notifyOnIssues: value.notifyOnIssues,
            emailNotifications: value.emailNotifications
        });
        res.json({
            success: true,
            data: { scheduled: success }
        });
    }
    catch (error) {
        console.error('Error scheduling integrity check:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to schedule integrity check'
        });
    }
});
exports.default = router;
//# sourceMappingURL=validation.js.map