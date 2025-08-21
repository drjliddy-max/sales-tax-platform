"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const clerk_1 = require("@/middleware/clerk");
const auth_1 = require("@/middleware/auth");
const BackupService_1 = require("@/services/migration/BackupService");
const router = express_1.default.Router();
router.use(clerk_1.requireAuth);
router.use(auth_1.protectAdminRoute);
const backupService = new BackupService_1.BackupService();
const backupConfigSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    name: joi_1.default.string().required(),
    description: joi_1.default.string().optional(),
    config: joi_1.default.object({
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
    }).required()
});
const restoreConfigSchema = joi_1.default.object({
    backupId: joi_1.default.string().required(),
    targetTenantId: joi_1.default.string().required(),
    restoreBusinesses: joi_1.default.boolean().default(true),
    restoreTransactions: joi_1.default.boolean().default(true),
    restoreReports: joi_1.default.boolean().default(true),
    restorePOSConnections: joi_1.default.boolean().default(true),
    restoreSettings: joi_1.default.boolean().default(true),
    restoreUsers: joi_1.default.boolean().default(true),
    mergeStrategy: joi_1.default.string().valid('replace', 'merge', 'skip_existing').default('merge'),
    validateBeforeRestore: joi_1.default.boolean().default(true),
    createRestorePoint: joi_1.default.boolean().default(true)
});
const scheduleBackupSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    name: joi_1.default.string().required(),
    config: joi_1.default.object().required(),
    cronExpression: joi_1.default.string().required(),
    retentionDays: joi_1.default.number().min(1).max(365).default(30),
    isActive: joi_1.default.boolean().default(true)
});
const restorePointSchema = joi_1.default.object({
    tenantId: joi_1.default.string().required(),
    description: joi_1.default.string().required()
});
router.post('/create', async (req, res) => {
    try {
        const { error, value } = backupConfigSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const backup = await backupService.createBackup(value.tenantId, value.config, value.name, value.description);
        res.json({
            success: true,
            data: backup
        });
    }
    catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create backup'
        });
    }
});
router.get('/list/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const backups = await backupService.getBackups(tenantId);
        res.json({
            success: true,
            data: backups
        });
    }
    catch (error) {
        console.error('Error fetching backups:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch backups'
        });
    }
});
router.get('/status/:backupId', async (req, res) => {
    try {
        const backupId = req.params.backupId;
        const backup = await backupService.getBackupStatus(backupId);
        if (!backup) {
            return res.status(404).json({
                success: false,
                error: 'Backup not found'
            });
        }
        res.json({
            success: true,
            data: backup
        });
    }
    catch (error) {
        console.error('Error getting backup status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get backup status'
        });
    }
});
router.get('/download/:backupId', async (req, res) => {
    try {
        const backupId = req.params.backupId;
        const backup = await prisma_1.default.backup.findUnique({
            where: { id: backupId },
            include: { tenant: true }
        });
        if (!backup) {
            return res.status(404).json({
                success: false,
                error: 'Backup not found'
            });
        }
        if (backup.status !== 'completed') {
            return res.status(400).json({
                success: false,
                error: 'Backup is not ready for download'
            });
        }
        const blob = await backupService.downloadBackup(backupId);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${backup.name}.backup"`);
        const buffer = Buffer.from(await blob.arrayBuffer());
        res.send(buffer);
    }
    catch (error) {
        console.error('Error downloading backup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download backup'
        });
    }
});
router.delete('/:backupId', async (req, res) => {
    try {
        const backupId = req.params.backupId;
        const success = await backupService.deleteBackup(backupId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Backup not found or could not be deleted'
            });
        }
        res.json({
            success: true,
            data: { deleted: true }
        });
    }
    catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete backup'
        });
    }
});
router.post('/:backupId/validate', async (req, res) => {
    try {
        const backupId = req.params.backupId;
        const validation = await backupService.validateBackup(backupId);
        res.json({
            success: true,
            data: validation
        });
    }
    catch (error) {
        console.error('Error validating backup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to validate backup'
        });
    }
});
router.post('/restore', async (req, res) => {
    try {
        const { error, value } = restoreConfigSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const result = await backupService.restoreFromBackup(value);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        console.error('Error restoring from backup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restore from backup'
        });
    }
});
router.post('/restore-point', async (req, res) => {
    try {
        const { error, value } = restorePointSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const restorePointId = await backupService.createRestorePoint(value.tenantId, value.description);
        res.json({
            success: true,
            data: { restorePointId }
        });
    }
    catch (error) {
        console.error('Error creating restore point:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create restore point'
        });
    }
});
router.get('/restore-points/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const restorePoints = await backupService.listRestorePoints(tenantId);
        res.json({
            success: true,
            data: restorePoints
        });
    }
    catch (error) {
        console.error('Error fetching restore points:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch restore points'
        });
    }
});
router.post('/schedule', async (req, res) => {
    try {
        const { error, value } = scheduleBackupSchema.validate(req.body);
        if (error) {
            return res.status(400).json({
                success: false,
                error: error.details[0].message
            });
        }
        const success = await backupService.scheduleBackup(value.tenantId, {
            name: value.name,
            config: value.config,
            cronExpression: value.cronExpression,
            retentionDays: value.retentionDays,
            isActive: value.isActive
        });
        res.json({
            success: true,
            data: { scheduled: success }
        });
    }
    catch (error) {
        console.error('Error scheduling backup:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to schedule backup'
        });
    }
});
router.get('/schedules/:tenantId', async (req, res) => {
    try {
        const tenantId = req.params.tenantId;
        const schedules = await backupService.getScheduledBackups(tenantId);
        res.json({
            success: true,
            data: schedules
        });
    }
    catch (error) {
        console.error('Error fetching scheduled backups:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch scheduled backups'
        });
    }
});
exports.default = router;
//# sourceMappingURL=backup.js.map