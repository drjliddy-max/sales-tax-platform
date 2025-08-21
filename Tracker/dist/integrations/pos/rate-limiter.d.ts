import { POSSystemType, RetryConfig, POSIntegrationError } from './types';
export declare class RateLimitManager {
    private static instance;
    private requestQueues;
    private processingQueues;
    private metrics;
    private static readonly DEFAULT_RETRY_CONFIG;
    private static readonly RATE_LIMITS;
    private constructor();
    static getInstance(): RateLimitManager;
    executeRequest<T>(posType: POSSystemType, requestFn: () => Promise<T>, priority?: number, retryConfig?: Partial<RetryConfig>): Promise<T>;
    canMakeRequest(posType: POSSystemType, businessId?: string): Promise<{
        allowed: boolean;
        retryAfter?: number;
    }>;
    recordSuccess(posType: POSSystemType, businessId?: string): Promise<void>;
    recordFailure(posType: POSSystemType, error: POSIntegrationError, businessId?: string): Promise<void>;
    getRateLimitStatus(posType: POSSystemType, businessId?: string): Promise<{
        remaining: number;
        resetTime: number;
        retryAfter?: number;
        consecutiveErrors: number;
    }>;
    private startQueueProcessors;
    private processQueue;
    private enqueueRequest;
    private incrementRequestCount;
    private getMetrics;
    private updateMetrics;
    private getMetricsKey;
    private calculateBackoffTime;
    private calculateRetryDelay;
    private shouldRetry;
    private wrapError;
    private extractRetryAfter;
    private generateRequestId;
    private sleep;
    getQueueStatus(): Record<POSSystemType, {
        queueLength: number;
        processing: boolean;
    }>;
    clearAllQueues(): void;
}
//# sourceMappingURL=rate-limiter.d.ts.map