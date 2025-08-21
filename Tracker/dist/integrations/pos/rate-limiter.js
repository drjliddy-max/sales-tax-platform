"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitManager = void 0;
const redis_1 = require("@/lib/redis");
const types_1 = require("./types");
class RateLimitManager {
    constructor() {
        this.requestQueues = new Map();
        this.processingQueues = new Set();
        this.metrics = new Map();
        Object.keys(this.RATE_LIMITS).forEach(posType => {
            this.requestQueues.set(posType, []);
        });
        this.startQueueProcessors();
    }
    static getInstance() {
        if (!RateLimitManager.instance) {
            RateLimitManager.instance = new RateLimitManager();
        }
        return RateLimitManager.instance;
    }
    async executeRequest(posType, requestFn, priority = 0, retryConfig) {
        const config = { ...this.DEFAULT_RETRY_CONFIG, ...retryConfig };
        return new Promise((resolve, reject) => {
            const request = {
                id: this.generateRequestId(),
                posType,
                priority,
                createdAt: Date.now(),
                retryCount: 0,
                execute: requestFn,
                resolve,
                reject
            };
            this.enqueueRequest(request);
        });
    }
    async canMakeRequest(posType, businessId) {
        const limits = this.RATE_LIMITS[posType];
        const key = this.getMetricsKey(posType, businessId);
        const now = Date.now();
        const metrics = await this.getMetrics(key);
        const checks = [
            { window: 1000, limit: limits.requestsPerSecond },
            { window: 60000, limit: limits.requestsPerMinute },
            { window: 3600000, limit: limits.requestsPerHour }
        ];
        for (const check of checks) {
            if (!check.limit)
                continue;
            if (metrics.count >= check.limit && now < metrics.resetTime) {
                const retryAfter = metrics.resetTime - now;
                return { allowed: false, retryAfter };
            }
        }
        if (metrics.consecutiveErrors > 0 && metrics.lastErrorTime) {
            const backoffTime = this.calculateBackoffTime(metrics.consecutiveErrors);
            const timeSinceError = now - metrics.lastErrorTime;
            if (timeSinceError < backoffTime) {
                return { allowed: false, retryAfter: backoffTime - timeSinceError };
            }
        }
        return { allowed: true };
    }
    async recordSuccess(posType, businessId) {
        const key = this.getMetricsKey(posType, businessId);
        const metrics = await this.getMetrics(key);
        metrics.consecutiveErrors = 0;
        metrics.lastErrorTime = undefined;
        await this.updateMetrics(key, metrics);
    }
    async recordFailure(posType, error, businessId) {
        const key = this.getMetricsKey(posType, businessId);
        const metrics = await this.getMetrics(key);
        metrics.consecutiveErrors++;
        metrics.lastErrorTime = Date.now();
        if (error.code === 'RATE_LIMITED' || error.statusCode === 429) {
            const retryAfter = this.extractRetryAfter(error);
            if (retryAfter) {
                metrics.retryAfter = Date.now() + (retryAfter * 1000);
            }
        }
        await this.updateMetrics(key, metrics);
    }
    async getRateLimitStatus(posType, businessId) {
        const limits = this.RATE_LIMITS[posType];
        const key = this.getMetricsKey(posType, businessId);
        const metrics = await this.getMetrics(key);
        const secondlyRemaining = limits.requestsPerSecond - (metrics.count || 0);
        const minutelyRemaining = limits.requestsPerMinute ? limits.requestsPerMinute - (metrics.count || 0) : Infinity;
        const hourlyRemaining = limits.requestsPerHour ? limits.requestsPerHour - (metrics.count || 0) : Infinity;
        const remaining = Math.min(secondlyRemaining, minutelyRemaining, hourlyRemaining);
        return {
            remaining: Math.max(0, remaining),
            resetTime: metrics.resetTime,
            retryAfter: metrics.retryAfter && metrics.retryAfter > Date.now() ? metrics.retryAfter - Date.now() : undefined,
            consecutiveErrors: metrics.consecutiveErrors
        };
    }
    startQueueProcessors() {
        Object.keys(this.RATE_LIMITS).forEach(posType => {
            this.processQueue(posType);
        });
    }
    async processQueue(posType) {
        if (this.processingQueues.has(posType)) {
            return;
        }
        this.processingQueues.add(posType);
        try {
            while (true) {
                const queue = this.requestQueues.get(posType) || [];
                if (queue.length === 0) {
                    await this.sleep(100);
                    continue;
                }
                queue.sort((a, b) => {
                    if (a.priority !== b.priority) {
                        return b.priority - a.priority;
                    }
                    return a.createdAt - b.createdAt;
                });
                const request = queue[0];
                const { allowed, retryAfter } = await this.canMakeRequest(posType);
                if (!allowed) {
                    if (retryAfter) {
                        await this.sleep(Math.min(retryAfter, 5000));
                    }
                    else {
                        await this.sleep(1000);
                    }
                    continue;
                }
                queue.shift();
                try {
                    await this.incrementRequestCount(posType);
                    const result = await request.execute();
                    await this.recordSuccess(posType);
                    request.resolve(result);
                }
                catch (error) {
                    const posError = this.wrapError(error, posType);
                    await this.recordFailure(posType, posError);
                    if (this.shouldRetry(posError, request, this.DEFAULT_RETRY_CONFIG)) {
                        request.retryCount++;
                        const delay = this.calculateRetryDelay(request.retryCount, this.DEFAULT_RETRY_CONFIG);
                        setTimeout(() => {
                            queue.push(request);
                        }, delay);
                    }
                    else {
                        request.reject(posError);
                    }
                }
                const limits = this.RATE_LIMITS[posType];
                const delayBetweenRequests = 1000 / limits.requestsPerSecond;
                await this.sleep(delayBetweenRequests);
            }
        }
        finally {
            this.processingQueues.delete(posType);
            setTimeout(() => this.processQueue(posType), 1000);
        }
    }
    enqueueRequest(request) {
        const queue = this.requestQueues.get(request.posType);
        if (queue) {
            queue.push(request);
        }
    }
    async incrementRequestCount(posType, businessId) {
        const key = this.getMetricsKey(posType, businessId);
        const now = Date.now();
        const limits = this.RATE_LIMITS[posType];
        const pipeline = redis_1.redis.pipeline();
        const windows = [
            { key: `${key}:1s`, ttl: 1 },
            { key: `${key}:1m`, ttl: 60 },
            { key: `${key}:1h`, ttl: 3600 }
        ];
        for (const window of windows) {
            pipeline.incr(window.key);
            pipeline.expire(window.key, window.ttl);
        }
        await pipeline.exec();
    }
    async getMetrics(key) {
        try {
            const data = await redis_1.redis.get(`${key}:metrics`);
            if (data) {
                return JSON.parse(data);
            }
        }
        catch (error) {
            console.error('Failed to get metrics:', error);
        }
        return {
            count: 0,
            resetTime: Date.now() + 1000,
            consecutiveErrors: 0
        };
    }
    async updateMetrics(key, metrics) {
        try {
            await redis_1.redis.setex(`${key}:metrics`, 3600, JSON.stringify(metrics));
        }
        catch (error) {
            console.error('Failed to update metrics:', error);
        }
    }
    getMetricsKey(posType, businessId) {
        return businessId ? `rate_limit:${posType}:${businessId}` : `rate_limit:${posType}:global`;
    }
    calculateBackoffTime(consecutiveErrors) {
        const baseDelay = 1000;
        const maxDelay = 300000;
        const delay = Math.min(baseDelay * Math.pow(2, consecutiveErrors - 1), maxDelay);
        return delay;
    }
    calculateRetryDelay(retryCount, config) {
        if (config.backoff === 'linear') {
            return Math.min(config.baseDelayMs * retryCount, config.maxDelayMs);
        }
        else {
            const exponentialDelay = config.baseDelayMs * Math.pow(2, retryCount - 1);
            return Math.min(exponentialDelay, config.maxDelayMs);
        }
    }
    shouldRetry(error, request, config) {
        if (request.retryCount >= config.maxAttempts) {
            return false;
        }
        if (!error.retryable) {
            return false;
        }
        return config.retryableErrors?.includes(error.code) || false;
    }
    wrapError(error, posType) {
        if (error instanceof types_1.POSIntegrationError) {
            return error;
        }
        let code = 'UNKNOWN_ERROR';
        let retryable = false;
        let statusCode;
        if (error.response) {
            statusCode = error.response.status;
            if (statusCode === 429) {
                code = 'RATE_LIMITED';
                retryable = true;
            }
            else if (statusCode >= 500) {
                code = 'SERVER_ERROR';
                retryable = true;
            }
            else if (statusCode === 401 || statusCode === 403) {
                code = 'AUTH_ERROR';
                retryable = false;
            }
        }
        else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            code = 'CONNECTION_ERROR';
            retryable = true;
        }
        return new types_1.POSIntegrationError(error.message || 'Unknown error occurred', code, posType, statusCode, retryable, { originalError: error });
    }
    extractRetryAfter(error) {
        if (error.details?.originalError?.response?.headers) {
            const retryAfter = error.details.originalError.response.headers['retry-after'];
            if (retryAfter) {
                const seconds = parseInt(retryAfter, 10);
                return isNaN(seconds) ? undefined : seconds;
            }
        }
        return undefined;
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    getQueueStatus() {
        const status = {};
        for (const [posType, queue] of this.requestQueues.entries()) {
            status[posType] = {
                queueLength: queue.length,
                processing: this.processingQueues.has(posType)
            };
        }
        return status;
    }
    clearAllQueues() {
        for (const queue of this.requestQueues.values()) {
            queue.length = 0;
        }
    }
}
exports.RateLimitManager = RateLimitManager;
RateLimitManager.DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    backoff: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['RATE_LIMITED', 'TIMEOUT', 'CONNECTION_ERROR']
};
RateLimitManager.RATE_LIMITS = {
    shopify: {
        requestsPerSecond: 2,
        requestsPerMinute: 40,
        burstLimit: 40,
        concurrentConnections: 1
    },
    square: {
        requestsPerSecond: 10,
        requestsPerMinute: 500,
        requestsPerHour: 5000,
        burstLimit: 20
    },
    clover: {
        requestsPerSecond: 5,
        requestsPerMinute: 1000,
        burstLimit: 10
    },
    toast: {
        requestsPerSecond: 1,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 5
    },
    lightspeed: {
        requestsPerSecond: 3,
        requestsPerMinute: 180,
        burstLimit: 10
    },
    paypal_here: {
        requestsPerSecond: 5,
        requestsPerMinute: 300,
        burstLimit: 15
    },
    ncr: {
        requestsPerSecond: 10,
        requestsPerMinute: 1000,
        burstLimit: 20
    }
};
//# sourceMappingURL=rate-limiter.js.map