export declare class POSInitializer {
    private static instance;
    private initialized;
    static getInstance(): POSInitializer;
    initialize(): Promise<void>;
    isInitialized(): boolean;
    cleanup(): Promise<void>;
}
export declare const posInitializer: POSInitializer;
//# sourceMappingURL=POSInitializer.d.ts.map