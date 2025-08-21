import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/middleware/clerk';
import { protectAdminRoute } from '@/middleware/auth';
import { MigrationService } from '@/services/migration/MigrationService';
import { ValidationService } from '@/services/migration/ValidationService';
import { BackupService } from '@/services/migration/BackupService';
import { SchedulerService } from '@/services/migration/SchedulerService';

const router = express.Router();

// Apply authentication to all migration routes
router.use(requireAuth);
router.use(protectAdminRoute); // Only admins can access migration utilities

// Initialize services
const migrationService = new MigrationService();
const validationService = new ValidationService();
const backupService = new BackupService();
const schedulerService = new SchedulerService();

// Validation schemas
const migrationPlanSchema = Joi.object({
  defaultTenantName: Joi.string().required(),
  defaultTenantSlug: Joi.string().required(),
  assignAllToDefaultTenant: Joi.boolean().default(true),
  businessToTenantMapping: Joi.object().optional(),
  preserveExistingData: Joi.boolean().default(true),
  batchSize: Joi.number().min(1).max(1000).default(100),
  enableProgressTracking: Joi.boolean().default(true),
  createBackup: Joi.boolean().default(true),
  dryRun: Joi.boolean().default(false)
});

const batchMigrationSchema = Joi.object({
  tenantId: Joi.string().required(),
  resourceType: Joi.string().valid('businesses', 'transactions', 'reports', 'pos_connections').required(),
  resourceIds: Joi.array().items(Joi.string()).required(),
  batchSize: Joi.number().min(1).max(500).default(100),
  preserveRelationships: Joi.boolean().default(true)
});

const backupConfigSchema = Joi.object({
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
});

const scheduledOperationSchema = Joi.object({
  tenantId: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().optional(),
  type: Joi.string().valid('backup', 'migration', 'validation', 'cleanup').required(),
  cronExpression: Joi.string().required(),
  timezone: Joi.string().default('UTC'),
  enabled: Joi.boolean().default(true),
  config: Joi.object().required(),
  retentionDays: Joi.number().min(1).max(365).default(30),
  notifications: Joi.object({
    onSuccess: Joi.boolean().default(false),
    onFailure: Joi.boolean().default(true),
    recipients: Joi.array().items(Joi.string().email()).default([])
  }).optional()
});

// =================
// MIGRATION ROUTES
// =================

// GET /api/migration/status - Get migration system status
router.get('/status', async (req, res) => {
  try {
    const status = await migrationService.getSystemStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting migration status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get migration status'
    });
  }
});

// GET /api/migration/analyze - Analyze current system for migration readiness
router.get('/analyze', async (req, res) => {
  try {
    const analysis = await migrationService.analyzeSystem();
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error analyzing system:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze system'
    });
  }
});

// POST /api/migration/execute - Execute migration plan
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
  } catch (error) {
    console.error('Error executing migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute migration'
    });
  }
});

// POST /api/migration/rollback - Rollback migration
router.post('/rollback', async (req, res) => {
  try {
    const result = await migrationService.rollbackMigration(req.user.id);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error rolling back migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rollback migration'
    });
  }
});

// POST /api/migration/validate - Validate migration readiness
router.post('/validate', async (req, res) => {
  try {
    const validation = await migrationService.validateMigrationReadiness();
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('Error validating migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate migration'
    });
  }
});

// POST /api/migration/cleanup-orphaned - Clean up orphaned data
router.post('/cleanup-orphaned', async (req, res) => {
  try {
    const result = await migrationService.cleanupOrphanedData();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error cleaning up orphaned data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup orphaned data'
    });
  }
});

// ===================
// BATCH MIGRATION ROUTES
// ===================

// POST /api/migration/batch/start - Start batch migration
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
  } catch (error) {
    console.error('Error starting batch migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start batch migration'
    });
  }
});

// GET /api/migration/progress/:id - Get migration progress
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
  } catch (error) {
    console.error('Error getting migration progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get migration progress'
    });
  }
});

// POST /api/migration/:id/pause - Pause migration
router.post('/:id/pause', async (req, res) => {
  try {
    const success = await migrationService.pauseMigration(req.params.id);
    res.json({
      success: true,
      data: { paused: success }
    });
  } catch (error) {
    console.error('Error pausing migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause migration'
    });
  }
});

// POST /api/migration/:id/resume - Resume migration
router.post('/:id/resume', async (req, res) => {
  try {
    const success = await migrationService.resumeMigration(req.params.id);
    res.json({
      success: true,
      data: { resumed: success }
    });
  } catch (error) {
    console.error('Error resuming migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume migration'
    });
  }
});

// POST /api/migration/:id/cancel - Cancel migration
router.post('/:id/cancel', async (req, res) => {
  try {
    const success = await migrationService.cancelMigration(req.params.id);
    res.json({
      success: true,
      data: { cancelled: success }
    });
  } catch (error) {
    console.error('Error cancelling migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel migration'
    });
  }
});

// POST /api/migration/resources/batch - Batch migrate resources between tenants
router.post('/resources/batch', async (req, res) => {
  try {
    const { fromTenantId, toTenantId, resourceType, resourceIds } = req.body;
    
    if (!fromTenantId || !toTenantId || !resourceType || !resourceIds) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromTenantId, toTenantId, resourceType, resourceIds'
      });
    }

    const result = await migrationService.batchMigrateResources(
      fromTenantId,
      toTenantId,
      resourceType,
      resourceIds,
      req.user.id
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in batch resource migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to migrate resources'
    });
  }
});

export default router;