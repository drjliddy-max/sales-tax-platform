import mongoose, { Document } from 'mongoose';
import { UserRole } from '@/services/auth/Auth0Service';
export interface IAuditLog extends Document {
    entityType: 'transaction' | 'tax_rate' | 'business' | 'filing' | 'user' | 'integration';
    entityId: string;
    action: 'created' | 'updated' | 'deleted' | 'accessed' | 'exported' | 'imported';
    userId: string;
    businessId: string;
    userRole: UserRole;
    userPermissions: string[];
    changes: {
        before?: Record<string, any>;
        after?: Record<string, any>;
        fieldChanges?: Array<{
            field: string;
            oldValue: any;
            newValue: any;
        }>;
    };
    metadata: {
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
    severity: 'low' | 'medium' | 'high' | 'critical';
    compliance: {
        isComplianceRelevant: boolean;
        regulatoryCategory?: 'tax_calculation' | 'user_management' | 'data_retention' | 'financial_reporting';
        retentionRequiredUntil?: Date;
        jurisdictions?: string[];
    };
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<IAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, IAuditLog> & IAuditLog & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
//# sourceMappingURL=AuditLog.d.ts.map