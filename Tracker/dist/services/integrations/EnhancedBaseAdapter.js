"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedBaseAdapter = void 0;
const CompetitiveEnhancements_1 = require("./CompetitiveEnhancements");
const utils_1 = require("../../utils");
class EnhancedBaseAdapter {
    constructor(config) {
        this.config = config;
        const circuitOptions = {
            failureThreshold: 5,
            recoveryTimeout: 30000,
            monitoringWindow: 60000,
            ...config.circuitBreakerOptions
        };
        this.circuitBreaker = new CompetitiveEnhancements_1.CircuitBreaker(circuitOptions);
        const cacheOptions = {
            ttl: 300,
            maxSize: 1000,
            ...config.cacheOptions
        };
        this.cache = new CompetitiveEnhancements_1.PerformanceOptimizer(cacheOptions);
        this.healthMonitor = new CompetitiveEnhancements_1.IntegrationHealthMonitor();
        this.analytics = new CompetitiveEnhancements_1.AdvancedAnalyticsService();
        utils_1.logger.info(`Enhanced adapter initialized: ${config.name}`, { id: config.id });
    }
    async syncTransactions(lastSyncTime) {
        return this.executeWithEnhancements('syncTransactions', () => this.doSyncTransactions(lastSyncTime), { useCache: true, cacheTTL: 300 });
    }
    async syncProducts(lastSyncTime) {
        return this.executeWithEnhancements('syncProducts', () => this.doSyncProducts(lastSyncTime), { useCache: true, cacheTTL: 600 });
    }
    async syncCustomers(lastSyncTime) {
        return this.executeWithEnhancements('syncCustomers', () => this.doSyncCustomers(lastSyncTime), { useCache: true, cacheTTL: 600 });
    }
    async calculateTax(request) {
        const cacheKey = this.generateTaxCacheKey(request);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
            this.trackAnalyticsEvent('tax_calculation_cache_hit', { cacheKey });
            return cached;
        }
        return this.executeWithEnhancements('calculateTax', async () => {
            const result = await this.doCalculateTax(request);
            await this.cache.set(cacheKey, result);
            this.trackAnalyticsEvent('tax_calculation_cache_miss', { cacheKey });
            return result;
        }, { useCache: false });
    }
    async updateTransaction(request) {
        return this.executeWithEnhancements('updateTransaction', async () => {
            utils_1.logger.info('Transaction update requested', {
                integrationId: this.config.id,
                transactionId: request.transactionId,
                status: request.status
            });
            return true;
        }, { useCache: false });
    }
    async handleWebhook(payload, signature) {
        try {
            if (this.config.webhookSecret && signature) {
                const isValid = this.verifyWebhookSignature(payload, signature);
                if (!isValid) {
                    utils_1.logger.warn('Invalid webhook signature', { integrationId: this.config.id });
                    return false;
                }
            }
            this.trackAnalyticsEvent('webhook_received', {
                type: payload.type || 'unknown',
                hasSignature: !!signature
            });
            const processed = await this.processWebhook(payload);
            if (processed) {
                this.trackAnalyticsEvent('webhook_processed', { type: payload.type });
            }
            return processed;
        }
        catch (error) {
            utils_1.logger.error('Webhook processing failed', {
                integrationId: this.config.id,
                error: error.message
            });
            return false;
        }
    }
    async sendWebhook(url, payload, options) {
        return CompetitiveEnhancements_1.ReliableWebhookService.deliverWebhook(url, payload, this.config.webhookSecret, options);
    }
    getHealthMetrics() {
        const metrics = this.healthMonitor.getMetrics(this.config.id);
        const healthScore = this.healthMonitor.getHealthScore(this.config.id);
        const circuitState = this.circuitBreaker.getState();
        const cacheStats = this.cache.getStats();
        return {
            id: this.config.id,
            name: this.config.name,
            enabled: this.config.enabled,
            healthScore,
            circuitState,
            metrics,
            cacheStats,
            lastUpdated: new Date()
        };
    }
    getAnalyticsReport(timeRange) {
        return this.analytics.getIntegrationMetrics(this.config.id, timeRange);
    }
    async executeWithEnhancements(operation, fn, options = {}) {
        const startTime = Date.now();
        const context = {
            operation,
            integrationId: this.config.id
        };
        try {
            if (options.useCache && options.cacheKey) {
                const cached = await this.cache.get(options.cacheKey);
                if (cached) {
                    this.trackAnalyticsEvent('cache_hit', { operation, cacheKey: options.cacheKey });
                    return cached;
                }
            }
            const result = await this.circuitBreaker.execute(() => CompetitiveEnhancements_1.SmartRetryService.executeWithRetry(fn, this.config.retryOptions));
            if (options.useCache && options.cacheKey && options.cacheTTL) {
                const originalTTL = this.cache['options'].ttl;
                this.cache['options'].ttl = options.cacheTTL;
                await this.cache.set(options.cacheKey, result);
                this.cache['options'].ttl = originalTTL;
            }
            const duration = Date.now() - startTime;
            this.healthMonitor.recordRequest(this.config.id, true, duration);
            this.trackAnalyticsEvent('operation_success', {
                operation,
                duration,
                cacheUsed: options.useCache || false
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.healthMonitor.recordRequest(this.config.id, false, duration);
            const actionableError = CompetitiveEnhancements_1.EnhancedErrorHandler.createActionableError(error, context);
            this.trackAnalyticsEvent('operation_failure', {
                operation,
                duration,
                errorCode: actionableError.code,
                retryable: actionableError.retryable
            });
            utils_1.logger.error('Enhanced operation failed', {
                integrationId: this.config.id,
                operation,
                actionableError
            });
            throw actionableError;
        }
    }
    async processWebhook(payload) {
        utils_1.logger.info('Processing webhook', {
            integrationId: this.config.id,
            type: payload.type
        });
        return true;
    }
    verifyWebhookSignature(payload, signature) {
        if (!this.config.webhookSecret)
            return true;
        try {
            const crypto = require('crypto');
            const payloadString = JSON.stringify(payload);
            const expectedSignature = crypto
                .createHmac('sha256', this.config.webhookSecret)
                .update(payloadString)
                .digest('hex');
            return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
        }
        catch (error) {
            utils_1.logger.error('Webhook signature verification failed', {
                integrationId: this.config.id,
                error: error.message
            });
            return false;
        }
    }
    generateTaxCacheKey(request) {
        const crypto = require('crypto');
        const keyData = {
            items: request.items,
            address: request.address,
            customerTaxExempt: request.customerTaxExempt || false
        };
        return `tax_${crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex')}`;
    }
    trackAnalyticsEvent(event, properties = {}) {
        const analyticsEvent = {
            event,
            integrationId: this.config.id,
            timestamp: new Date(),
            properties: {
                adapterName: this.config.name,
                ...properties
            }
        };
        this.analytics.track(analyticsEvent);
    }
    async cleanup() {
        this.cache.clear();
        utils_1.logger.info(`Enhanced adapter cleanup completed: ${this.config.name}`);
    }
}
exports.EnhancedBaseAdapter = EnhancedBaseAdapter;
//# sourceMappingURL=EnhancedBaseAdapter.js.map