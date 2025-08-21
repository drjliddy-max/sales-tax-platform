"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AuditLogService_1 = require("@/services/auth/AuditLogService");
const auth_1 = require("@/api/middleware/auth");
const utils_1 = require("@/utils");
const router = express_1.default.Router();
router.use((0, auth_1.authRateLimit)(20, 15 * 60 * 1000));
router.use(auth_1.requireAuth);
router.use(auth_1.enrichUserContext);
router.use('/business/:businessId', auth_1.requireBusinessAccess);
router.get('/business/:businessId', (0, auth_1.requireRole)(['business_owner', 'auditor', 'admin']), (0, auth_1.requirePermission)(['read:audit_logs']), (0, auth_1.auditSecurityEvent)('audit_trail_access'), async (req, res) => {
    try {
        const { businessId } = req.params;
        const { startDate, endDate, entityType, action, userId, limit = '100', offset = '0' } = req.query;
        const options = {
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            entityType: entityType,
            action: action,
            userId: userId,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10)
        };
        const result = await AuditLogService_1.auditLogService.getBusinessAuditTrail(businessId, options);
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
    }
    catch (error) {
        utils_1.logger.error('Error getting audit trail:', error);
        res.status(500).json({
            error: 'Failed to retrieve audit trail',
            message: 'An error occurred while retrieving audit logs'
        });
    }
});
router.get('/business/:businessId/compliance', (0, auth_1.requireRole)(['business_owner', 'auditor', 'admin']), (0, auth_1.requirePermission)(['read:audit_logs', 'audit:compliance']), (0, auth_1.auditSecurityEvent)('compliance_report_access'), async (req, res) => {
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
        const start = new Date(startDate);
        const end = new Date(endDate);
        const report = await AuditLogService_1.auditLogService.getComplianceReport(businessId, start, end, regulatoryCategory);
        res.json({
            complianceReport: {
                period: { startDate: start, endDate: end },
                businessId,
                regulatoryCategory,
                ...report
            },
            generatedAt: new Date(),
            generatedBy: req.user.sub
        });
    }
    catch (error) {
        utils_1.logger.error('Error generating compliance report:', error);
        res.status(500).json({
            error: 'Failed to generate compliance report',
            message: 'An error occurred while generating the compliance report'
        });
    }
});
router.get('/business/:businessId/security', (0, auth_1.requireRole)(['business_owner', 'admin']), (0, auth_1.requirePermission)(['read:audit_logs']), (0, auth_1.auditSecurityEvent)('security_events_access'), async (req, res) => {
    try {
        const { businessId } = req.params;
        const { daysBack = '30', severity = 'high' } = req.query;
        const events = await AuditLogService_1.auditLogService.getSecurityEvents(businessId, parseInt(daysBack, 10), severity);
        res.json({
            securityEvents: events,
            period: {
                daysBack: parseInt(daysBack, 10),
                startDate: new Date(Date.now() - parseInt(daysBack, 10) * 24 * 60 * 60 * 1000)
            },
            minimumSeverity: severity,
            total: events.length
        });
    }
    catch (error) {
        utils_1.logger.error('Error getting security events:', error);
        res.status(500).json({
            error: 'Failed to retrieve security events',
            message: 'An error occurred while retrieving security events'
        });
    }
});
exports.default = router;
//# sourceMappingURL=audit.js.map