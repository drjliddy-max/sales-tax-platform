import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/middleware/clerk';
import { protectAdminRoute } from '@/middleware/auth';
import { BackupService } from '@/services/migration/BackupService';

const router = express.Router();

// Apply authentication to all backup routes
router.use(requireAuth);
router.use(protectAdminRoute); // Only admins can access backup utilities

// Initialize service
const backupService = new BackupService();

// Validation schemas
const backupConfigSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  config: Joi.object({
    includeBusinesses: Joi.boolean().default(true),
    includeTransactions: Joi.boolean().default(true),
    includeReports: Joi.boolean().default(true),
    includePOSConnections: Joi.boolean().default(true),
    includeSettings: Joi.boolean().default(true),
    includeUsers: Joi.boolean().default(true),
    dateRange: Joi.object({
      startDate: Joi.string().isoDate(),
      endDate: Joi.string().isoDate()
    }).optional(),
    compression: Joi.boolean().default(true),
    encryption: Joi.boolean().default(true),
    format: Joi.string().valid('json', 'csv', 'sql').default('json')
  }).required()
});

const restoreConfigSchema = Joi.object({
  backupId: Joi.string().required(),
  targetTenantId: Joi.string().required(),
  restoreBusinesses: Joi.boolean().default(true),
  restoreTransactions: Joi.boolean().default(true),
  restoreReports: Joi.boolean().default(true),
  restorePOSConnections: Joi.boolean().default(true),
  restoreSettings: Joi.boolean().default(true),
  restoreUsers: Joi.boolean().default(true),
  mergeStrategy: Joi.string().valid('replace', 'merge', 'skip_existing').default('merge'),
  validateBeforeRestore: Joi.boolean().default(true),
  createRestorePoint: Joi.boolean().default(true)
});

const scheduleBackupSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().required(),
  config: Joi.object().required(),
  cronExpression: Joi.string().required(),
  retentionDays: Joi.number().min(1).max(365).default(30),
  isActive: Joi.boolean().default(true)
});

const restorePointSchema = Joi.object({
  tenantId: Joi.string().required(),
  description: Joi.string().required()
});

// ==================
// BACKUP ROUTES
// ==================

// POST /api/backup/create - Create backup
router.post('/create', async (req, res) => {
  try {
    const { error, value } = backupConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const backup = await backupService.createBackup(
      value.tenantId,
      value.config,
      value.name,
      value.description
    );

    res.json({
      success: true,
      data: backup
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup'
    });
  }
});

// GET /api/backup/list/:tenantId - List tenant backups
router.get('/list/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const backups = await backupService.getBackups(tenantId);

    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('Error fetching backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch backups'
    });
  }
});

// GET /api/backup/status/:backupId - Get backup status
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
  } catch (error) {
    console.error('Error getting backup status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get backup status'
    });
  }
});

// GET /api/backup/download/:backupId - Download backup
router.get('/download/:backupId', async (req, res) => {
  try {
    const backupId = req.params.backupId;
    
    // Check if backup exists and user has permission
    const backup = await prisma.backup.findUnique({
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

    // Stream the backup file
    const blob = await backupService.downloadBackup(backupId);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.name}.backup"`);
    
    // Convert blob to buffer and send
    const buffer = Buffer.from(await blob.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download backup'
    });
  }
});

// DELETE /api/backup/:backupId - Delete backup
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
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete backup'
    });
  }
});

// POST /api/backup/:backupId/validate - Validate backup
router.post('/:backupId/validate', async (req, res) => {
  try {
    const backupId = req.params.backupId;
    const validation = await backupService.validateBackup(backupId);

    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate backup'
    });
  }
});

// ==================
// RESTORE ROUTES
// ==================

// POST /api/backup/restore - Restore from backup
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
  } catch (error) {
    console.error('Error restoring from backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore from backup'
    });
  }
});

// POST /api/backup/restore-point - Create restore point
router.post('/restore-point', async (req, res) => {
  try {
    const { error, value } = restorePointSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const restorePointId = await backupService.createRestorePoint(
      value.tenantId,
      value.description
    );

    res.json({
      success: true,
      data: { restorePointId }
    });
  } catch (error) {
    console.error('Error creating restore point:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create restore point'
    });
  }
});

// GET /api/backup/restore-points/:tenantId - List restore points
router.get('/restore-points/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const restorePoints = await backupService.listRestorePoints(tenantId);

    res.json({
      success: true,
      data: restorePoints
    });
  } catch (error) {
    console.error('Error fetching restore points:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch restore points'
    });
  }
});

// ======================
// SCHEDULED BACKUP ROUTES
// ======================

// POST /api/backup/schedule - Schedule backup
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
  } catch (error) {
    console.error('Error scheduling backup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule backup'
    });
  }
});

// GET /api/backup/schedules/:tenantId - Get scheduled backups
router.get('/schedules/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const schedules = await backupService.getScheduledBackups(tenantId);

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Error fetching scheduled backups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled backups'
    });
  }
});

export default router;