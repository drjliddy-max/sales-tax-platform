interface POSIntegrationEvent {
    type: 'square' | 'shopify' | 'clover';
    businessId: string;
    operation: 'sync' | 'webhook' | 'payment' | 'refund' | 'connection_test';
    status: 'success' | 'partial' | 'failed';
    duration: number;
    recordCount?: number;
    errorDetails?: string;
    metadata?: Record<string, any>;
}
interface POSHealthMetrics {
    integrationId: string;
    type: 'square' | 'shopify' | 'clover';
    businessId: string;
    isConnected: boolean;
    lastSuccessfulSync?: Date;
    errorRate: number;
    avgResponseTime: number;
    totalTransactions: number;
    failedTransactions: number;
    uptime: number;
}
export declare class POSMonitoringService {
    private static instance;
    private integrationMetrics;
    private alertCooldowns;
    private constructor();
    static getInstance(): POSMonitoringService;
    trackPOSEvent(event: POSIntegrationEvent): void;
    private mapEventStatusToHealth;
    private updateIntegrationMetrics;
    private checkPOSAlerts;
    monitorPOSWebhook(webhookData: {
        source: string;
        businessId: string;
        eventType: string;
        processingTime: number;
        success: boolean;
        errorMessage?: string;
    }): Promise<void>;
    getPOSIntegrationMetrics(businessId: string): POSHealthMetrics[];
    getAllPOSMetrics(): Map<string, POSHealthMetrics>;
    generatePOSHealthReport(): Promise<{
        summary: {
            totalIntegrations: number;
            healthyIntegrations: number;
            degradedIntegrations: number;
            failedIntegrations: number;
        };
        integrations: POSHealthMetrics[];
        alerts: Array<{
            businessId: string;
            type: string;
            severity: string;
            message: string;
        }>;
    }>;
    resetMetrics(businessId?: string): void;
}
export declare const posMonitoring: POSMonitoringService;
export {};
//# sourceMappingURL=POSMonitoringService.d.ts.map