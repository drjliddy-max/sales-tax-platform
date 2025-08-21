export interface ErrorContext {
    operation: string;
    userId?: string;
    integrationId?: string;
    additionalData?: Record<string, any>;
}
export interface ActionableError {
    code: string;
    message: string;
    userMessage: string;
    suggestedActions: string[];
    retryable: boolean;
    context: ErrorContext;
}
export declare class EnhancedErrorHandler {
    static createActionableError(error: Error, context: ErrorContext, userFriendlyMessage?: string): ActionableError;
    private static categorizeError;
    private static getUserFriendlyMessage;
    private static getSuggestedActions;
    private static isRetryable;
}
export interface WebhookPayload {
    id: string;
    event: string;
    data: any;
    timestamp: Date;
    signature?: string;
}
export interface WebhookDeliveryOptions {
    maxRetries: number;
    retryDelays: number[];
    timeout: number;
    verifySignature: boolean;
}
export declare class ReliableWebhookService {
    private static readonly DEFAULT_OPTIONS;
    static deliverWebhook(url: string, payload: WebhookPayload, secret?: string, options?: Partial<WebhookDeliveryOptions>): Promise<boolean>;
    private static generateSignature;
    private static attemptDelivery;
    private static sleep;
}
export interface CacheOptions {
    ttl: number;
    maxSize?: number;
    warmupKeys?: string[];
}
export declare class PerformanceOptimizer {
    private cache;
    private options;
    constructor(options: CacheOptions);
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: any): Promise<void>;
    warmup(warmupFunction: (key: string) => Promise<any>): Promise<void>;
    clear(): void;
    getStats(): {
        size: number;
        maxSize: number | undefined;
        ttl: number;
    };
}
export declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerOptions {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringWindow: number;
}
export declare class CircuitBreaker {
    private state;
    private failures;
    private nextAttempt;
    private options;
    constructor(options: CircuitBreakerOptions);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private recordFailure;
    private reset;
    getState(): CircuitState;
    getFailures(): number;
}
export interface HealthMetrics {
    availability: number;
    responseTime: number;
    errorRate: number;
    lastSuccessfulSync: Date | null;
    totalRequests: number;
    failedRequests: number;
}
export declare class IntegrationHealthMonitor {
    private metrics;
    recordRequest(integrationId: string, success: boolean, responseTime: number): void;
    getHealthScore(integrationId: string): number;
    private getRecentnessScore;
    private getDefaultMetrics;
    getMetrics(integrationId: string): HealthMetrics | null;
    getAllMetrics(): Map<string, HealthMetrics>;
}
export interface RetryOptions {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
    jitter: boolean;
}
export declare class SmartRetryService {
    private static readonly DEFAULT_OPTIONS;
    static executeWithRetry<T>(operation: () => Promise<T>, options?: Partial<RetryOptions>): Promise<T>;
    private static isRetryableError;
    private static calculateDelay;
    private static sleep;
}
export interface AnalyticsEvent {
    event: string;
    integrationId: string;
    userId?: string;
    timestamp: Date;
    properties: Record<string, any>;
}
export declare class AdvancedAnalyticsService {
    private events;
    track(event: AnalyticsEvent): void;
    getIntegrationMetrics(integrationId: string, timeRange: {
        start: Date;
        end: Date;
    }): {
        totalEvents: number;
        uniqueUsers: number;
        eventTypes: Record<string, number>;
        timeline: Record<string, number>;
    };
    private groupBy;
    private groupEventsByTimeWindow;
    generateReport(timeRange: {
        start: Date;
        end: Date;
    }): {
        summary: {
            totalEvents: number;
            uniqueIntegrations: number;
            uniqueUsers: number;
            timeRange: {
                start: Date;
                end: Date;
            };
        };
        byIntegration: {
            integrationId: string;
            metrics: {
                totalEvents: number;
                uniqueUsers: number;
                eventTypes: Record<string, number>;
                timeline: Record<string, number>;
            };
        }[];
    };
}
//# sourceMappingURL=CompetitiveEnhancements.d.ts.map