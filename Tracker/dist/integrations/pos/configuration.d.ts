import { POSSystemType, POSConfiguration } from './types';
export declare class ConfigurationManager {
    private static readonly ENCRYPTION_ALGORITHM;
    private static readonly CACHE_TTL;
    private static readonly CACHE_PREFIX;
    private static encryptionKey;
    static saveConfiguration(businessId: string, config: POSConfiguration): Promise<void>;
    static loadConfiguration(businessId: string, posType: POSSystemType): Promise<POSConfiguration | null>;
    static loadAllConfigurations(businessId: string): Promise<POSConfiguration[]>;
    static deleteConfiguration(businessId: string, posType: POSSystemType): Promise<void>;
    static updateLastSync(businessId: string, posType: POSSystemType, timestamp?: Date): Promise<void>;
    static toggleActive(businessId: string, posType: POSSystemType, isActive: boolean): Promise<void>;
    static getActiveConfigurations(businessId: string): Promise<POSConfiguration[]>;
    static validateConfiguration(config: POSConfiguration): {
        isValid: boolean;
        errors: string[];
    };
    static clearCache(businessId: string): Promise<void>;
    private static loadFromCache;
    private static getCacheKey;
    private static encryptCredentials;
    private static decryptCredentials;
    static getConfigurationStats(): Promise<{
        totalConfigurations: number;
        activeConfigurations: number;
        configurationsByPOS: Record<POSSystemType, number>;
        recentSyncs: number;
    }>;
}
//# sourceMappingURL=configuration.d.ts.map