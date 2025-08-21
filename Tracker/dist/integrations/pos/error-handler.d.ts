import { EventEmitter } from 'events';
import { POSSystemType, POSIntegrationError, RetryConfig } from './types';
interface ErrorContext {
    businessId?: string;
    locationId?: string;
    operation: string;
    posType: POSSystemType;
    timestamp: Date;
    metadata?: Record<string, any>;
}
interface HealthMetrics {
    posType: POSSystemType;
    businessId: string;
    successRate: number;
    errorRate: number;
    avgResponseTime: number;
    lastError?: POSIntegrationError;
    connectionStatus: 'healthy' | 'degraded' | 'unhealthy' | 'disconnected';
    lastHealthCheck: Date;
}
export declare class ErrorHandler extends EventEmitter {
    private static instance;
    private rateLimitManager;
    private recoveryQueue;
    private isProcessingRecovery;
    private healthMetrics;
    private static readonly ERROR_RETENTION_DAYS;
    private static readonly HEALTH_CHECK_INTERVAL;
    private static readonly RECOVERY_INTERVALS;
    private constructor();
    static getInstance(): ErrorHandler;
    handleError(error: POSIntegrationError, context: ErrorContext, retryConfig?: RetryConfig): Promise<void>;
    private logError;
    private updateHealthMetrics;
    private calculateErrorRate;
    private getTotalRequests;
    private detectErrorPatterns;
    private suggestResolutionStrategy;
    private determineRecoveryStrategy;
    private isRecoverableError;
    private getRecoveryType;
    private getRecoveryDelay;
    private getMaxAttempts;
    private findExistingRecoveryAction;
    private scheduleRecoveryAction;
    private startRecoveryProcessing;
    private executeRecoveryAction;
    private refreshToken;
    private resetConnection;
    private disableIntegration;
    private startHealthChecking;
    private performHealthChecks;
    private checkIntegrationHealth;
    private setupErrorPatternDetection;
    getErrorStats(): Promise<{
        totalErrors: number;
        errorsByPOS: Record<POSSystemType, number>;
        errorsByCode: Record<string, number>;
        recoveryActions: {
            total: number;
            successful: number;
            failed: number;
        };
    }>;
    getHealthMetrics(): HealthMetrics[];
}
export {};
//# sourceMappingURL=error-handler.d.ts.map