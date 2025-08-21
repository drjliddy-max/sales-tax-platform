interface POSSystem {
    id: string;
    name: string;
    description?: string;
    category?: string;
    marketShare?: number;
    logo?: string;
    website?: string;
    supportedRegions?: string[];
    pricing?: any;
    verified: boolean;
    status: 'active' | 'inactive' | 'pending' | 'deprecated';
    clientContributed: boolean;
    contributedBy?: string;
    lastUpdated: string;
    usageStats: {
        clientsUsing: number;
        activeConnections: number;
        monthlyTransactions?: number;
    };
    configuration?: any;
}
interface PluginConfiguration {
    id: string;
    name: string;
    description?: string;
    version: string;
    auth: any;
    endpoints?: any;
    webhooks?: any;
    dataMapping?: any;
    features?: string[];
    lastUpdated: string;
}
export declare class POSAdapter {
    private posSystems;
    private plugins;
    createPOSSystem(data: Partial<POSSystem>): Promise<boolean>;
    getPOSSystem(id: string): Promise<POSSystem | null>;
    getAllPOSSystems(): Promise<POSSystem[]>;
    updatePOSSystem(id: string, data: Partial<POSSystem>): Promise<boolean>;
    deletePOSSystem(id: string): Promise<boolean>;
    searchPOSSystems(query: string): Promise<POSSystem[]>;
    getPOSSystemsByCategory(category: string): Promise<POSSystem[]>;
    getPopularPOSSystems(limit?: number): Promise<POSSystem[]>;
    getRecentlyAddedPOS(limit?: number): Promise<POSSystem[]>;
    getClientContributedPOS(): Promise<POSSystem[]>;
    createPlugin(data: PluginConfiguration): Promise<boolean>;
    getPlugin(id: string): Promise<PluginConfiguration | null>;
    getAllPlugins(): Promise<PluginConfiguration[]>;
    updatePlugin(id: string, data: Partial<PluginConfiguration>): Promise<boolean>;
    deletePlugin(id: string): Promise<boolean>;
    getRegistryStats(): Promise<any>;
    initializeDefaults(): Promise<void>;
}
export declare const posAdapter: POSAdapter;
export {};
//# sourceMappingURL=POSAdapter.d.ts.map