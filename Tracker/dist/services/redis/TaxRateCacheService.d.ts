interface CachedTaxRate {
    id: string;
    state: string;
    jurisdiction: string;
    jurisdictionType: string;
    rate: number;
    effectiveDate: Date;
    lastUpdated: Date;
    productCategories?: string[];
    isActive: boolean;
}
interface CacheMetrics {
    hits: number;
    misses: number;
    writes: number;
    deletes: number;
    errors: number;
    lastResetTime: Date;
}
interface TaxRateQuery {
    state: string;
    jurisdiction?: string;
    jurisdictionType?: string;
    address?: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
    };
    productCategory?: string;
}
export declare class TaxRateCacheService {
    private redisConnection;
    private cacheMetrics;
    private readonly DEFAULT_TTL;
    private readonly FREQUENTLY_ACCESSED_TTL;
    private readonly BULK_OPERATION_TTL;
    private readonly CACHE_VERSION;
    constructor();
    private generateCacheKey;
    private generateJurisdictionSetKey;
    private generateStatsKey;
    getCachedTaxRates(query: TaxRateQuery): Promise<CachedTaxRate[] | null>;
    cacheTaxRates(query: TaxRateQuery, taxRates: CachedTaxRate[], customTtl?: number): Promise<void>;
    private calculateIntelligentTtl;
    private updateAccessFrequency;
    private cacheJurisdictionList;
    getAvailableJurisdictions(state: string): Promise<string[]>;
    invalidateCache(pattern?: string): Promise<number>;
    invalidateForJurisdiction(state: string, jurisdiction?: string): Promise<number>;
    warmupCache(): Promise<void>;
    private updateCacheStats;
    getCacheStats(): Promise<CacheMetrics & {
        hitRate: number;
    }>;
    preloadFrequentlyAccessedRates(): Promise<void>;
    bulkInvalidateByStates(states: string[]): Promise<number>;
    getCacheSize(): Promise<{
        totalKeys: number;
        memoryUsage: string;
        taxRateKeys: number;
    }>;
    setTaxRateExpirationAlert(cacheKey: string, alertThresholdHours?: number): Promise<void>;
    getExpiringSoon(hoursAhead?: number): Promise<string[]>;
    refreshExpiringSoon(): Promise<number>;
    resetMetrics(): void;
    getMetrics(): CacheMetrics & {
        hitRate: number;
    };
}
export declare const taxRateCache: TaxRateCacheService;
export {};
//# sourceMappingURL=TaxRateCacheService.d.ts.map