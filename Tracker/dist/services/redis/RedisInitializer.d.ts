export declare class RedisInitializer {
    private isInitialized;
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<boolean>;
    isReady(): boolean;
}
export declare const redisInitializer: RedisInitializer;
//# sourceMappingURL=RedisInitializer.d.ts.map