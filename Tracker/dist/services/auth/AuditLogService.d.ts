import { IAuditLog } from '@/models';
import { UserRole } from '@/services/auth/Auth0Service';
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
export declare class AuditLogService {
    private static instance;
    private constructor();
    static getInstance(): AuditLogService;
    logEvent(eventData: AuditEventData): Promise<void>;
    getBusinessAuditTrail(businessId: string, options?: {
        startDate?: Date;
        endDate?: Date;
        entityType?: string;
        action?: string;
        userId?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        logs: IAuditLog[];
        total: number;
    }>;
    getComplianceReport(businessId: string, startDate: Date, endDate: Date, regulatoryCategory?: string): Promise<{
        events: IAuditLog[];
        summary: {
            totalEvents: number;
            criticalEvents: number;
            userActions: Record<string, number>;
            entityChanges: Record<string, number>;
        };
    }>;
    getSecurityEvents(businessId: string, daysBack?: number, minimumSeverity?: 'medium' | 'high' | 'critical'): Promise<IAuditLog[]>;
    private calculateSeverity;
    private isComplianceRelevant;
    private mapSeverityToBreadcrumb;
}
export declare const auditLogService: AuditLogService;
//# sourceMappingURL=AuditLogService.d.ts.map