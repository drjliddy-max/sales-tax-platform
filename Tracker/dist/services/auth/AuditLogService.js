"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = exports.AuditLogService = void 0;
const models_1 = require("@/models");
const SentryService_1 = require("@/services/monitoring/SentryService");
const utils_1 = require("@/utils");
class AuditLogService {
    constructor() { }
    static getInstance() {
        if (!AuditLogService.instance) {
            AuditLogService.instance = new AuditLogService();
        }
        return AuditLogService.instance;
    }
    async logEvent(eventData) {
        try {
            const auditLog = new models_1.AuditLog({
                ...eventData,
                severity: eventData.severity || this.calculateSeverity(eventData),
                compliance: {
                    isComplianceRelevant: this.isComplianceRelevant(eventData),
                    ...eventData.compliance
                },
                timestamp: new Date()
            });
            await auditLog.save();
            SentryService_1.sentryService.addBreadcrumb('audit_log', `${eventData.action} ${eventData.entityType}: ${eventData.entityId}`, this.mapSeverityToBreadcrumb(auditLog.severity), {
                entity_type: eventData.entityType,
                entity_id: eventData.entityId,
                action: eventData.action,
                user_id: eventData.userId,
                business_id: eventData.businessId,
                user_role: eventData.userRole,
                compliance_relevant: auditLog.compliance.isComplianceRelevant,
                severity: auditLog.severity
            });
            if (auditLog.severity === 'critical') {
                SentryService_1.sentryService.captureFinancialError(new Error(`Critical security event: ${eventData.action} ${eventData.entityType}`), {
                    businessId: eventData.businessId,
                    severity: 'critical'
                });
            }
            utils_1.logger.info('Audit event logged', {
                auditId: auditLog._id,
                entityType: eventData.entityType,
                action: eventData.action,
                userId: eventData.userId,
                businessId: eventData.businessId,
                severity: auditLog.severity
            });
        }
        catch (error) {
            utils_1.logger.error('Failed to log audit event:', error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to log audit event'), {
                businessId: eventData.businessId,
                severity: 'high'
            });
        }
    }
    async getBusinessAuditTrail(businessId, options = {}) {
        try {
            const query = { businessId };
            if (options.startDate || options.endDate) {
                query.timestamp = {};
                if (options.startDate)
                    query.timestamp.$gte = options.startDate;
                if (options.endDate)
                    query.timestamp.$lte = options.endDate;
            }
            if (options.entityType)
                query.entityType = options.entityType;
            if (options.action)
                query.action = options.action;
            if (options.userId)
                query.userId = options.userId;
            const limit = options.limit || 100;
            const offset = options.offset || 0;
            const [logs, total] = await Promise.all([
                models_1.AuditLog.find(query)
                    .sort({ timestamp: -1 })
                    .limit(limit)
                    .skip(offset)
                    .populate('userId', 'email name')
                    .lean(),
                models_1.AuditLog.countDocuments(query)
            ]);
            return { logs: logs, total };
        }
        catch (error) {
            utils_1.logger.error('Failed to get audit trail:', error);
            throw new Error('Failed to retrieve audit trail');
        }
    }
    async getComplianceReport(businessId, startDate, endDate, regulatoryCategory) {
        try {
            const query = {
                businessId,
                'compliance.isComplianceRelevant': true,
                timestamp: { $gte: startDate, $lte: endDate }
            };
            if (regulatoryCategory) {
                query['compliance.regulatoryCategory'] = regulatoryCategory;
            }
            const events = await models_1.AuditLog.find(query)
                .sort({ timestamp: -1 })
                .populate('userId', 'email name')
                .lean();
            const summary = {
                totalEvents: events.length,
                criticalEvents: events.filter(e => e.severity === 'critical').length,
                userActions: events.reduce((acc, event) => {
                    acc[event.action] = (acc[event.action] || 0) + 1;
                    return acc;
                }, {}),
                entityChanges: events.reduce((acc, event) => {
                    acc[event.entityType] = (acc[event.entityType] || 0) + 1;
                    return acc;
                }, {})
            };
            return { events, summary };
        }
        catch (error) {
            utils_1.logger.error('Failed to generate compliance report:', error);
            throw new Error('Failed to generate compliance report');
        }
    }
    async getSecurityEvents(businessId, daysBack = 30, minimumSeverity = 'high') {
        try {
            const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
            const severityLevels = minimumSeverity === 'critical'
                ? ['critical']
                : minimumSeverity === 'high'
                    ? ['high', 'critical']
                    : ['medium', 'high', 'critical'];
            return await models_1.AuditLog.find({
                businessId,
                severity: { $in: severityLevels },
                timestamp: { $gte: startDate }
            })
                .sort({ timestamp: -1 })
                .populate('userId', 'email name')
                .lean();
        }
        catch (error) {
            utils_1.logger.error('Failed to get security events:', error);
            throw new Error('Failed to retrieve security events');
        }
    }
    calculateSeverity(eventData) {
        if (eventData.action === 'deleted' && ['business', 'user'].includes(eventData.entityType)) {
            return 'critical';
        }
        if (eventData.entityType === 'user' && ['created', 'updated'].includes(eventData.action)) {
            return 'high';
        }
        if (eventData.action === 'updated' && eventData.entityType === 'business') {
            return 'high';
        }
        if (eventData.entityType === 'integration' && ['created', 'updated', 'deleted'].includes(eventData.action)) {
            return 'high';
        }
        if (eventData.action === 'exported' || eventData.action === 'imported') {
            return 'medium';
        }
        if (eventData.entityType === 'filing') {
            return 'medium';
        }
        return 'low';
    }
    isComplianceRelevant(eventData) {
        if (['transaction', 'tax_rate', 'filing'].includes(eventData.entityType)) {
            return true;
        }
        if (eventData.entityType === 'user' && ['created', 'updated', 'deleted'].includes(eventData.action)) {
            return true;
        }
        if (eventData.entityType === 'business' && eventData.action !== 'accessed') {
            return true;
        }
        if (eventData.entityType === 'integration') {
            return true;
        }
        return false;
    }
    mapSeverityToBreadcrumb(severity) {
        switch (severity) {
            case 'critical': return 'error';
            case 'high': return 'error';
            case 'medium': return 'warning';
            case 'low': return 'info';
            default: return 'info';
        }
    }
}
exports.AuditLogService = AuditLogService;
exports.auditLogService = AuditLogService.getInstance();
//# sourceMappingURL=AuditLogService.js.map