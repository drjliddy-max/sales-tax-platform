import { Request, Response, NextFunction } from 'express';
import { RedisConnectionService } from '@/services/redis/RedisConnectionService';
import { logger } from '@/utils';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  keyGenerator?: (req: Request) => string;
  skipCache?: (req: Request) => boolean;
  varyBy?: string[]; // Headers to vary cache by
  businessSpecific?: boolean; // Include business ID in cache key
}

interface CachedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  timestamp: Date;
  ttl: number;
}

export class CacheMiddleware {
  private redisConnection: RedisConnectionService;
  private readonly CACHE_PREFIX = 'api-cache:';
  private readonly DEFAULT_TTL = 5 * 60; // 5 minutes

  constructor() {
    this.redisConnection = RedisConnectionService.getInstance();
  }

  public createCacheMiddleware(options: CacheOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Skip caching for certain conditions
        if (this.shouldSkipCache(req, options)) {
          return next();
        }

        const cacheKey = this.generateCacheKey(req, options);
        const cachedResponse = await this.getCachedResponse(cacheKey);

        if (cachedResponse) {
          logger.debug(`Cache HIT for ${req.method} ${req.path}`);
          
          // Set cached headers
          Object.entries(cachedResponse.headers).forEach(([key, value]) => {
            res.set(key, value);
          });
          
          // Add cache headers
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey.substring(0, 20) + '...');
          res.set('X-Cache-Age', Math.floor((Date.now() - cachedResponse.timestamp.getTime()) / 1000).toString());
          
          return res.status(cachedResponse.statusCode).json(cachedResponse.body);
        }

        logger.debug(`Cache MISS for ${req.method} ${req.path}`);
        
        // Intercept response to cache it
        const originalSend = res.json;
        const originalStatus = res.status;
        let statusCode = 200;
        
        res.status = function(code: number) {
          statusCode = code;
          return originalStatus.call(this, code);
        };

        const self = this;
        res.json = function(body: any) {
          // Only cache successful responses
          if (statusCode >= 200 && statusCode < 300) {
            setImmediate(async () => {
              try {
                await self.cacheResponse(cacheKey, {
                  statusCode,
                  headers: self.extractCacheableHeaders(res),
                  body,
                  timestamp: new Date(),
                  ttl: options.ttl || self.DEFAULT_TTL
                }, options.ttl || self.DEFAULT_TTL);
              } catch (error) {
                logger.error('Error caching response:', error);
              }
            });
          }
          
          // Add cache headers
          res.set('X-Cache', 'MISS');
          res.set('X-Cache-Key', cacheKey.substring(0, 20) + '...');
          
          return originalSend.call(this, body);
        };

