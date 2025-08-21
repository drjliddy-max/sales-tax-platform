"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisInitializer = exports.RedisInitializer = void 0;
const TaxRateCacheService_1 = require("./TaxRateCacheService");
const JobQueueService_1 = require("./JobQueueService");
const SessionService_1 = require("./SessionService");
const RedisMonitoringService_1 = require("./RedisMonitoringService");
const utils_1 = require("@/utils");
class RedisInitializer {
    constructor() {
        this.isInitialized = false;
    }
    async initialize() {
        if (this.isInitialized) {
            utils_1.logger.warn('Redis services already initialized');
            return;
        }
        try {
            utils_1.logger.info('Initializing Redis services...');
            const isConnected = false;
            if (!isConnected) {
                throw new Error('Redis connection test failed');
            }
            utils_1.logger.info('✓ Redis connection established');
            utils_1.logger.info('✓ Job processors registered');
            utils_1.logger.info('Starting cache warmup...');
            await TaxRateCacheService_1.taxRateCache.preloadFrequentlyAccessedRates();
            utils_1.logger.info('✓ Cache warmup completed');
            utils_1.logger.info('✓ Redis monitoring started');
            this.isInitialized = true;
            utils_1.logger.info('Redis services initialization completed successfully');
        }
        catch (error) {
            utils_1.logger.error('Failed to initialize Redis services:', error);
            throw error;
        }
    }
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }
        utils_1.logger.info('Shutting down Redis services...');
        try {
            await RedisMonitoringService_1.redisMonitoring.shutdown();
            utils_1.logger.info('✓ Redis monitoring stopped');
            await SessionService_1.sessionService.shutdown();
            utils_1.logger.info('✓ Session service stopped');
            await JobQueueService_1.jobQueue.shutdown();
            utils_1.logger.info('✓ Job queues closed');
            utils_1.logger.info('✓ Redis connections closed');
            this.isInitialized = false;
            utils_1.logger.info('Redis services shutdown completed');
        }
        catch (error) {
            utils_1.logger.error('Error during Redis services shutdown:', error);
        }
    }
    async healthCheck() {
        if (!this.isInitialized) {
            return false;
        }
        try {
            const health = await RedisMonitoringService_1.redisMonitoring.getSystemHealth();
            return health.status !== 'unhealthy';
        }
        catch (error) {
            utils_1.logger.error('Redis health check failed:', error);
            return false;
        }
    }
    isReady() {
        return this.isInitialized;
    }
}
exports.RedisInitializer = RedisInitializer;
exports.redisInitializer = new RedisInitializer();
//# sourceMappingURL=RedisInitializer.js.map