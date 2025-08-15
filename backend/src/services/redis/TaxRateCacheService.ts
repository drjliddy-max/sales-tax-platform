import { RedisConnectionService } from './RedisConnectionService';
import { logger } from '@/utils';
import { TaxRate } from '@/models';

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

export class TaxRateCacheService {
  private redisConnection: RedisConnectionService;
  private cacheMetrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    writes: 0,
    deletes: 0,
    errors: 0,
    lastResetTime: new Date()
  };
  
  // Cache configuration
  private readonly DEFAULT_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly FREQUENTLY_ACCESSED_TTL = 48 * 60 * 60; // 48 hours for frequently accessed
  private readonly BULK_OPERATION_TTL = 12 * 60 * 60; // 12 hours for bulk operations
  private readonly CACHE_VERSION = '1.0';

  constructor() {
    this.redisConnection = RedisConnectionService.getInstance();
  }

  private generateCacheKey(query: TaxRateQuery): string {
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

  private generateJurisdictionSetKey(state: string): string {
    return `tax-rate:${this.CACHE_VERSION}:jurisdictions:${state.toLowerCase()}`;
  }

  private generateStatsKey(): string {
    return `tax-rate:${this.CACHE_VERSION}:stats`;
  }

  public async getCachedTaxRates(query: TaxRateQuery): Promise<CachedTaxRate[] | null> {
    try {
      const client = await this.redisConnection.getClient();
      const cacheKey = this.generateCacheKey(query);
      
      const cachedData = await client.get(cacheKey);
      
      if (cachedData) {
        this.cacheMetrics.hits++;
        const parsedData = JSON.parse(cachedData);
        
        // Validate cache data structure
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          logger.debug(`Cache HIT for ${cacheKey}`);
          
          // Update access frequency for intelligent TTL
          await this.updateAccessFrequency(cacheKey);
          
          return parsedData.map(item => ({
            ...item,
            effectiveDate: new Date(item.effectiveDate),
            lastUpdated: new Date(item.lastUpdated)
          }));
        }
      }
      
      this.cacheMetrics.misses++;
      logger.debug(`Cache MISS for ${cacheKey}`);
      return null;
      
    } catch (error) {
      this.cacheMetrics.errors++;
      logger.error('Error retrieving from tax rate cache:', error);
      return null; // Graceful degradation
    }
  }

  public async cacheTaxRates(query: TaxRateQuery, taxRates: CachedTaxRate[], customTtl?: number): Promise<void> {
    try {
      const client = await this.redisConnection.getClient();
      const cacheKey = this.generateCacheKey(query);
      
      // Serialize the data
      const serializedData = JSON.stringify(taxRates.map(rate => ({
        ...rate,
        effectiveDate: rate.effectiveDate.toISOString(),
        lastUpdated: rate.lastUpdated.toISOString()
      })));
      
      // Determine TTL based on frequency and data type
      const ttl = customTtl || await this.calculateIntelligentTtl(cacheKey, taxRates.length);
      
      await client.setex(cacheKey, ttl, serializedData);
      
      this.cacheMetrics.writes++;
      logger.debug(`Cached ${taxRates.length} tax rates for ${cacheKey} (TTL: ${ttl}s)`);
      
      // Cache jurisdiction list for faster lookups
      await this.cacheJurisdictionList(query.state, taxRates);
      
      // Update cache statistics
      await this.updateCacheStats();
      
    } catch (error) {
      this.cacheMetrics.errors++;
      logger.error('Error caching tax rates:', error);
      throw error;
    }
  }

  private async calculateIntelligentTtl(cacheKey: string, dataSize: number): Promise<number> {
    try {
      const client = await this.redisConnection.getClient();
      const accessCount = await client.get(`${cacheKey}:access_count`) || '0';
      const count = parseInt(accessCount);
      
      // More frequently accessed data gets longer TTL
      if (count > 10) {
        return this.FREQUENTLY_ACCESSED_TTL;
      } else if (dataSize > 50) {
        return this.BULK_OPERATION_TTL;
      } else {
        return this.DEFAULT_TTL;
      }
    } catch (error) {
      logger.warn('Error calculating intelligent TTL, using default:', error);
      return this.DEFAULT_TTL;
    }
  }

  private async updateAccessFrequency(cacheKey: string): Promise<void> {
    try {
      const client = await this.redisConnection.getClient();
      const accessKey = `${cacheKey}:access_count`;
      await client.incr(accessKey);
      await client.expire(accessKey, this.FREQUENTLY_ACCESSED_TTL);
    } catch (error) {
      logger.warn('Error updating access frequency:', error);
    }
  }

  private async cacheJurisdictionList(state: string, taxRates: CachedTaxRate[]): Promise<void> {
    try {
      const client = await this.redisConnection.getClient();
      const jurisdictionKey = this.generateJurisdictionSetKey(state);
      
      const jurisdictions = taxRates.map(rate => 
        `${rate.jurisdiction}:${rate.jurisdictionType}`
      );
      
      if (jurisdictions.length > 0) {
        await client.sadd(jurisdictionKey, ...jurisdictions);
        await client.expire(jurisdictionKey, this.DEFAULT_TTL);
      }
    } catch (error) {
      logger.warn('Error caching jurisdiction list:', error);
    }
  }

  public async getAvailableJurisdictions(state: string): Promise<string[]> {
    try {
      const client = await this.redisConnection.getClient();
      const jurisdictionKey = this.generateJurisdictionSetKey(state);
      
      const jurisdictions = await client.smembers(jurisdictionKey);
      
      if (jurisdictions.length > 0) {
        this.cacheMetrics.hits++;
        return jurisdictions;
      } else {
        this.cacheMetrics.misses++;
        return [];
      }
    } catch (error) {
      this.cacheMetrics.errors++;
      logger.error('Error retrieving cached jurisdictions:', error);
      return [];
    }
  }

  public async invalidateCache(pattern?: string): Promise<number> {
    try {
      const client = await this.redisConnection.getClient();
      
      const searchPattern = pattern || `tax-rate:${this.CACHE_VERSION}:*`;
      const keys = await client.keys(searchPattern);
      
      if (keys.length > 0) {
        const deleted = await client.del(...keys);
        this.cacheMetrics.deletes += deleted;
        
        logger.info(`Invalidated ${deleted} cache entries matching pattern: ${searchPattern}`);
        return deleted;
      }
      
      return 0;
    } catch (error) {
      this.cacheMetrics.errors++;
      logger.error('Error invalidating cache:', error);
      throw error;
    }
  }

  public async invalidateForJurisdiction(state: string, jurisdiction?: string): Promise<number> {
    const pattern = jurisdiction 
      ? `tax-rate:${this.CACHE_VERSION}:${state.toLowerCase()}:${jurisdiction.toLowerCase()}:*`
      : `tax-rate:${this.CACHE_VERSION}:${state.toLowerCase()}:*`;
    
    return await this.invalidateCache(pattern);
  }

  public async warmupCache(): Promise<void> {
    logger.info('Starting tax rate cache warmup');
    
    try {
      // Get all unique states from the database
      const states = await TaxRate.distinct('state', { active: true });
      
      for (const state of states) {
        logger.info(`Warming up cache for state: ${state}`);
        
        // Cache all rates for this state
        const stateRates = await TaxRate.find({ 
          state, 
          active: true 
        }).lean();
        
        if (stateRates.length > 0) {
          await this.cacheTaxRates(
            { state },
            stateRates.map(rate => ({
              id: rate._id.toString(),
              state: rate.state,
              jurisdiction: rate.jurisdiction,
              jurisdictionType: rate.jurisdictionType,
              rate: rate.rate,
              effectiveDate: rate.effectiveDate,
              lastUpdated: rate.lastUpdated || new Date(),
              productCategories: rate.productCategories?.map(cat => cat.category) || [],
              isActive: rate.active
            })),
            this.FREQUENTLY_ACCESSED_TTL // Longer TTL for warmup data
          );
        }
        
        // Small delay to prevent overwhelming Redis
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      logger.info(`Cache warmup completed for ${states.length} states`);
      
    } catch (error) {
      logger.error('Error during cache warmup:', error);
      throw error;
    }
  }

  private async updateCacheStats(): Promise<void> {
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
      
      await client.expire(statsKey, 7 * 24 * 60 * 60); // Keep stats for 7 days
    } catch (error) {
      logger.warn('Error updating cache stats:', error);
    }
  }

  public async getCacheStats(): Promise<CacheMetrics & { hitRate: number }> {
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
      
      // Return current in-memory stats if Redis stats not available
      const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
      const hitRate = total > 0 ? (this.cacheMetrics.hits / total) * 100 : 0;
      
      return { ...this.cacheMetrics, hitRate };
      
    } catch (error) {
      logger.error('Error retrieving cache stats:', error);
      const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
      const hitRate = total > 0 ? (this.cacheMetrics.hits / total) * 100 : 0;
      return { ...this.cacheMetrics, hitRate };
    }
  }

  public async preloadFrequentlyAccessedRates(): Promise<void> {
    logger.info('Preloading frequently accessed tax rates');
    
    try {
      // Get most common state/jurisdiction combinations
      const commonQueries = [
        { state: 'CA', jurisdiction: 'Los Angeles', jurisdictionType: 'city' },
        { state: 'TX', jurisdiction: 'Houston', jurisdictionType: 'city' },
        { state: 'NY', jurisdiction: 'New York', jurisdictionType: 'city' },
        { state: 'FL', jurisdiction: 'Miami-Dade', jurisdictionType: 'county' },
        { state: 'CO', jurisdiction: 'Denver', jurisdictionType: 'city' }
      ];
      
      for (const query of commonQueries) {
        const rates = await TaxRate.find({
          state: query.state,
          jurisdiction: query.jurisdiction,
          jurisdictionType: query.jurisdictionType,
          active: true
        }).lean();
        
        if (rates.length > 0) {
          await this.cacheTaxRates(
            query,
            rates.map(rate => ({
              id: rate._id.toString(),
              state: rate.state,
              jurisdiction: rate.jurisdiction,
              jurisdictionType: rate.jurisdictionType,
              rate: rate.rate,
              effectiveDate: rate.effectiveDate,
              lastUpdated: rate.lastUpdated || new Date(),
              productCategories: rate.productCategories?.map(cat => cat.category) || [],
              isActive: rate.active
            })),
            this.FREQUENTLY_ACCESSED_TTL
          );
        }
      }
      
      logger.info('Frequently accessed rates preloaded successfully');
      
    } catch (error) {
      logger.error('Error preloading frequently accessed rates:', error);
    }
  }

  public async bulkInvalidateByStates(states: string[]): Promise<number> {
    let totalDeleted = 0;
    
    for (const state of states) {
      const deleted = await this.invalidateForJurisdiction(state);
      totalDeleted += deleted;
    }
    
    logger.info(`Bulk invalidated cache for ${states.length} states: ${totalDeleted} entries deleted`);
    return totalDeleted;
  }

  public async getCacheSize(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    taxRateKeys: number;
  }> {
    try {
      const client = await this.redisConnection.getClient();
      
      // Get total keys matching our pattern
      const taxRateKeys = await client.keys(`tax-rate:${this.CACHE_VERSION}:*`);
      
      // Get Redis memory info
      const info = await client.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';
      
      // Get total keys in database
      const dbsize = await client.dbsize();
      
      return {
        totalKeys: dbsize,
        memoryUsage,
        taxRateKeys: taxRateKeys.length
      };
      
    } catch (error) {
      logger.error('Error getting cache size info:', error);
      throw error;
    }
  }

  public async setTaxRateExpirationAlert(cacheKey: string, alertThresholdHours: number = 2): Promise<void> {
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
        
        logger.info(`Set expiration alert for ${cacheKey} (expires in ${ttl} seconds)`);
      }
    } catch (error) {
      logger.warn('Error setting expiration alert:', error);
    }
  }

  public async getExpiringSoon(hoursAhead: number = 2): Promise<string[]> {
    try {
      const client = await this.redisConnection.getClient();
      const alertKeys = await client.keys(`tax-rate:${this.CACHE_VERSION}:*:expiration_alert`);
      
      const expiringSoon: string[] = [];
      
      for (const alertKey of alertKeys) {
        const alertData = await client.get(alertKey);
        if (alertData) {
          const alert = JSON.parse(alertData);
          expiringSoon.push(alert.originalKey);
        }
      }
      
      return expiringSoon;
      
    } catch (error) {
      logger.error('Error getting expiring cache entries:', error);
      return [];
    }
  }

  public async refreshExpiringSoon(): Promise<number> {
    const expiring = await this.getExpiringSoon();
    let refreshed = 0;
    
    for (const cacheKey of expiring) {
      try {
        // Extract query info from cache key to refresh from database
        const keyParts = cacheKey.split(':');
        if (keyParts.length >= 4) {
          const state = keyParts[2];
          const jurisdiction = keyParts[3] !== 'all' ? keyParts[3] : undefined;
          const jurisdictionType = keyParts[4] !== 'all' ? keyParts[4] : undefined;
          
          const rates = await TaxRate.find({
            state,
            ...(jurisdiction && { jurisdiction }),
            ...(jurisdictionType && { jurisdictionType }),
            active: true
          }).lean();
          
          if (rates.length > 0) {
            await this.cacheTaxRates(
              { state, jurisdiction, jurisdictionType },
              rates.map(rate => ({
                id: rate._id.toString(),
                state: rate.state,
                jurisdiction: rate.jurisdiction,
                jurisdictionType: rate.jurisdictionType,
                rate: rate.rate,
                effectiveDate: rate.effectiveDate,
                lastUpdated: rate.lastUpdated || new Date(),
                productCategories: rate.productCategories?.map(cat => cat.category) || [],
                isActive: rate.active
              }))
            );
            refreshed++;
          }
        }
      } catch (error) {
        logger.error(`Error refreshing cache for ${cacheKey}:`, error);
      }
    }
    
    logger.info(`Refreshed ${refreshed} expiring cache entries`);
    return refreshed;
  }

  public resetMetrics(): void {
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      writes: 0,
      deletes: 0,
      errors: 0,
      lastResetTime: new Date()
    };
    logger.info('Cache metrics reset');
  }

  public getMetrics(): CacheMetrics & { hitRate: number } {
    const total = this.cacheMetrics.hits + this.cacheMetrics.misses;
    const hitRate = total > 0 ? (this.cacheMetrics.hits / total) * 100 : 0;
    
    return { ...this.cacheMetrics, hitRate };
  }
}

// Export singleton instance
export const taxRateCache = new TaxRateCacheService();