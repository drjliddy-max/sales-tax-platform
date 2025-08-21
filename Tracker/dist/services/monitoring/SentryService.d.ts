import * as Sentry from '@sentry/node';
interface ComplianceAlert {
    type: 'accuracy' | 'threshold' | 'filing' | 'rate_change' | 'anomaly';
    severity: 'low' | 'medium' | 'high' | 'critical';
    businessId: string;
    jurisdiction: string;
    message: string;
    metadata: Record<string, any>;
    timestamp: Date;
}
interface ComplianceWorkflow {
    type: 'tax_filing' | 'rate_update' | 'audit_trail' | 'compliance_check';
    businessId: string;
    jurisdiction: string;
    status: 'completed' | 'failed';
    complianceScore?: number;
}
interface POSIntegrationHealth {
    type: 'square' | 'shopify' | 'clover';
    businessId: string;
    status: 'healthy' | 'degraded' | 'failed';
    errorCount: number;
    responseTime: number;
    transactionsSynced?: number;
}
interface RedisPerformance {
    operation: string;
    latency: number;
    success: boolean;
    error?: Error;
}
export declare class SentryService {
    private static instance;
    private isInitialized;
    private constructor();
    static getInstance(): SentryService;
    initialize(): void;
    private filterErrorEvent;
    captureFinancialError(error: Error, context: {
        businessId?: string;
        transactionId?: string;
        calculationType?: string;
        jurisdiction?: string;
        amount?: number;
        severity?: 'low' | 'medium' | 'high' | 'critical';
    }): string;
    addBreadcrumb(category: string, message: string, level?: 'debug' | 'info' | 'warning' | 'error', data?: Record<string, any>): void;
    captureMessage(message: string, level?: Sentry.SeverityLevel, context?: Record<string, any>): string;
    trackTaxCalculationAccuracy(data: {
        businessId: string;
        calculatedTax: number;
        confidence: number;
        jurisdiction: string;
        calculationTime: number;
    }): void;
    trackPOSIntegrationHealth(data: POSIntegrationHealth): void;
    trackRedisPerformance(data: RedisPerformance): void;
    trackComplianceWorkflow(data: ComplianceWorkflow): void;
    createComplianceAlert(alert: ComplianceAlert): string;
    createCustomAlert(title: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical', metadata?: Record<string, any>): string;
    startTransaction(name: string, op: string, data?: Record<string, any>): any;
    createSpan(parentTransaction: any, operation: string, description: string): any;
    setUserContext(user: {
        id: string;
        businessId?: string;
        email?: string;
        role?: string;
    }): void;
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        isInitialized: boolean;
        metricsCollected: number;
        lastError?: string;
    }>;
    flush(timeout?: number): Promise<boolean>;
    getRequestHandler(): any;
    getTracingHandler(): any;
    getErrorHandler(): any;
    close(): Promise<boolean>;
}
export declare const sentryService: SentryService;
export {};
//# sourceMappingURL=SentryService.d.ts.map