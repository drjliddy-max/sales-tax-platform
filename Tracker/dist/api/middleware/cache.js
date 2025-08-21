"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicDataCache = exports.reportCache = exports.transactionCache = exports.taxRateCache = exports.cacheMiddleware = exports.CacheMiddleware = void 0;
const RedisConnectionService_1 = require("@/services/redis/RedisConnectionService");
const utils_1 = require("@/utils");
const crypto_1 = __importDefault(require("crypto"));
class CacheMiddleware {
    constructor() {
        this.CACHE_PREFIX = 'api-cache:';
        this.DEFAULT_TTL = 5 * 60;
        this.redisConnection = RedisConnectionService_1.RedisConnectionService.getInstance();
    }
    createCacheMiddleware(options = {}) {
        return async (req, res, next) => {
            try {
                if (this.shouldSkipCache(req, options)) {
                    return next();
                }
                const cacheKey = this.generateCacheKey(req, options);
                const cachedResponse = await this.getCachedResponse(cacheKey);
                if (cachedResponse) {
                    utils_1.logger.debug(`Cache HIT for ${req.method} ${req.path}`);
                    Object.entries(cachedResponse.headers).forEach(([key, value]) => {
                        res.set(key, value);
                    });
                    res.set('X-Cache', 'HIT');
                    res.set('X-Cache-Key', cacheKey.substring(0, 20) + '...');
                    res.set('X-Cache-Age', Math.floor((Date.now() - cachedResponse.timestamp.getTime()) / 1000).toString());
                    return res.status(cachedResponse.statusCode).json(cachedResponse.body);
                }
                utils_1.logger.debug(`Cache MISS for ${req.method} ${req.path}`);
                const originalSend = res.json;
                const originalStatus = res.status;
                let statusCode = 200;
                res.status = function (code) {
                    statusCode = code;
                    return originalStatus.call(this, code);
                };
                const self = this;
                res.json = function (body) {
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
                            }
                            catch (error) {
                                utils_1.logger.error('Error caching response:', error);
                            }
                        });
                    }
                    res.set('X-Cache', 'MISS');
                    res.set('X-Cache-Key', cacheKey.substring(0, 20) + '...');
                    return originalSend.call(this, body);
                };
                next();
            }
            catch (error) {
                utils_1.logger.error('Cache middleware error:', error);
                next();
            }
        };
    }
    shouldSkipCache(req, options) {
        if (req.method !== 'GET') {
            return true;
        }
        if (options.skipCache && options.skipCache(req)) {
            return true;
        }
        if (req.headers['cache-control']?.includes('no-cache')) {
            return true;
        }
        if (req.headers.authorization && req.path.includes('personal')) {
            return true;
        }
        return false;
    }
    generateCacheKey(req, options) {
        if (options.keyGenerator) {
            return `${this.CACHE_PREFIX}${options.keyGenerator(req)}`;
        }
        const keyParts = [
            req.method,
            req.path,
            this.hashQueryParams(req.query)
        ];
        if (options.businessSpecific && req.session?.businessId) {
            keyParts.push(`business:${req.session.businessId}`);
        }
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
    hashQueryParams(query) {
        if (!query || Object.keys(query).length === 0) {
            return 'no-query';
        }
        const sortedQuery = Object.keys(query)
            .sort()
            .reduce((result, key) => {
            result[key] = query[key];
            return result;
        }, {});
        return this.hashString(JSON.stringify(sortedQuery));
    }
    hashString(input) {
        return crypto_1.default.createHash('md5').update(input).digest('hex').substring(0, 16);
    }
    async getCachedResponse(cacheKey) {
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
        }
        catch (error) {
            utils_1.logger.error('Error retrieving cached response:', error);
            return null;
        }
    }
    async cacheResponse(cacheKey, response, ttl) {
        try {
            const client = await this.redisConnection.getClient();
            const serializedResponse = JSON.stringify({
                ...response,
                timestamp: response.timestamp.toISOString()
            });
            await client.setex(cacheKey, ttl, serializedResponse);
            utils_1.logger.debug(`Cached response for key: ${cacheKey.substring(0, 20)}... (TTL: ${ttl}s)`);
        }
        catch (error) {
            utils_1.logger.error('Error caching response:', error);
        }
    }
    extractCacheableHeaders(res) {
        const cacheableHeaders = {};
        const headers = res.getHeaders();
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
    async invalidateCache(pattern) {
        try {
            const client = await this.redisConnection.getClient();
            const fullPattern = `${this.CACHE_PREFIX}${pattern}`;
            const keys = await client.keys(fullPattern);
            if (keys.length > 0) {
                const deleted = await client.del(...keys);
                utils_1.logger.info(`Invalidated ${deleted} cache entries matching pattern: ${pattern}`);
                return deleted;
            }
            return 0;
        }
        catch (error) {
            utils_1.logger.error('Error invalidating cache:', error);
            throw error;
        }
    }
    async warmupCache(routes) {
        utils_1.logger.info('Starting API cache warmup');
        for (const route of routes) {
            try {
                utils_1.logger.debug(`Would warm up cache for ${route.method || 'GET'} ${route.path}`);
            }
            catch (error) {
                utils_1.logger.error(`Error warming up cache for ${route.path}:`, error);
            }
        }
    }
}
exports.CacheMiddleware = CacheMiddleware;
exports.cacheMiddleware = new CacheMiddleware();
const taxRateCache = (ttl = 30 * 60) => exports.cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: true,
    varyBy: ['accept-encoding']
});
exports.taxRateCache = taxRateCache;
const transactionCache = (ttl = 10 * 60) => exports.cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: true,
    skipCache: (req) => req.query.nocache === 'true'
});
exports.transactionCache = transactionCache;
const reportCache = (ttl = 60 * 60) => exports.cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: true,
    keyGenerator: (req) => {
        const businessId = req.session?.businessId || 'default';
        const queryHash = Object.keys(req.query).length > 0
            ? crypto_1.default.createHash('md5').update(JSON.stringify(req.query)).digest('hex').substring(0, 16)
            : 'no-query';
        return `report:${businessId}:${req.path}:${queryHash}`;
    }
});
exports.reportCache = reportCache;
const publicDataCache = (ttl = 60 * 60) => exports.cacheMiddleware.createCacheMiddleware({
    ttl,
    businessSpecific: false
});
exports.publicDataCache = publicDataCache;
//# sourceMappingURL=cache.js.map