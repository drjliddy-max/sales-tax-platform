"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxRateCache = exports.TaxRateCacheService = void 0;
const RedisConnectionService_1 = require("./RedisConnectionService");
const utils_1 = require("@/utils");
const models_1 = require("@/models");
class TaxRateCacheService {
    constructor() {
        this.cacheMetrics = {
            hits: 0,
            misses: 0,
            writes: 0,
            deletes: 0,
            errors: 0,
            lastResetTime: new Date()
        };
        this.DEFAULT_TTL = 24 * 60 * 60;
        this.FREQUENTLY_ACCESSED_TTL = 48 * 60 * 60;
        this.BULK_OPERATION_TTL = 12 * 60 * 60;
        this.CACHE_VERSION = '1.0';
        this.redisConnection = RedisConnectionService_1.RedisConnectionService.getInstance();
    }
    generateCacheKey(query) {
        const parts = [
            'tax-rate',
            this.CACHE_VERSION,
            query.state,
            query.jurisdiction || 'all',
            query.jurisdictionType || 'all',
            query.productCategory || 'general'
        ];
        if (query.address) {
            parts.push(query.address.zipCode);
        }
        return parts.join(':').toLowerCase();
    }
    generateJurisdictionSetKey(state) {
        return `tax-rate:${this.CACHE_VERSION}:jurisdictions:${state.toLowerCase()}`;
    }
    generateStatsKey() {
        return `tax-rate:${this.CACHE_VERSION}:stats`;
    }
    async getCachedTaxRates(query) {
        try {
            const client = await this.redisConnection.getClient();
            const cacheKey = this.generateCacheKey(query);
            const cachedData = await client.get(cacheKey);
            if (cachedData) {
                this.cacheMetrics.hits++;
                const parsedData = JSON.parse(cachedData);
                if (Array.isArray(parsedData) && parsedData.length > 0) {
                    utils_1.logger.debug(`Cache HIT for ${cacheKey}`);
                    await this.updateAccessFrequency(cacheKey);
                    return parsedData.map(item => ({
                        ...item,
                        effectiveDate: new Date(item.effectiveDate),
                        lastUpdated: new Date(item.lastUpdated)
                    }));
                }
            }
            this.cacheMetrics.misses++;
            utils_1.logger.debug(`Cache MISS for ${cacheKey}`);
            return null;
        }
        catch (error) {
            this.cacheMetrics.errors++;
            utils_1.logger.error('Error retrieving from tax rate cache:', error);
            return null;
        }
    }
    async cacheTaxRates(query, taxRates, customTtl) {
        try {
            const client = await this.redisConnection.getClient();
            const cacheKey = this.generateCacheKey(query);
            const serializedData = JSON.stringify(taxRates.map(rate => ({
                ...rate,
                effectiveDate: rate.effectiveDate.toISOString(),
                lastUpdated: rate.lastUpdated.toISOString()
            })));
            const ttl = customTtl || await this.calculateIntelligentTtl(cacheKey, taxRates.length);
            await client.setex(cacheKey, ttl, serializedData);
            this.cacheMetrics.writes++;
            utils_1.logger.debug(`Cached ${taxRates.length} tax rates for ${cacheKey} (TTL: ${ttl}s)`);
            await this.cacheJurisdictionList(query.state, taxRates);
            await this.updateCacheStats();
        }
        catch (error) {
            this.cacheMetrics.errors++;
            utils_1.logger.error('Error caching tax rates:', error);
            throw error;
        }
    }
    async calculateIntelligentTtl(cacheKey, dataSize) {
        try {
            const client = await this.redisConnection.getClient();
            const accessCount = await client.get(`${cacheKey}:access_count`) || '0';
            const count = parseInt(accessCount);
            if (count > 10) {
                return this.FREQUENTLY_ACCESSED_TTL;
            }
            else if (dataSize > 50) {
                return this.BULK_OPERATION_TTL;
            }
            else {
                return this.DEFAULT_TTL;
            }
        }
        catch (error) {
            utils_1.logger.warn('Error calculating intelligent TTL, using default:', error);
            return this.DEFAULT_TTL;
        }
    }
    async updateAccessFrequency(cacheKey) {
        try {
            const client = await this.redisConnection.getClient();
            const accessKey = `${cacheKey}:access_count`;
            await client.incr(accessKey);
            await client.expire(accessKey, this.FREQUENTLY_ACCESSED_TTL);
        }
        catch (error) {
            utils_1.logger.warn('Error updating access frequency:', error);
        }
    }
    async cacheJurisdictionList(state, taxRates) {
        try {
            const client = await this.redisConnection.getClient();
            const jurisdictionKey = this.generateJurisdictionSetKey(state);
            const jurisdictions = taxRates.map(rate => `${rate.jurisdiction}:${rate.jurisdictionType}`);
            if (jurisdictions.length > 0) {
                await client.sadd(jurisdictionKey, ...jurisdictions);
                await client.expire(jurisdictionKey, this.DEFAULT_TTL);
            }
        }
        catch (error) {
            utils_1.logger.warn('Error caching jurisdiction list:', error);
        }
    }
    async getAvailableJurisdictions(state) {
        try {
            const client = await this.redisConnection.getClient();
            const jurisdictionKey = this.generateJurisdictionSetKey(state);
            const jurisdictions = await client.smembers(jurisdictionKey);
            if (jurisdictions.length > 0) {
                this.cacheMetrics.hits++;
                return jurisdictions;
            }
            else {
                this.cacheMetrics.misses++;
                return [];
            }
        }
        catch (error) {
            this.cacheMetrics.errors++;
            utils_1.logger.error('Error retrieving cached jurisdictions:', error);
            return [];
        }
    }
    async invalidateCache(pattern) {
        try {
            const client = await this.redisConnection.getClient();
            const searchPattern = pattern || `tax-rate:${this.CACHE_VERSION}:*`;
            const keys = await client.keys(searchPattern);
            if (keys.length > 0) {
                const deleted = await client.del(...keys);
                this.cacheMetrics.deletes += deleted;
                utils_1.logger.info(`Invalidated ${deleted} cache entries matching pattern: ${searchPattern}`);
                return deleted;
            }
            return 0;
        }
        catch (error) {
            this.cacheMetrics.errors++;
            utils_1.logger.error('Error invalidating cache:', error);
            throw error;
        }
    }
    async invalidateForJurisdiction(state, jurisdiction) {
        const pattern = jurisdiction
            ? `tax-rate:${this.CACHE_VERSION}:${state.toLowerCase()}:${jurisdiction.toLowerCase()}:*`
            : `tax-rate:${this.CACHE_VERSION}:${state.toLowerCase()}:*`;
        return await this.invalidateCache(pattern);
    }
    async warmupCache() {
        utils_1.logger.info('Starting tax rate cache warmup');
        try {
            const states = await models_1.TaxRate.distinct('state', { active: true });
            for (const state of states) {
                utils_1.logger.info(`Warming up cache for state: ${state}`);
                const stateRates = await models_1.TaxRate.find({
                    state,
                    active: true
                }).lean();
                if (stateRates.length > 0) {
                    await this.cacheTaxRates({ state }, stateRates.map(rate => ({
                        id: rate._id.toString(),
                        state: rate.state,
                        jurisdiction: rate.jurisdiction,
                        jurisdictionType: rate.jurisdictionType,
                        rate: rate.rate,
                        effectiveDate: rate.effectiveDate,
                        lastUpdated: rate.lastUpdated || new Date(),
                        productCategories: rate.productCategories?.map(cat => cat.category) || [],
                        isActive: rate.active
                    })), this.FREQUENTLY_ACCESSED_TTL);
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            utils_1.logger.info(`Cache warmup completed for ${states.length} states`);
        }
        catch (error) {
            utils_1.logger.error('Error during cache warmup:', error);
            throw error;
        }
    }
    async updateCacheStats() {
        try {
            const client = await this.redisConnection.getClient();
            const statsKey = this.generateStatsKey();
            await client.hmset(statsKey, {
                hits: this.cacheMetrics.hits,
                misses: this.cacheMetrics.misses,
                writes: this.cacheMetrics.writes,
                deletes: this.cacheMetrics.deletes,
                errors: this.cacheMetrics.errors,
                lastUpdate: new Date().toISOString()
            });
            await client.expire(statsKey, 7 * 24 * 60 * 60);
        }
        catch (error) {
            utils_1.logger.warn('Error updating cache stats:', error);
        }
    }
    async getCacheStats() {
        try {
            const client = await this.redisConnection.getClient();
            const statsKey = this.generateStatsKey();
            const stats = await client.hgetall(statsKey);
            if (Object.keys(stats).length > 0) {
                const metrics = {
                    hits: parseInt(stats.hits) || 0,
                    misses: parseInt(stats.misses) || 0,
                    writes: parseInt(stats.writes) || 0,
                    deletes: parseInt(stats.deletes) || 0,
                    errors: parseInt(stats.errors) || 0,
                    lastResetTime: new Date(stats.lastUpdate || new Date())
                };
                const hitRate = metrics.hits + metrics.misses > 0
                    ? (metrics.hits / (metrics.hits + metrics.misses)) * 100
                    : 0;
                return { ...metrics, hitRate };
            }
            const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
            const hitRate = total > 0 ? (this.cacheMetrics.hits / total) * 100 : 0;
            return { ...this.cacheMetrics, hitRate };
        }
        catch (error) {
            utils_1.logger.error('Error retrieving cache stats:', error);
            const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
            const hitRate = total > 0 ? (this.cacheMetrics.hits / total) * 100 : 0;
            return { ...this.cacheMetrics, hitRate };
        }
    }
    async preloadFrequentlyAccessedRates() {
        utils_1.logger.info('Preloading frequently accessed tax rates');
        try {
            const commonQueries = [
                { state: 'CA', jurisdiction: 'Los Angeles', jurisdictionType: 'city' },
                { state: 'TX', jurisdiction: 'Houston', jurisdictionType: 'city' },
                { state: 'NY', jurisdiction: 'New York', jurisdictionType: 'city' },
                { state: 'FL', jurisdiction: 'Miami-Dade', jurisdictionType: 'county' },
                { state: 'CO', jurisdiction: 'Denver', jurisdictionType: 'city' }
            ];
            for (const query of commonQueries) {
                const rates = await models_1.TaxRate.find({
                    state: query.state,
                    jurisdiction: query.jurisdiction,
                    jurisdictionType: query.jurisdictionType,
                    active: true
                }).lean();
                if (rates.length > 0) {
                    await this.cacheTaxRates(query, rates.map(rate => ({
                        id: rate._id.toString(),
                        state: rate.state,
                        jurisdiction: rate.jurisdiction,
                        jurisdictionType: rate.jurisdictionType,
                        rate: rate.rate,
                        effectiveDate: rate.effectiveDate,
                        lastUpdated: rate.lastUpdated || new Date(),
                        productCategories: rate.productCategories?.map(cat => cat.category) || [],
                        isActive: rate.active
                    })), this.FREQUENTLY_ACCESSED_TTL);
                }
            }
            utils_1.logger.info('Frequently accessed rates preloaded successfully');
        }
        catch (error) {
            utils_1.logger.error('Error preloading frequently accessed rates:', error);
        }
    }
    async bulkInvalidateByStates(states) {
        let totalDeleted = 0;
        for (const state of states) {
            const deleted = await this.invalidateForJurisdiction(state);
            totalDeleted += deleted;
        }
        utils_1.logger.info(`Bulk invalidated cache for ${states.length} states: ${totalDeleted} entries deleted`);
        return totalDeleted;
    }
    async getCacheSize() {
        try {
            const client = await this.redisConnection.getClient();
            const taxRateKeys = await client.keys(`tax-rate:${this.CACHE_VERSION}:*`);
            const info = await client.info('memory');
            const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
            const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';
            const dbsize = await client.dbsize();
            return {
                totalKeys: dbsize,
                memoryUsage,
                taxRateKeys: taxRateKeys.length
            };
        }
        catch (error) {
            utils_1.logger.error('Error getting cache size info:', error);
            throw error;
        }
    }
    async setTaxRateExpirationAlert(cacheKey, alertThresholdHours = 2) {
        try {
            const client = await this.redisConnection.getClient();
            const ttl = await client.ttl(cacheKey);
            if (ttl > 0 && ttl <= alertThresholdHours * 3600) {
                const alertKey = `${cacheKey}:expiration_alert`;
                await client.setex(alertKey, ttl, JSON.stringify({
                    originalKey: cacheKey,
                    expirationTime: new Date(Date.now() + ttl * 1000),
                    alertTime: new Date()
                }));
                utils_1.logger.info(`Set expiration alert for ${cacheKey} (expires in ${ttl} seconds)`);
            }
        }
        catch (error) {
            utils_1.logger.warn('Error setting expiration alert:', error);
        }
    }
    async getExpiringSoon(hoursAhead = 2) {
        try {
            const client = await this.redisConnection.getClient();
            const alertKeys = await client.keys(`tax-rate:${this.CACHE_VERSION}:*:expiration_alert`);
            const expiringSoon = [];
            for (const alertKey of alertKeys) {
                const alertData = await client.get(alertKey);
                if (alertData) {
                    const alert = JSON.parse(alertData);
                    expiringSoon.push(alert.originalKey);
                }
            }
            return expiringSoon;
        }
        catch (error) {
            utils_1.logger.error('Error getting expiring cache entries:', error);
            return [];
        }
    }
    async refreshExpiringSoon() {
        const expiring = await this.getExpiringSoon();
        let refreshed = 0;
        for (const cacheKey of expiring) {
            try {
                const keyParts = cacheKey.split(':');
                if (keyParts.length >= 4) {
                    const state = keyParts[2];
                    const jurisdiction = keyParts[3] !== 'all' ? keyParts[3] : undefined;
                    const jurisdictionType = keyParts[4] !== 'all' ? keyParts[4] : undefined;
                    const rates = await models_1.TaxRate.find({
                        state,
                        ...(jurisdiction && { jurisdiction }),
                        ...(jurisdictionType && { jurisdictionType }),
                        active: true
                    }).lean();
                    if (rates.length > 0) {
                        await this.cacheTaxRates({ state, jurisdiction, jurisdictionType }, rates.map(rate => ({
                            id: rate._id.toString(),
                            state: rate.state,
                            jurisdiction: rate.jurisdiction,
                            jurisdictionType: rate.jurisdictionType,
                            rate: rate.rate,
                            effectiveDate: rate.effectiveDate,
                            lastUpdated: rate.lastUpdated || new Date(),
                            productCategories: rate.productCategories?.map(cat => cat.category) || [],
                            isActive: rate.active
                        })));
                        refreshed++;
                    }
                }
            }
            catch (error) {
                utils_1.logger.error(`Error refreshing cache for ${cacheKey}:`, error);
            }
        }
        utils_1.logger.info(`Refreshed ${refreshed} expiring cache entries`);
        return refreshed;
    }
    resetMetrics() {
        this.cacheMetrics = {
            hits: 0,
            misses: 0,
            writes: 0,
            deletes: 0,
            errors: 0,
            lastResetTime: new Date()
        };
        utils_1.logger.info('Cache metrics reset');
    }
    getMetrics() {
        const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
        const hitRate = total > 0 ? (this.cacheMetrics.hits / total) * 100 : 0;
        return { ...this.cacheMetrics, hitRate };
    }
}
exports.TaxRateCacheService = TaxRateCacheService;
exports.taxRateCache = new TaxRateCacheService();
//# sourceMappingURL=TaxRateCacheService.js.map