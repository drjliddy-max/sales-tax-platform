interface ComplianceCheck {
    type: 'accuracy' | 'filing' | 'rate_compliance' | 'threshold_monitoring';
    businessId: string;
    jurisdiction: string;
    status: 'pass' | 'warning' | 'fail';
    score: number;
    details: string;
    metadata: Record<string, any>;
    timestamp: Date;
}
interface AuditTrail {
    entityType: 'transaction' | 'tax_rate' | 'business' | 'filing';
    entityId: string;
    action: 'created' | 'updated' | 'deleted' | 'calculated';
    userId?: string;
    businessId: string;
    changes: Record<string, any>;
    timestamp: Date;
    ipAddress?: string;
    jurisdiction?: string;
}
export declare class ComplianceMonitoringService {
    private static instance;
    private complianceCache;
    private auditTrail;
    private filingRequirements;
    private constructor();
    static getInstance(): ComplianceMonitoringService;
    performComplianceCheck(check: Omit<ComplianceCheck, 'timestamp'>): Promise<string>;
    auditTaxCalculation(transactionId: string, calculatedTax: number, expectedTax?: number, businessId?: string): Promise<void>;
    logAuditEvent(event: AuditTrail): void;
    monitorFilingRequirements(): Promise<void>;
    private checkBusinessFilingRequirements;
    detectTaxCalculationAnomalies(businessId: string): Promise<void>;
    private mapCheckTypeToWorkflow;
    private startComplianceMonitoring;
    private runScheduledComplianceChecks;
    private runAnomalyDetection;
    private checkTaxRateCompliance;
    getComplianceReport(businessId?: string): {
        overallScore: number;
        checks: ComplianceCheck[];
        alerts: Array<{
            type: string;
            severity: string;
            message: string;
            timestamp: Date;
        }>;
        recentAudits: AuditTrail[];
    };
    generateComplianceReport(businessId: string): Promise<{
        business: {
            id: string;
            name: string;
            complianceScore: number;
        };
        taxAccuracy: {
            score: number;
            anomaliesDetected: number;
            totalCalculations: number;
        };
        filingStatus: {
            upcomingFilings: number;
            overdueFilings: number;
            totalTaxOwed: number;
        };
        systemHealth: {
            posIntegrations: Array<{
                type: string;
                status: string;
                lastSync: Date | null;
            }>;
            redisPerformance: string;
            overallHealth: string;
        };
    }>;
    getAuditTrail(businessId?: string, limit?: number): AuditTrail[];
    clearAuditTrail(businessId?: string): void;
}
export declare const complianceMonitoring: ComplianceMonitoringService;
export {};
//# sourceMappingURL=ComplianceMonitoringService.d.ts.map