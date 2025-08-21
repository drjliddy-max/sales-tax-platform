import { EventEmitter } from 'events';
import { POSPluginConfig } from '../plugins/POSPluginManager';
export interface POSRegistryEntry {
    id: string;
    name: string;
    description: string;
    category: 'popular' | 'restaurant' | 'retail' | 'enterprise' | 'mobile' | 'specialty';
    marketShare: 'high' | 'medium' | 'low';
    popularity: number;
    clientContributed: boolean;
    verified: boolean;
    status: 'active' | 'deprecated' | 'beta';
    logo?: string;
    website?: string;
    supportedRegions: string[];
    pricing: 'free' | 'paid' | 'freemium' | 'enterprise';
    lastUpdated: Date;
    contributedBy?: string;
    configuration?: POSPluginConfig;
    usageStats: {
        activeConnections: number;
        monthlyTransactions: number;
        clientsUsing: number;
    };
}
export declare class POSRegistry extends EventEmitter {
    private registry;
    private database;
    private popularThreshold;
    constructor(database: any);
    private initializeRegistry;
    private addPopularPOSSystems;
    addToRegistry(entry: POSRegistryEntry): Promise<boolean>;
    registerClientPOS(posData: Partial<POSRegistryEntry>, contributedBy: string, configuration?: POSPluginConfig): Promise<boolean>;
    getPOSByCategory(category?: string): POSRegistryEntry[];
    getPopularPOS(): POSRegistryEntry[];
    getRecentlyAdded(limit?: number): POSRegistryEntry[];
    getClientContributed(): POSRegistryEntry[];
    searchPOS(query: string): POSRegistryEntry[];
    updateUsageStats(posId: string, stats: Partial<POSRegistryEntry['usageStats']>): Promise<boolean>;
    verifyPOS(posId: string): Promise<boolean>;
    getPOS(posId: string): POSRegistryEntry | null;
    getRegistryStats(): {
        totalSystems: number;
        verifiedSystems: number;
        clientContributed: number;
        popularSystems: number;
        categories: {
            popular: number;
            restaurant: number;
            retail: number;
            enterprise: number;
            mobile: number;
            specialty: number;
        };
        totalActiveConnections: number;
        totalMonthlyTransactions: number;
    };
    exportRegistry(): POSRegistryEntry[];
}
export default POSRegistry;
//# sourceMappingURL=POSRegistry.d.ts.map