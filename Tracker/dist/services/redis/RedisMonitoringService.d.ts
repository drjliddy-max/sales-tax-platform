interface SystemHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    components: {
        redis: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            connections: any;
            metrics: any;
            latency?: number;
        };
        cache: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            hitRate: number;
            size: any;
            metrics: any;
        };
        queues: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            metrics: any;
            failedJobs: number;
        };
        sessions: {
            status: 'healthy' | 'degraded' | 'unhealthy';
            metrics: any;
        };
    };
    alerts: Array<{
        severity: 'warning' | 'error' | 'critical';
        component: string;
        message: string;
        timestamp: Date;
    }>;
}
interface PerformanceMetrics {
    redis: {
        latency: {
            current: number;
            average: number;
            p95: number;
            p99: number;
        };
        throughput: {
            commandsPerSecond: number;
            connectionsPerSecond: number;
        };
        memory: {
            used: string;
            peak: string;
            fragmentation: number;
        };
    };
    cache: {
        hitRate: number;
        missRate: number;
        evictions: number;
        keyspaceHits: number;
        keyspaceMisses: number;
    };
    queues: {
        totalProcessed: number;
        averageProcessingTime: number;
        failureRate: number;
        backlogSize: number;
    };
}
export declare class RedisMonitoringService {
    private static instance;
    private redisConnection;
    private cacheService;
    private jobQueue;
    private sessionService;
    private performanceHistory;
    private alertHistory;
    private monitoringInterval;
    private constructor();
    static getInstance(): RedisMonitoringService;
    getSystemHealth(): Promise<SystemHealth>;
    private determineCacheStatus;
    private determineSessionStatus;
    getPerformanceMetrics(): Promise<PerformanceMetrics>;
    private calculateAverageLatency;
    private calculatePercentileLatency;
    private calculateAverageProcessingTime;
    collectDiagnostics(): Promise<{
        redis: any;
        cache: any;
        queues: any;
        system: any;
    }>;
    runHealthChecks(): Promise<{
        overall: 'pass' | 'fail';
        checks: Array<{
            name: string;
            status: 'pass' | 'fail';
            duration: number;
            message?: string;
        }>;
    }>;
    private runSingleHealthCheck;
    private testCacheFunctionality;
    private testQueueFunctionality;
    private testPerformance;
    generateReport(): Promise<{
        summary: {
            status: string;
            uptime: number;
            lastCheck: Date;
        };
        performance: PerformanceMetrics;
        alerts: any[];
        recommendations: string[];
    }>;
    private generateRecommendations;
    private startMonitoring;
    optimizeRedis(): Promise<{
        optimizations: string[];
        before: any;
        after: any;
    }>;
    getAlertHistory(limit?: number): any[];
    getPerformanceHistory(hours?: number): any[];
    shutdown(): Promise<void>;
}
export declare const redisMonitoring: RedisMonitoringService;
export {};
//# sourceMappingURL=RedisMonitoringService.d.ts.map