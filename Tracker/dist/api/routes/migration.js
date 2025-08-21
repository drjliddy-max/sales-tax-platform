"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const clerk_1 = require("@/middleware/clerk");
const auth_1 = require("@/middleware/auth");
const MigrationService_1 = require("@/services/migration/MigrationService");
const ValidationService_1 = require("@/services/migration/ValidationService");
const BackupService_1 = require("@/services/migration/BackupService");
const SchedulerService_1 = require("@/services/migration/SchedulerService");
const router = express_1.default.Router();
router.use(clerk_1.requireAuth);
router.use(auth_1.protectAdminRoute);
const migrationService = new MigrationService_1.MigrationService();
const validationService = new ValidationService_1.ValidationService();
const backupService = new BackupService_1.BackupService();
const schedulerService = new SchedulerService_1.SchedulerService();
const migrationPlanSchema = joi_1.default.object({
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
const batchMigrationSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    resourceType: joi_1.default.string().valid('businesses', 'transactions', 'reports', 'pos_connections').required(),
    resourceIds: joi_1.default.array().items(joi_1.default.string()).required(),
    batchSize: joi_1.default.number().min(1).max(500).default(100),
    preserveRelationships: joi_1.default.boolean().default(true)
});
const backupConfigSchema = joi_1.default.object({
    includeBusinesses: joi_1.default.boolean().default(true),
    includeTransactions: joi_1.default.boolean().default(true),
    includeReports: joi_1.default.boolean().default(true),
    includePOSConnections: joi_1.default.boolean().default(true),
    includeSettings: joi_1.default.boolean().default(true),
    includeUsers: joi_1.default.boolean().default(true),
    dateRange: joi_1.default.object({
        startDate: joi_1.default.string().isoDate(),
        endDate: joi_1.default.string().isoDate()
    }).optional(),
    compression: joi_1.default.boolean().default(true),
    encryption: joi_1.default.boolean().default(true),
    format: joi_1.default.string().valid('json', 'csv', 'sql').default('json')
});
const scheduledOperationSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    name: joi_1.default.string().required(),
    description: joi_1.default.string().optional(),
    type: joi_1.default.string().valid('backup', 'migration', 'validation', 'cleanup').required(),
    cronExpression: joi_1.default.string().required(),
    timezone: joi_1.default.string().default('UTC'),
    enabled: joi_1.default.boolean().default(true),
    config: joi_1.default.object().required(),
    retentionDays: joi_1.default.number().min(1).max(365).default(30),
    notifications: joi_1.default.object({
        onSuccess: joi_1.default.boolean().default(false),
        onFailure: joi_1.default.boolean().default(true),
        recipients: joi_1.default.array().items(joi_1.default.string().email()).default([])
    }).optional()
});
router.get('/status', async (req, res) => {
    try {
        const status = await migrationService.getSystemStatus();
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
        console.error('Error getting migration status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get migration status'
        });
    }
});
router.get('/analyze', async (req, res) => {
    try {
        const analysis = await migrationService.analyzeSystem();
        res.json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        console.error('Error analyzing system:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze system'
        });
    }
});
router.post('/execute', async (req, res) => {
    try {
        const { error, value } = migrationPlanSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const result = await migrationService.executeMigration(value, req.user.id);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error executing migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute migration'
        });
    }
});
router.post('/rollback', async (req, res) => {
    try {
        const result = await migrationService.rollbackMigration(req.user.id);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error rolling back migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to rollback migration'
        });
    }
});
router.post('/validate', async (req, res) => {
    try {
        const validation = await migrationService.validateMigrationReadiness();
        res.json({
            success: true,
            data: validation
        });
    }
    catch (error) {
        console.error('Error validating migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate migration'
        });
    }
});
router.post('/cleanup-orphaned', async (req, res) => {
    try {
        const result = await migrationService.cleanupOrphanedData();
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error cleaning up orphaned data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup orphaned data'
        });
    }
});
router.post('/batch/start', async (req, res) => {
    try {
        const { error, value } = batchMigrationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const progress = await migrationService.startBatchMigration(value, req.user.id);
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        console.error('Error starting batch migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start batch migration'
        });
    }
});
router.get('/progress/:id', async (req, res) => {
    try {
        const progress = await migrationService.getMigrationProgress(req.params.id);
        if (!progress) {
            return res.status(404).json({
                success: false,
                error: 'Migration progress not found'
            });
        }
        res.json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        console.error('Error getting migration progress:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get migration progress'
        });
    }
});
router.post('/:id/pause', async (req, res) => {
    try {
        const success = await migrationService.pauseMigration(req.params.id);
        res.json({
            success: true,
            data: { paused: success }
        });
    }
    catch (error) {
        console.error('Error pausing migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to pause migration'
        });
    }
});
router.post('/:id/resume', async (req, res) => {
    try {
        const success = await migrationService.resumeMigration(req.params.id);
        res.json({
            success: true,
            data: { resumed: success }
        });
    }
    catch (error) {
        console.error('Error resuming migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resume migration'
        });
    }
});
router.post('/:id/cancel', async (req, res) => {
    try {
        const success = await migrationService.cancelMigration(req.params.id);
        res.json({
            success: true,
            data: { cancelled: success }
        });
    }
    catch (error) {
        console.error('Error cancelling migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel migration'
        });
    }
});
router.post('/resources/batch', async (req, res) => {
    try {
        const { fromTenantId, toTenantId, resourceType, resourceIds } = req.body;
        if (!fromTenantId || !toTenantId || !resourceType || !resourceIds) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fromTenantId, toTenantId, resourceType, resourceIds'
            });
        }
        const result = await migrationService.batchMigrateResources(fromTenantId, toTenantId, resourceType, resourceIds, req.user.id);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error in batch resource migration:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to migrate resources'
        });
    }
});
exports.default = router;
//# sourceMappingURL=migration.js.map