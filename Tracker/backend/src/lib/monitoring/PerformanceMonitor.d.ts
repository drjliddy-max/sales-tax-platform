import { EventEmitter } from 'events';
interface Metric {
    name: string;
    value: number;
    timestamp: Date;
    tags?: Record<string, string>;
}
interface SystemHealth {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
    errorRate: number;
    responseTimeP95: number;
}
export declare class PerformanceMonitor extends EventEmitter {
    private static instance;
    private metrics;
    private timers;
    private responseTimes;
    private errorCount;
    private requestCount;
    private startTime;
    private activeConnections;
    private constructor();
    static getInstance(): PerformanceMonitor;
    recordMetric(name: string, value: number, tags?: Record<string, string>): void;
    startTimer(name: string, tags?: Record<string, string>): void;
    endTimer(name: string): number | undefined;
    recordRequest(): void;
    recordResponse(statusCode: number, responseTime: number): void;
    recordError(error: Error, context?: string): void;
    recordPOSOperation(operation: string, posId: string, duration: number, success: boolean): void;
    recordPOSSync(posId: string, recordsSynced: number, duration: number, errors: number): void;
    getSystemHealth(): SystemHealth;
    getMetrics(name?: string, since?: Date): Metric[];
    getAverageResponseTime(minutes?: number): number;
    getErrorRate(minutes?: number): number;
    private calculatePercentile;
    private setupCleanupInterval;
    private setupHealthCheck;
    checkAlerts(): void;
    exportMetrics(format?: 'json' | 'prometheus'): string;
    private formatPrometheus;
}
export declare const performanceMonitor: PerformanceMonitor;
export declare const monitoringMiddleware: (req: any, res: any, next: any) => void;
export {};
//# sourceMappingURL=PerformanceMonitor.d.ts.map