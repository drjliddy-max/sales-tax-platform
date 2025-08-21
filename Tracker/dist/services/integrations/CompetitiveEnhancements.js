"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedAnalyticsService = exports.SmartRetryService = exports.IntegrationHealthMonitor = exports.CircuitBreaker = exports.CircuitState = exports.PerformanceOptimizer = exports.ReliableWebhookService = exports.EnhancedErrorHandler = void 0;
const utils_1 = require("../../utils");
class EnhancedErrorHandler {
    static createActionableError(error, context, userFriendlyMessage) {
        const errorCode = this.categorizeError(error);
        return {
            code: errorCode,
            message: error.message,
            userMessage: userFriendlyMessage || this.getUserFriendlyMessage(errorCode),
            suggestedActions: this.getSuggestedActions(errorCode),
            retryable: this.isRetryable(errorCode),
            context
        };
    }
    static categorizeError(error) {
        if (error.message.includes('network'))
            return 'NETWORK_ERROR';
        if (error.message.includes('timeout'))
            return 'TIMEOUT_ERROR';
        if (error.message.includes('auth'))
            return 'AUTH_ERROR';
        if (error.message.includes('rate limit'))
            return 'RATE_LIMIT_ERROR';
        if (error.message.includes('validation'))
            return 'VALIDATION_ERROR';
        return 'UNKNOWN_ERROR';
    }
    static getUserFriendlyMessage(errorCode) {
        const messages = {
            NETWORK_ERROR: 'Connection issue detected. Please check your internet connection.',
            TIMEOUT_ERROR: 'Request timed out. The service may be experiencing high load.',
            AUTH_ERROR: 'Authentication failed. Please check your credentials.',
            RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment before trying again.',
            VALIDATION_ERROR: 'Invalid data provided. Please check your input.',
            UNKNOWN_ERROR: 'An unexpected error occurred. Please try again later.'
        };
        return messages[errorCode] || messages.UNKNOWN_ERROR;
    }
    static getSuggestedActions(errorCode) {
        const actions = {
            NETWORK_ERROR: ['Check internet connection', 'Retry in a few moments', 'Contact support if persistent'],
            TIMEOUT_ERROR: ['Retry with smaller data batches', 'Try again during off-peak hours'],
            AUTH_ERROR: ['Verify API credentials', 'Check token expiration', 'Re-authenticate'],
            RATE_LIMIT_ERROR: ['Wait before retrying', 'Implement exponential backoff'],
            VALIDATION_ERROR: ['Review input data format', 'Check required fields'],
            UNKNOWN_ERROR: ['Retry operation', 'Contact support with error details']
        };
        return actions[errorCode] || actions.UNKNOWN_ERROR;
    }
    static isRetryable(errorCode) {
        return ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMIT_ERROR'].includes(errorCode);
    }
}
exports.EnhancedErrorHandler = EnhancedErrorHandler;
class ReliableWebhookService {
    static async deliverWebhook(url, payload, secret, options = {}) {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        if (opts.verifySignature && secret) {
            payload.signature = this.generateSignature(payload, secret);
        }
        let lastError = null;
        for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
            try {
                const success = await this.attemptDelivery(url, payload, opts.timeout);
                if (success) {
                    utils_1.logger.info(`Webhook delivered successfully to ${url}`, {
                        webhookId: payload.id,
                        attempt: attempt + 1
                    });
                    return true;
                }
            }
            catch (error) {
                lastError = error;
                utils_1.logger.warn(`Webhook delivery attempt ${attempt + 1} failed`, {
                    webhookId: payload.id,
                    error: error.message
                });
                if (attempt < opts.maxRetries) {
                    const delay = opts.retryDelays[Math.min(attempt, opts.retryDelays.length - 1)];
                    await this.sleep(delay);
                }
            }
        }
        utils_1.logger.error(`Webhook delivery failed after ${opts.maxRetries + 1} attempts`, {
            webhookId: payload.id,
            url,
            lastError: lastError?.message
        });
        return false;
    }
    static generateSignature(payload, secret) {
        const crypto = require('crypto');
        const payloadString = JSON.stringify(payload);
        return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    }
    static async attemptDelivery(url, payload, timeout) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.1) {
                    resolve(true);
                }
                else {
                    reject(new Error('Network error'));
                }
            }, Math.random() * 1000);
        });
    }
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ReliableWebhookService = ReliableWebhookService;
ReliableWebhookService.DEFAULT_OPTIONS = {
    maxRetries: 3,
    retryDelays: [1000, 5000, 15000],
    timeout: 30000,
    verifySignature: true
};
class PerformanceOptimizer {
    constructor(options) {
        this.cache = new Map();
        this.options = options;
    }
    async get(key) {
        const cached = this.cache.get(key);
        if (cached && cached.expires > Date.now()) {
            return cached.value;
        }
        if (cached) {
            this.cache.delete(key);
        }
        return null;
    }
    async set(key, value) {
        const expires = Date.now() + (this.options.ttl * 1000);
        if (this.options.maxSize && this.cache.size >= this.options.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, { value, expires });
    }
    async warmup(warmupFunction) {
        if (!this.options.warmupKeys)
            return;
        utils_1.logger.info(`Starting cache warmup for ${this.options.warmupKeys.length} keys`);
        const promises = this.options.warmupKeys.map(async (key) => {
            try {
                const value = await warmupFunction(key);
                await this.set(key, value);
            }
            catch (error) {
                utils_1.logger.warn(`Cache warmup failed for key: ${key}`, { error });
            }
        });
        await Promise.allSettled(promises);
        utils_1.logger.info('Cache warmup completed');
    }
    clear() {
        this.cache.clear();
    }
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.options.maxSize,
            ttl: this.options.ttl
        };
    }
}
exports.PerformanceOptimizer = PerformanceOptimizer;
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
class CircuitBreaker {
    constructor(options) {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.nextAttempt = 0;
        this.options = options;
    }
    async execute(operation) {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN - operation not allowed');
            }
            this.state = CircuitState.HALF_OPEN;
        }
        try {
            const result = await operation();
            if (this.state === CircuitState.HALF_OPEN) {
                this.reset();
            }
            return result;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    recordFailure() {
        this.failures++;
        if (this.failures >= this.options.failureThreshold) {
            this.state = CircuitState.OPEN;
            this.nextAttempt = Date.now() + this.options.recoveryTimeout;
            utils_1.logger.warn(`Circuit breaker opened after ${this.failures} failures`);
        }
    }
    reset() {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.nextAttempt = 0;
        utils_1.logger.info('Circuit breaker reset to CLOSED state');
    }
    getState() {
        return this.state;
    }
    getFailures() {
        return this.failures;
    }
}
exports.CircuitBreaker = CircuitBreaker;
class IntegrationHealthMonitor {
    constructor() {
        this.metrics = new Map();
    }
    recordRequest(integrationId, success, responseTime) {
        const current = this.metrics.get(integrationId) || this.getDefaultMetrics();
        current.totalRequests++;
        if (!success) {
            current.failedRequests++;
        }
        else {
            current.lastSuccessfulSync = new Date();
        }
        if (current.totalRequests === 1) {
            current.responseTime = responseTime;
        }
        else {
            current.responseTime = (current.responseTime + responseTime) / 2;
        }
        current.errorRate = (current.failedRequests / current.totalRequests) * 100;
        current.availability = ((current.totalRequests - current.failedRequests) / current.totalRequests) * 100;
        this.metrics.set(integrationId, current);
    }
    getHealthScore(integrationId) {
        const metrics = this.metrics.get(integrationId);
        if (!metrics)
            return 0;
        const availabilityScore = metrics.availability;
        const responseScore = Math.max(0, 100 - (metrics.responseTime / 50));
        const recentnessScore = this.getRecentnessScore(metrics.lastSuccessfulSync);
        return (availabilityScore * 0.5 + responseScore * 0.3 + recentnessScore * 0.2);
    }
    getRecentnessScore(lastSuccess) {
        if (!lastSuccess)
            return 0;
        const hoursSinceLastSuccess = (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastSuccess < 1)
            return 100;
        if (hoursSinceLastSuccess < 6)
            return 80;
        if (hoursSinceLastSuccess < 24)
            return 60;
        if (hoursSinceLastSuccess < 72)
            return 40;
        return 20;
    }
    getDefaultMetrics() {
        return {
            availability: 100,
            responseTime: 0,
            errorRate: 0,
            lastSuccessfulSync: null,
            totalRequests: 0,
            failedRequests: 0
        };
    }
    getMetrics(integrationId) {
        return this.metrics.get(integrationId) || null;
    }
    getAllMetrics() {
        return new Map(this.metrics);
    }
}
exports.IntegrationHealthMonitor = IntegrationHealthMonitor;
class SmartRetryService {
    static async executeWithRetry(operation, options = {}) {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        let lastError;
        for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt === opts.maxAttempts || !this.isRetryableError(error)) {
                    throw error;
                }
                const delay = this.calculateDelay(attempt, opts);
                utils_1.logger.info(`Retry attempt ${attempt} after ${delay}ms delay`, {
                    error: error.message
                });
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    static isRetryableError(error) {
        const retryablePatterns = [
            /network/i,
            /timeout/i,
            /rate.?limit/i,
            /service.?unavailable/i,
            /temporarily.?unavailable/i
        ];
        return retryablePatterns.some(pattern => pattern.test(error.message));
    }
    static calculateDelay(attempt, options) {
        let delay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);
        delay = Math.min(delay, options.maxDelay);
        if (options.jitter) {
            const jitterAmount = delay * 0.25;
            delay += (Math.random() - 0.5) * 2 * jitterAmount;
        }
        return Math.floor(delay);
    }
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.SmartRetryService = SmartRetryService;
SmartRetryService.DEFAULT_OPTIONS = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
};
class AdvancedAnalyticsService {
    constructor() {
        this.events = [];
    }
    track(event) {
        this.events.push(event);
        utils_1.logger.debug('Analytics event tracked', {
            event: event.event,
            integrationId: event.integrationId
        });
    }
    getIntegrationMetrics(integrationId, timeRange) {
        const filteredEvents = this.events.filter(e => e.integrationId === integrationId &&
            e.timestamp >= timeRange.start &&
            e.timestamp <= timeRange.end);
        return {
            totalEvents: filteredEvents.length,
            uniqueUsers: new Set(filteredEvents.map(e => e.userId)).size,
            eventTypes: this.groupBy(filteredEvents, 'event'),
            timeline: this.groupEventsByTimeWindow(filteredEvents, 'hour')
        };
    }
    groupBy(events, field) {
        return events.reduce((acc, event) => {
            const key = String(event[field]);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }
    groupEventsByTimeWindow(events, window) {
        const windowMs = window === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        return events.reduce((acc, event) => {
            const windowStart = Math.floor(event.timestamp.getTime() / windowMs) * windowMs;
            const key = new Date(windowStart).toISOString();
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }
    generateReport(timeRange) {
        const allEvents = this.events.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end);
        return {
            summary: {
                totalEvents: allEvents.length,
                uniqueIntegrations: new Set(allEvents.map(e => e.integrationId)).size,
                uniqueUsers: new Set(allEvents.map(e => e.userId)).size,
                timeRange
            },
            byIntegration: [...new Set(allEvents.map(e => e.integrationId))].map(id => ({
                integrationId: id,
                metrics: this.getIntegrationMetrics(id, timeRange)
            }))
        };
    }
}
exports.AdvancedAnalyticsService = AdvancedAnalyticsService;
//# sourceMappingURL=CompetitiveEnhancements.js.map