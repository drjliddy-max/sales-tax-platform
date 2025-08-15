import express from 'express';
import { auditLogService } from '@/services/auth/AuditLogService';
import { 
  requireAuth, 
  enrichUserContext, 
  requireRole, 
  requirePermission,
  requireBusinessAccess,
  auditSecurityEvent,
  authRateLimit 
} from '@/api/middleware/auth';
import { logger } from '@/utils';

const router = express.Router();

// Apply base authentication and rate limiting
router.use(authRateLimit(20, 15 * 60 * 1000)); // 20 requests per 15 minutes
router.use(requireAuth);
router.use(enrichUserContext);
router.use('/business/:businessId', requireBusinessAccess);

// Get audit trail for a business
router.get('/business/:businessId',
  requireRole(['business_owner', 'auditor', 'admin']),
  requirePermission(['read:audit_logs']),
  auditSecurityEvent('audit_trail_access'),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const {
        startDate,
        endDate,
        entityType,
        action,
        userId,
        limit = '100',
        offset = '0'
      } = req.query;

      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        entityType: entityType as string,
        action: action as string,
        userId: userId as string,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      };

      const result = await auditLogService.getBusinessAuditTrail(businessId, options);

      res.json({
        auditTrail: result.logs,
        pagination: {
          total: result.total,
          limit: options.limit,
          offset: options.offset,
          hasMore: result.total > (options.offset + options.limit)
        },
        filters: {
          startDate: options.startDate,
          endDate: options.endDate,
          entityType: options.entityType,
          action: options.action,
          userId: options.userId
        }
      });

    } catch (error) {
      logger.error('Error getting audit trail:', error);
      res.status(500).json({
        error: 'Failed to retrieve audit trail',
        message: 'An error occurred while retrieving audit logs'
      });
    }
  }
);

// Get compliance report for a business
router.get('/business/:businessId/compliance',
  requireRole(['business_owner', 'auditor', 'admin']),
  requirePermission(['read:audit_logs', 'audit:compliance']),
  auditSecurityEvent('compliance_report_access'),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const { startDate, endDate, regulatoryCategory } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Missing required parameters',
          message: 'startDate and endDate are required for compliance reports'
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const report = await auditLogService.getComplianceReport(
        businessId,
        start,
        end,
        regulatoryCategory as string
      );

      res.json({
        complianceReport: {
          period: { startDate: start, endDate: end },
          businessId,
          regulatoryCategory,
          ...report
        },
        generatedAt: new Date(),
        generatedBy: req.user!.sub
      });

    } catch (error) {
      logger.error('Error generating compliance report:', error);
      res.status(500).json({
        error: 'Failed to generate compliance report',
        message: 'An error occurred while generating the compliance report'
      });
    }
  }
);

// Get security events for a business
router.get('/business/:businessId/security',
  requireRole(['business_owner', 'admin']),
  requirePermission(['read:audit_logs']),
  auditSecurityEvent('security_events_access'),
  async (req, res) => {
    try {
      const { businessId } = req.params;
      const { daysBack = '30', severity = 'high' } = req.query;

      const events = await auditLogService.getSecurityEvents(
        businessId,
        parseInt(daysBack as string, 10),
        severity as 'medium' | 'high' | 'critical'
      );

      res.json({
        securityEvents: events,
        period: {
          daysBack: parseInt(daysBack as string, 10),
          startDate: new Date(Date.now() - parseInt(daysBack as string, 10) * 24 * 60 * 60 * 1000)
        },
        minimumSeverity: severity,
        total: events.length
      });

    } catch (error) {
      logger.error('Error getting security events:', error);
      res.status(500).json({
        error: 'Failed to retrieve security events',
        message: 'An error occurred while retrieving security events'
      });
    }
  }
);

export default router;