        next();

      } catch (error) {
        logger.error('Cache middleware error:', error);
        next(); // Continue without caching
      }
    };
  }

  private shouldSkipCache(req: Request, options: CacheOptions): boolean {
    // Skip for non-GET requests
    if (req.method !== 'GET') {
      return true;
    }

    // Skip if custom skip function returns true
    if (options.skipCache && options.skipCache(req)) {
      return true;
    }

    // Skip if no-cache header is present
    if (req.headers['cache-control']?.includes('no-cache')) {
      return true;
    }

    // Skip for authenticated requests with sensitive data
    if (req.headers.authorization && req.path.includes('personal')) {
      return true;
    }

    return false;
  }

  private generateCacheKey(req: Request, options: CacheOptions): string {
    if (options.keyGenerator) {
      return `${this.CACHE_PREFIX}${options.keyGenerator(req)}`;
    }

    const keyParts = [
      req.method,
      req.path,
      this.hashQueryParams(req.query)
    ];

    // Include business ID if specified
    if (options.businessSpecific && (req as any).session?.businessId) {
      keyParts.push(`business:${(req as any).session.businessId}`);
    }

    // Include vary headers
    if (options.varyBy) {
      for (const header of options.varyBy) {
        const value = req.headers[header.toLowerCase()];
        if (value) {
          keyParts.push(`${header}:${this.hashString(String(value))}`);
        }
      }
    }

    const key = keyParts.join('|');
    return `${this.CACHE_PREFIX}${this.hashString(key)}`;
  }

  private hashQueryParams(query: any): string {
    if (!query || Object.keys(query).length === 0) {
      return 'no-query';
    }
    
    // Sort keys for consistent hashing
    const sortedQuery = Object.keys(query)
      .sort()
      .reduce((result: any, key) => {
        result[key] = query[key];
        return result;
      }, {});
    
    return this.hashString(JSON.stringify(sortedQuery));
  }

  private hashString(input: string): string {
    return crypto.createHash('md5').update(input).digest('hex').substring(0, 16);
  }

  private async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
    try {
      const client = await this.redisConnection.getClient();
      const cachedData = await client.get(cacheKey);
      
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp)
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error retrieving cached response:', error);
      return null;
    }
  }

  private async cacheResponse(cacheKey: string, response: CachedResponse, ttl: number): Promise<void> {
    try {
      const client = await this.redisConnection.getClient();
      
      const serializedResponse = JSON.stringify({
        ...response,
        timestamp: response.timestamp.toISOString()
      });
      
      await client.setex(cacheKey, ttl, serializedResponse);
      logger.debug(`Cached response for key: ${cacheKey.substring(0, 20)}... (TTL: ${ttl}s)`);
      
    } catch (error) {
      logger.error('Error caching response:', error);
    }
  }

  private extractCacheableHeaders(res: Response): Record<string, string> {
    const cacheableHeaders: Record<string, string> = {};
    const headers = res.getHeaders();
    
    // Only cache certain headers
    const allowedHeaders = [
      'content-type',
      'content-length',
      'etag',
      'last-modified'
    ];
    
    for (const [key, value] of Object.entries(headers)) {
      if (allowedHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        cacheableHeaders[key] = value;
      }
    }
    
    return cacheableHeaders;
  }

  public async invalidateCache(pattern: string): Promise<number> {
    try {
      const client = await this.redisConnection.getClient();
      const fullPattern = `${this.CACHE_PREFIX}${pattern}`;
      const keys = await client.keys(fullPattern);
      
      if (keys.length > 0) {
        const deleted = await client.del(...keys);
        logger.info(`Invalidated ${deleted} cache entries matching pattern: ${pattern}`);
        return deleted;
      }
      
      return 0;
    } catch (error) {
      logger.error('Error invalidating cache:', error);
      throw error;
    }
  }

  public async warmupCache(routes: Array<{ path: string; method?: string }>): Promise<void> {
    logger.info('Starting API cache warmup');
    
    for (const route of routes) {
      try {
        // This would typically make internal requests to warm up the cache
        // For now, just log the intent
        logger.debug(`Would warm up cache for ${route.method || 'GET'} ${route.path}`);
      } catch (error) {
        logger.error(`Error warming up cache for ${route.path}:`, error);
      }
    }
  }
}

// Export singleton instance
export const cacheMiddleware = new CacheMiddleware();

// Convenience functions for common caching scenarios
export const taxRateCache = (ttl: number = 30 * 60) => 
  cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: true,
    varyBy: ['accept-encoding']
  });

export const transactionCache = (ttl: number = 10 * 60) =>
  cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: true,
    skipCache: (req) => req.query.nocache === 'true'
  });

export const reportCache = (ttl: number = 60 * 60) =>
  cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: true,
    keyGenerator: (req) => {
      const businessId = (req as any).session?.businessId || 'default';
      const queryHash = Object.keys(req.query).length > 0 
        ? crypto.createHash('md5').update(JSON.stringify(req.query)).digest('hex').substring(0, 16)
        : 'no-query';
      return `report:${businessId}:${req.path}:${queryHash}`;
    }
  });

export const publicDataCache = (ttl: number = 60 * 60) =>
  cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: false
  });