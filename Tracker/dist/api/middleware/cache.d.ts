import { Request, Response, NextFunction } from 'express';
interface CacheOptions {
    ttl?: number;
    keyGenerator?: (req: Request) => string;
    skipCache?: (req: Request) => boolean;
    varyBy?: string[];
    businessSpecific?: boolean;
}
export declare class CacheMiddleware {
    private redisConnection;
    private readonly CACHE_PREFIX;
    private readonly DEFAULT_TTL;
    constructor();
    createCacheMiddleware(options?: CacheOptions): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
    private shouldSkipCache;
    private generateCacheKey;
    private hashQueryParams;
    private hashString;
    private getCachedResponse;
    private cacheResponse;
    private extractCacheableHeaders;
    invalidateCache(pattern: string): Promise<number>;
    warmupCache(routes: Array<{
        path: string;
        method?: string;
    }>): Promise<void>;
}
export declare const cacheMiddleware: CacheMiddleware;
export declare const taxRateCache: (ttl?: number) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const transactionCache: (ttl?: number) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const reportCache: (ttl?: number) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const publicDataCache: (ttl?: number) => (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export {};
//# sourceMappingURL=cache.d.ts.map