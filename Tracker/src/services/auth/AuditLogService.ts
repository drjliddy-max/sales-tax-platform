import { AuditLog, IAuditLog } from '@/models';
import { UserRole } from '@/services/auth/Auth0Service';
import { sentryService } from '@/services/monitoring/SentryService';
import { logger } from '@/utils';

export interface AuditEventData {
  entityType: 'transaction' | 'tax_rate' | 'business' | 'filing' | 'user' | 'integration';
  entityId: string;
  action: 'created' | 'updated' | 'deleted' | 'accessed' | 'exported' | 'imported';
  userId: string;
  businessId: string;
  userRole: UserRole;
  userPermissions: string[];
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fieldChanges?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    requestId?: string;
    sessionId?: string;
    jurisdiction?: string;
    operationType?: string;
    complianceFlags?: string[];
  };
  severity?: 'low' | 'medium' | 'high' | 'critical';
  compliance?: {
    isComplianceRelevant?: boolean;
    regulatoryCategory?: 'tax_calculation' | 'user_management' | 'data_retention' | 'financial_reporting';
    retentionRequiredUntil?: Date;
    jurisdictions?: string[];
  };
}

export class AuditLogService {
  private static instance: AuditLogService;

  private constructor() {}

  public static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  public async logEvent(eventData: AuditEventData): Promise<void> {
    try {
      const auditLog = new AuditLog({
        ...eventData,
        severity: eventData.severity || this.calculateSeverity(eventData),
        compliance: {
          isComplianceRelevant: this.isComplianceRelevant(eventData),
          ...eventData.compliance
        },
        timestamp: new Date()
      });

      await auditLog.save();

      // Send to Sentry for real-time monitoring
      sentryService.addBreadcrumb(
        'audit_log',
        `${eventData.action} ${eventData.entityType}: ${eventData.entityId}`,
        this.mapSeverityToBreadcrumb(auditLog.severity),
        {
          entity_type: eventData.entityType,
          entity_id: eventData.entityId,
          action: eventData.action,
          user_id: eventData.userId,
          business_id: eventData.businessId,
          user_role: eventData.userRole,
          compliance_relevant: auditLog.compliance.isComplianceRelevant,
          severity: auditLog.severity
        }
      );

      // Alert on critical security events
      if (auditLog.severity === 'critical') {
        sentryService.captureFinancialError(
          new Error(`Critical security event: ${eventData.action} ${eventData.entityType}`),
          {
            businessId: eventData.businessId,
            severity: 'critical'
          }
        );
      }

      logger.info('Audit event logged', {
        auditId: auditLog._id,
        entityType: eventData.entityType,
        action: eventData.action,
        userId: eventData.userId,
        businessId: eventData.businessId,
        severity: auditLog.severity
      });

    } catch (error) {
      logger.error('Failed to log audit event:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to log audit event'),
        {
          businessId: eventData.businessId,
          severity: 'high'
        }
      );
    }
  }

  public async getBusinessAuditTrail(
    businessId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      entityType?: string;
      action?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ logs: IAuditLog[]; total: number }> {
    try {
      const query: any = { businessId };

      if (options.startDate || options.endDate) {
        query.timestamp = {};
        if (options.startDate) query.timestamp.$gte = options.startDate;
        if (options.endDate) query.timestamp.$lte = options.endDate;
      }

      if (options.entityType) query.entityType = options.entityType;
      if (options.action) query.action = options.action;
      if (options.userId) query.userId = options.userId;

      const limit = options.limit || 100;
      const offset = options.offset || 0;

      const [logs, total] = await Promise.all([
        AuditLog.find(query)
          .sort({ timestamp: -1 })
          .limit(limit)
          .skip(offset)
          .populate('userId', 'email name')
          .lean(),
        AuditLog.countDocuments(query)
      ]);

      return { logs: logs as IAuditLog[], total };

    } catch (error) {
      logger.error('Failed to get audit trail:', error);
      throw new Error('Failed to retrieve audit trail');
    }
  }

  public async getComplianceReport(
    businessId: string,
    startDate: Date,
    endDate: Date,
    regulatoryCategory?: string
  ): Promise<{
    events: IAuditLog[];
    summary: {
      totalEvents: number;
      criticalEvents: number;
      userActions: Record<string, number>;
      entityChanges: Record<string, number>;
    };
  }> {
    try {
      const query: any = {
        businessId,
        'compliance.isComplianceRelevant': true,
        timestamp: { $gte: startDate, $lte: endDate }
      };

      if (regulatoryCategory) {
        query['compliance.regulatoryCategory'] = regulatoryCategory;
      }

      const events = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .populate('userId', 'email name')
        .lean() as IAuditLog[];

      const summary = {
        totalEvents: events.length,
        criticalEvents: events.filter(e => e.severity === 'critical').length,
        userActions: events.reduce((acc, event) => {
          acc[event.action] = (acc[event.action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        entityChanges: events.reduce((acc, event) => {
          acc[event.entityType] = (acc[event.entityType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      return { events, summary };

    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw new Error('Failed to generate compliance report');
    }
  }

  public async getSecurityEvents(
    businessId: string,
    daysBack: number = 30,
    minimumSeverity: 'medium' | 'high' | 'critical' = 'high'
  ): Promise<IAuditLog[]> {
    try {
      const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      const severityLevels = minimumSeverity === 'critical' 
        ? ['critical'] 
        : minimumSeverity === 'high' 
          ? ['high', 'critical'] 
          : ['medium', 'high', 'critical'];

      return await AuditLog.find({
        businessId,
        severity: { $in: severityLevels },
        timestamp: { $gte: startDate }
      })
      .sort({ timestamp: -1 })
      .populate('userId', 'email name')
      .lean() as IAuditLog[];

    } catch (error) {
      logger.error('Failed to get security events:', error);
      throw new Error('Failed to retrieve security events');
    }
  }

  private calculateSeverity(eventData: AuditEventData): 'low' | 'medium' | 'high' | 'critical' {
    // Critical events
    if (eventData.action === 'deleted' && ['business', 'user'].includes(eventData.entityType)) {
      return 'critical';
    }
    
    if (eventData.entityType === 'user' && ['created', 'updated'].includes(eventData.action)) {
      return 'high';
    }

    // High severity events
    if (eventData.action === 'updated' && eventData.entityType === 'business') {
      return 'high';
    }

    if (eventData.entityType === 'integration' && ['created', 'updated', 'deleted'].includes(eventData.action)) {
      return 'high';
    }

    // Medium severity events
    if (eventData.action === 'exported' || eventData.action === 'imported') {
      return 'medium';
    }

    if (eventData.entityType === 'filing') {
      return 'medium';
    }

    // Default to low
    return 'low';
  }

  private isComplianceRelevant(eventData: AuditEventData): boolean {
    // All financial and tax-related operations are compliance relevant
    if (['transaction', 'tax_rate', 'filing'].includes(eventData.entityType)) {
      return true;
    }

    // User management in financial contexts is compliance relevant
    if (eventData.entityType === 'user' && ['created', 'updated', 'deleted'].includes(eventData.action)) {
      return true;
    }

    // Business configuration changes are compliance relevant
    if (eventData.entityType === 'business' && eventData.action !== 'accessed') {
      return true;
    }

    // Integration changes affect tax calculations
    if (eventData.entityType === 'integration') {
      return true;
    }

    return false;
  }

  private mapSeverityToBreadcrumb(severity: string): 'debug' | 'info' | 'warning' | 'error' {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'info';
    }
  }
}

export const auditLogService = AuditLogService.getInstance();