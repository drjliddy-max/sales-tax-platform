import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/middleware/clerk';
import { protectAdminRoute } from '@/middleware/auth';
import { ValidationService } from '@/services/migration/ValidationService';

const router = express.Router();

// Apply authentication to all validation routes
router.use(requireAuth);
router.use(protectAdminRoute); // Only admins can access validation utilities

// Initialize service
const validationService = new ValidationService();

// Validation schemas
const migrationPlanValidationSchema = Joi.object({
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

const customValidationSchema = Joi.object({
  tenantId: Joi.string().required(),
  ruleIds: Joi.array().items(Joi.string()).required()
});

const integrityFixSchema = Joi.object({
  fixOrphanedRecords: Joi.boolean().default(false),
  fixBrokenReferences: Joi.boolean().default(false),
  createMissingRecords: Joi.boolean().default(false),
  deleteInvalidRecords: Joi.boolean().default(false)
});

const scheduleIntegritySchema = Joi.object({
  tenantId: Joi.string().required(),
  cronExpression: Joi.string().required(),
  autoFix: Joi.boolean().default(false),
  notifyOnIssues: Joi.boolean().default(true),
  emailNotifications: Joi.array().items(Joi.string().email()).default([])
});

// =====================
// VALIDATION ROUTES
// =====================

// POST /api/migration/validate-plan - Validate migration plan
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
  } catch (error) {
    console.error('Error validating migration plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate migration plan'
    });
  }
});

// GET /api/migration/validate-tenant/:tenantId - Validate tenant data
router.get('/validate-tenant/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const report = await validationService.validateTenantData(tenantId);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error validating tenant data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate tenant data'
    });
  }
});

// GET /api/migration/validate-integrity/:tenantId? - Validate data integrity
router.get('/validate-integrity/:tenantId?', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const result = await validationService.validateDataIntegrity(tenantId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error validating data integrity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate data integrity'
    });
  }
});

// GET /api/migration/validate-isolation - Validate tenant isolation
router.get('/validate-isolation', async (req, res) => {
  try {
    const result = await validationService.validateTenantIsolation();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error validating tenant isolation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate tenant isolation'
    });
  }
});

// POST /api/migration/validate-batch - Validate batch migration config
router.post('/validate-batch', async (req, res) => {
  try {
    const result = await validationService.validateBatchMigration(req.body);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error validating batch migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate batch migration'
    });
  }
});

// POST /api/migration/validate-post-migration - Validate post-migration state
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
  } catch (error) {
    console.error('Error validating post-migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate post-migration'
    });
  }
});

// GET /api/migration/validation-rules - Get available validation rules
router.get('/validation-rules', async (req, res) => {
  try {
    const rules = await validationService.getValidationRules();
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error getting validation rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get validation rules'
    });
  }
});

// POST /api/migration/validate-custom - Run custom validation
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
  } catch (error) {
    console.error('Error running custom validation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run custom validation'
    });
  }
});

// ======================
// INTEGRITY REPAIR ROUTES
// ======================

// GET /api/migration/check-referential-integrity/:tenantId - Check referential integrity
router.get('/check-referential-integrity/:tenantId', async (req, res) => {
  try {
    const tenantId = req.params.tenantId;
    const result = await validationService.checkReferentialIntegrity(tenantId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error checking referential integrity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check referential integrity'
    });
  }
});

// POST /api/migration/fix-integrity/:tenantId - Fix integrity issues
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
  } catch (error) {
    console.error('Error fixing integrity issues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix integrity issues'
    });
  }
});

// POST /api/migration/schedule-integrity-check - Schedule integrity check
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
  } catch (error) {
    console.error('Error scheduling integrity check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule integrity check'
    });
  }
});

export default router;