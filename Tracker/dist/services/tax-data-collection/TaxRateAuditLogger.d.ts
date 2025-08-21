import { Document } from 'mongoose';
interface ITaxRateAuditLog extends Document {
    eventType: 'rate_updated' | 'rate_added' | 'rate_removed' | 'compliance_alert' | 'validation_error';
    timestamp: Date;
    state: string;
    jurisdiction: string;
    jurisdictionType: string;
    oldData?: any;
    newData?: any;
    changeDetails: {
        rateDifference?: number;
        effectiveDateChange?: boolean;
        sourceChanged?: boolean;
        categoryChanges?: string[];
    };
    metadata: {
        source: string;
        sourceUrl: string;
        updateMethod: 'manual' | 'scheduled' | 'emergency' | 'firecrawl';
        userId?: string;
        validationResult?: any;
        confidence: 'high' | 'medium' | 'low';
    };
    impact: {
        severity: 'low' | 'medium' | 'high' | 'critical';
        affectedBusinesses?: number;
        estimatedVolumeImpact?: number;
    };
    reviewStatus: 'pending' | 'reviewed' | 'approved' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: Date;
    reviewNotes?: string;
}
export declare const TaxRateAuditLog: import("mongoose").Model<ITaxRateAuditLog, {}, {}, {}, Document<unknown, {}, ITaxRateAuditLog> & ITaxRateAuditLog & {
    _id: import("mongoose").Types.ObjectId;
}, any>;
export declare class TaxRateAuditLogger {
    logRateUpdate(state: string, jurisdiction: string, jurisdictionType: string, oldRate: any, newRate: any, metadata: any): Promise<void>;
    logComplianceAlert(alertData: any): Promise<void>;
    logValidationError(state: string, jurisdiction: string, errorData: any, metadata: any): Promise<void>;
    private analyzeChanges;
    private identifyCategoryChanges;
    private assessImpact;
    private estimateAffectedBusinesses;
    private estimateVolumeImpact;
    getAuditTrail(state?: string, jurisdiction?: string, startDate?: Date, endDate?: Date, eventType?: string): Promise<ITaxRateAuditLog[]>;
    generateAuditReport(startDate: Date, endDate: Date, state?: string): Promise<any>;
    private getTopChanges;
    private getValidationSummary;
    private getCommonValidationErrors;
    private getSourceSummary;
    markForReview(logId: string, severity: 'high' | 'critical', reviewNotes?: string): Promise<boolean>;
    approveAuditLog(logId: string, reviewedBy: string, reviewNotes?: string): Promise<boolean>;
    getPendingReviews(state?: string): Promise<ITaxRateAuditLog[]>;
    getCriticalEvents(days?: number): Promise<ITaxRateAuditLog[]>;
    getRecentActivity(state: string, jurisdiction: string, limit?: number): Promise<ITaxRateAuditLog[]>;
    exportAuditData(startDate: Date, endDate: Date, format?: 'json' | 'csv'): Promise<any>;
    private convertToCSV;
    cleanupOldLogs(retentionDays?: number): Promise<number>;
}
export {};
//# sourceMappingURL=TaxRateAuditLogger.d.ts.map