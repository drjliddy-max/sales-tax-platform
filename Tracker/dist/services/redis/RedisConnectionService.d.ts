import Redis from 'ioredis';
interface ConnectionMetrics {
    totalConnections: number;
    activeConnections: number;
    failedConnections: number;
    lastConnectionTime?: Date;
    lastErrorTime?: Date;
    lastError?: string;
}
export declare class RedisConnectionService {
    private static instance;
    private redis;
    private pubSubClient;
    private connectionPool;
    private connectionMetrics;
    private healthCheckInterval;
    private isShuttingDown;
    private constructor();
    static getInstance(): RedisConnectionService;
    private parseRedisUrl;
    private initializeConnection;
    private setupEventHandlers;
    private waitForConnection;
    getClient(): Promise<Redis>;
    getPubSubClient(): Promise<Redis>;
    getPooledConnection(poolName: string): Promise<Redis>;
    testConnection(): Promise<boolean>;
    getConnectionHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        connections: {
            main: string;
            pubsub: string;
            pooled: string[];
        };
        metrics: ConnectionMetrics;
        latency?: number;
    }>;
    private startHealthChecks;
    flushDatabase(confirm?: boolean): Promise<void>;
    getRedisInfo(): Promise<any>;
    shutdown(): Promise<void>;
}
export {};
//# sourceMappingURL=RedisConnectionService.d.ts.map