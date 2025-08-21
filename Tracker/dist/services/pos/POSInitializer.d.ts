export declare class POSInitializer {
    private static instance;
    private pluginManager;
    private registry;
    private initialized;
    private constructor();
    static getInstance(): POSInitializer;
    initialize(): Promise<void>;
    private findPOSPlugins;
    private findPOSRegistry;
    private upsertPOSPlugin;
    private upsertPOSRegistry;
    private updatePOSPlugin;
    private updatePOSRegistry;
    shutdown(): Promise<void>;
}
export declare const posInitializer: POSInitializer;
//# sourceMappingURL=POSInitializer.d.ts.map