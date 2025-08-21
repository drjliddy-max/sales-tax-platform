import { CircuitBreaker, CircuitBreakerOptions, RetryOptions, PerformanceOptimizer, CacheOptions, IntegrationHealthMonitor, WebhookPayload, WebhookDeliveryOptions, AdvancedAnalyticsService } from './CompetitiveEnhancements';
export interface SyncResult {
    success: boolean;
    recordsProcessed: number;
    recordsUpdated: number;
    recordsCreated: number;
    recordsFailed: number;
    errors: string[];
    lastSyncTime: Date;
}
export interface TaxCalculationRequest {
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        taxCategory?: string;
    }>;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    customerTaxExempt?: boolean;
}
export interface TaxCalculationResult {
    subtotal: number;
    totalTax: number;
    grandTotal: number;
    taxBreakdown: Array<{
        jurisdiction: string;
        rate: number;
        amount: number;
        type: string;
    }>;
    itemBreakdown: Array<{
        id: string;
        subtotal: number;
        tax: number;
        total: number;
    }>;
}
export interface TransactionUpdateRequest {
    transactionId: string;
    status: 'completed' | 'cancelled' | 'refunded';
    amount?: number;
    taxAmount?: number;
    metadata?: Record<string, any>;
}
export interface AdapterConfiguration {
    id: string;
    name: string;
    enabled: boolean;
    credentials: Record<string, string>;
    settings: Record<string, any>;
    circuitBreakerOptions?: CircuitBreakerOptions;
    retryOptions?: RetryOptions;
    cacheOptions?: CacheOptions;
    webhookSecret?: string;
}
export declare abstract class EnhancedBaseAdapter {
    protected readonly config: AdapterConfiguration;
    protected readonly circuitBreaker: CircuitBreaker;
    protected readonly cache: PerformanceOptimizer;
    protected readonly healthMonitor: IntegrationHealthMonitor;
    protected readonly analytics: AdvancedAnalyticsService;
    constructor(config: AdapterConfiguration);
    protected abstract doSyncTransactions(lastSyncTime?: Date): Promise<SyncResult>;
    protected abstract doSyncProducts(lastSyncTime?: Date): Promise<SyncResult>;
    protected abstract doSyncCustomers(lastSyncTime?: Date): Promise<SyncResult>;
    protected abstract doCalculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult>;
    syncTransactions(lastSyncTime?: Date): Promise<SyncResult>;
    syncProducts(lastSyncTime?: Date): Promise<SyncResult>;
    syncCustomers(lastSyncTime?: Date): Promise<SyncResult>;
    calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult>;
    updateTransaction(request: TransactionUpdateRequest): Promise<boolean>;
    handleWebhook(payload: any, signature?: string): Promise<boolean>;
    sendWebhook(url: string, payload: WebhookPayload, options?: Partial<WebhookDeliveryOptions>): Promise<boolean>;
    getHealthMetrics(): {
        id: string;
        name: string;
        enabled: boolean;
        healthScore: number;
        circuitState: import("./CompetitiveEnhancements").CircuitState;
        metrics: import("./CompetitiveEnhancements").HealthMetrics | null;
        cacheStats: {
            size: number;
            maxSize: number | undefined;
            ttl: number;
        };
        lastUpdated: Date;
    };
    getAnalyticsReport(timeRange: {
        start: Date;
        end: Date;
    }): {
        totalEvents: number;
        uniqueUsers: number;
        eventTypes: Record<string, number>;
        timeline: Record<string, number>;
    };
    protected executeWithEnhancements<T>(operation: string, fn: () => Promise<T>, options?: {
        useCache?: boolean;
        cacheTTL?: number;
        cacheKey?: string;
    }): Promise<T>;
    protected processWebhook(payload: any): Promise<boolean>;
    protected verifyWebhookSignature(payload: any, signature: string): boolean;
    protected generateTaxCacheKey(request: TaxCalculationRequest): string;
    protected trackAnalyticsEvent(event: string, properties?: Record<string, any>): void;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=EnhancedBaseAdapter.d.ts.map