"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = void 0;
const events_1 = require("events");
const redis_1 = require("@/lib/redis");
const prisma_1 = require("@/lib/prisma");
const rate_limiter_1 = require("./rate-limiter");
const configuration_1 = require("./configuration");
class ErrorHandler extends events_1.EventEmitter {
    constructor() {
        super();
        this.recoveryQueue = [];
        this.isProcessingRecovery = false;
        this.healthMetrics = new Map();
        this.rateLimitManager = rate_limiter_1.RateLimitManager.getInstance();
        this.startHealthChecking();
        this.startRecoveryProcessing();
        this.setupErrorPatternDetection();
    }
    static getInstance() {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }
    async handleError(error, context, retryConfig) {
        try {
            await this.logError(error, context);
            await this.updateHealthMetrics(error, context);
            await this.detectErrorPatterns(error, context);
            const recoveryAction = await this.determineRecoveryStrategy(error, context, retryConfig);
            if (recoveryAction) {
                await this.scheduleRecoveryAction(recoveryAction);
            }
            const errorEvent = {
                type: 'sync.failed',
                posType: context.posType,
                locationId: context.locationId,
                timestamp: new Date(),
                error: error,
                data: context
            };
            this.emit('pos:error', errorEvent);
            console.error(`POS Error [${context.posType}:${context.operation}]:`, error.message);
        }
        catch (handlingError) {
            console.error('Error handler failed:', handlingError);
        }
    }
    async logError(error, context) {
        try {
            const errorLog = {
                id: crypto.randomUUID(),
                businessId: context.businessId || 'unknown',
                posType: context.posType,
                operation: context.operation,
                errorCode: error.code,
                errorMessage: error.message,
                statusCode: error.statusCode,
                retryable: error.retryable,
                locationId: context.locationId,
                metadata: JSON.stringify({
                    ...context.metadata,
                    stack: error.stack,
                    details: error.details
                }),
                timestamp: context.timestamp,
                createdAt: new Date()
            };
            await prisma_1.prisma.posErrorLog.create({ data: errorLog });
            const redisKey = `pos_errors:${context.posType}:${context.businessId || 'global'}`;
            await redis_1.redis.lpush(redisKey, JSON.stringify(errorLog));
            await redis_1.redis.ltrim(redisKey, 0, 99);
            await redis_1.redis.expire(redisKey, 86400);
        }
        catch (logError) {
            console.error('Failed to log error:', logError);
        }
    }
    async updateHealthMetrics(error, context) {
        const key = `${context.posType}:${context.businessId || 'global'}`;
        let metrics = this.healthMetrics.get(key);
        if (!metrics) {
            metrics = {
                posType: context.posType,
                businessId: context.businessId || 'global',
                successRate: 0,
                errorRate: 0,
                avgResponseTime: 0,
                connectionStatus: 'healthy',
                lastHealthCheck: new Date()
            };
        }
        metrics.errorRate = await this.calculateErrorRate(context.posType, context.businessId);
        metrics.successRate = 100 - metrics.errorRate;
        metrics.lastError = error;
        metrics.lastHealthCheck = new Date();
        if (metrics.errorRate > 50) {
            metrics.connectionStatus = 'unhealthy';
        }
        else if (metrics.errorRate > 25) {
            metrics.connectionStatus = 'degraded';
        }
        else if (error.code === 'CONNECTION_ERROR' || error.code === 'AUTH_ERROR') {
            metrics.connectionStatus = 'disconnected';
        }
        else {
            metrics.connectionStatus = 'healthy';
        }
        this.healthMetrics.set(key, metrics);
        const redisKey = `health_metrics:${key}`;
        await redis_1.redis.setex(redisKey, 3600, JSON.stringify(metrics));
    }
    async calculateErrorRate(posType, businessId) {
        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const totalRequests = await this.getTotalRequests(posType, businessId, oneHourAgo);
            const errorRequests = await prisma_1.prisma.posErrorLog.count({
                where: {
                    posType,
                    businessId: businessId || 'unknown',
                    timestamp: { gte: oneHourAgo }
                }
            });
            if (totalRequests === 0)
                return 0;
            return (errorRequests / totalRequests) * 100;
        }
        catch (error) {
            console.error('Failed to calculate error rate:', error);
            return 0;
        }
    }
    async getTotalRequests(posType, businessId, since) {
        try {
            const status = await this.rateLimitManager.getRateLimitStatus(posType, businessId);
            return Math.max(100, status.remaining);
        }
        catch (error) {
            return 100;
        }
    }
    async detectErrorPatterns(error, context) {
        try {
            const patternKey = `${error.code}:${context.posType}`;
            const redisKey = `error_patterns:${patternKey}`;
            let pattern = await redis_1.redis.get(redisKey);
            let patternData;
            if (pattern) {
                patternData = JSON.parse(pattern);
                patternData.count++;
                patternData.lastSeen = new Date();
            }
            else {
                patternData = {
                    code: error.code,
                    posType: context.posType,
                    count: 1,
                    firstSeen: new Date(),
                    lastSeen: new Date()
                };
            }
            if (patternData.count >= 10) {
                patternData.resolutionStrategy = this.suggestResolutionStrategy(error, patternData);
                this.emit('error:pattern_detected', {
                    pattern: patternData,
                    error,
                    context
                });
            }
            await redis_1.redis.setex(redisKey, 86400, JSON.stringify(patternData));
        }
        catch (error) {
            console.error('Failed to detect error patterns:', error);
        }
    }
    suggestResolutionStrategy(error, pattern) {
        switch (error.code) {
            case 'AUTH_ERROR':
                return 'refresh_credentials';
            case 'RATE_LIMITED':
                return 'implement_backoff';
            case 'CONNECTION_ERROR':
                return 'check_network_connectivity';
            case 'VALIDATION_ERROR':
                return 'review_data_format';
            default:
                return `investigate_${error.code.toLowerCase()}`;
        }
    }
    async determineRecoveryStrategy(error, context, retryConfig) {
        if (!error.retryable && !this.isRecoverableError(error)) {
            return null;
        }
        const recoveryType = this.getRecoveryType(error);
        if (!recoveryType)
            return null;
        const existingAction = this.findExistingRecoveryAction(context.businessId, context.posType, recoveryType);
        if (existingAction && existingAction.attempts >= existingAction.maxAttempts) {
            return null;
        }
        const action = {
            id: crypto.randomUUID(),
            type: recoveryType,
            businessId: context.businessId || 'unknown',
            posType: context.posType,
            scheduledAt: new Date(Date.now() + this.getRecoveryDelay(recoveryType, existingAction?.attempts || 0)),
            attempts: (existingAction?.attempts || 0) + 1,
            maxAttempts: this.getMaxAttempts(recoveryType, retryConfig)
        };
        return action;
    }
    isRecoverableError(error) {
        const recoverableCodes = [
            'AUTH_ERROR', 'RATE_LIMITED', 'CONNECTION_ERROR',
            'SERVER_ERROR', 'TIMEOUT', 'TEMPORARY_ERROR'
        ];
        return recoverableCodes.includes(error.code);
    }
    getRecoveryType(error) {
        switch (error.code) {
            case 'AUTH_ERROR':
                return 'refresh_token';
            case 'RATE_LIMITED':
            case 'CONNECTION_ERROR':
            case 'TIMEOUT':
                return 'retry';
            case 'SERVER_ERROR':
                return 'reset_connection';
            default:
                return error.retryable ? 'retry' : null;
        }
    }
    getRecoveryDelay(type, attemptCount) {
        const delays = this.RECOVERY_INTERVALS[type] || this.RECOVERY_INTERVALS.retry;
        const delayIndex = Math.min(attemptCount, delays.length - 1);
        return delays[delayIndex];
    }
    getMaxAttempts(type, retryConfig) {
        if (retryConfig?.maxAttempts) {
            return retryConfig.maxAttempts;
        }
        switch (type) {
            case 'retry': return 5;
            case 'refresh_token': return 3;
            case 'reset_connection': return 2;
            case 'disable_integration': return 1;
            default: return 3;
        }
    }
    findExistingRecoveryAction(businessId, posType, type) {
        return this.recoveryQueue.find(action => action.businessId === (businessId || 'unknown') &&
            action.posType === posType &&
            (!type || action.type === type) &&
            !action.success);
    }
    async scheduleRecoveryAction(action) {
        this.recoveryQueue.push(action);
        await prisma_1.prisma.recoveryAction.create({
            data: {
                id: action.id,
                type: action.type,
                businessId: action.businessId,
                posType: action.posType,
                scheduledAt: action.scheduledAt,
                attempts: action.attempts,
                maxAttempts: action.maxAttempts,
                createdAt: new Date()
            }
        });
        console.log(`Scheduled ${action.type} recovery for ${action.posType}:${action.businessId} in ${action.scheduledAt.getTime() - Date.now()}ms`);
    }
    startRecoveryProcessing() {
        setInterval(async () => {
            if (this.isProcessingRecovery)
                return;
            this.isProcessingRecovery = true;
            try {
                const now = new Date();
                const dueActions = this.recoveryQueue.filter(action => action.scheduledAt <= now && !action.success);
                for (const action of dueActions) {
                    try {
                        await this.executeRecoveryAction(action);
                    }
                    catch (error) {
                        console.error(`Recovery action failed: ${action.type}`, error);
                        action.error = error.message;
                    }
                }
                this.recoveryQueue = this.recoveryQueue.filter(action => !action.success && action.attempts < action.maxAttempts);
            }
            finally {
                this.isProcessingRecovery = false;
            }
        }, 10000);
    }
    async executeRecoveryAction(action) {
        action.lastAttempt = new Date();
        try {
            switch (action.type) {
                case 'refresh_token':
                    await this.refreshToken(action.businessId, action.posType);
                    break;
                case 'reset_connection':
                    await this.resetConnection(action.businessId, action.posType);
                    break;
                case 'disable_integration':
                    await this.disableIntegration(action.businessId, action.posType);
                    break;
                case 'retry':
                    break;
            }
            action.success = true;
            await prisma_1.prisma.recoveryAction.update({
                where: { id: action.id },
                data: {
                    lastAttempt: action.lastAttempt,
                    success: true,
                    updatedAt: new Date()
                }
            });
            this.emit('recovery:success', action);
            console.log(`Recovery action successful: ${action.type} for ${action.posType}:${action.businessId}`);
        }
        catch (error) {
            action.attempts++;
            await prisma_1.prisma.recoveryAction.update({
                where: { id: action.id },
                data: {
                    lastAttempt: action.lastAttempt,
                    attempts: action.attempts,
                    error: error.message,
                    updatedAt: new Date()
                }
            });
            if (action.attempts >= action.maxAttempts) {
                this.emit('recovery:failed', action);
                console.error(`Recovery action failed permanently: ${action.type} for ${action.posType}:${action.businessId}`);
            }
            throw error;
        }
    }
    async refreshToken(businessId, posType) {
        const config = await configuration_1.ConfigurationManager.loadConfiguration(businessId, posType);
        if (!config || !config.credentials.refreshToken) {
            throw new Error('No refresh token available');
        }
        console.log(`Refreshing token for ${posType}:${businessId}`);
    }
    async resetConnection(businessId, posType) {
        const cacheKey = `pos_connection:${businessId}:${posType}`;
        await redis_1.redis.del(cacheKey);
        await this.rateLimitManager.clearAllQueues();
        console.log(`Reset connection for ${posType}:${businessId}`);
    }
    async disableIntegration(businessId, posType) {
        await configuration_1.ConfigurationManager.toggleActive(businessId, posType, false);
        console.log(`Disabled integration for ${posType}:${businessId}`);
    }
    startHealthChecking() {
        setInterval(async () => {
            await this.performHealthChecks();
        }, this.HEALTH_CHECK_INTERVAL);
    }
    async performHealthChecks() {
        try {
            const activeConfigs = await prisma_1.prisma.posConfiguration.findMany({
                where: { isActive: true }
            });
            for (const config of activeConfigs) {
                try {
                    await this.checkIntegrationHealth(config.businessId, config.posType);
                }
                catch (error) {
                    console.error(`Health check failed for ${config.posType}:${config.businessId}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Failed to perform health checks:', error);
        }
    }
    async checkIntegrationHealth(businessId, posType) {
        const key = `${posType}:${businessId}`;
        let metrics = this.healthMetrics.get(key);
        if (!metrics) {
            metrics = {
                posType,
                businessId,
                successRate: 100,
                errorRate: 0,
                avgResponseTime: 0,
                connectionStatus: 'healthy',
                lastHealthCheck: new Date()
            };
        }
        metrics.errorRate = await this.calculateErrorRate(posType, businessId);
        metrics.successRate = 100 - metrics.errorRate;
        metrics.lastHealthCheck = new Date();
        if (metrics.errorRate > 75) {
            metrics.connectionStatus = 'unhealthy';
        }
        else if (metrics.errorRate > 50) {
            metrics.connectionStatus = 'degraded';
        }
        else {
            metrics.connectionStatus = 'healthy';
        }
        this.healthMetrics.set(key, metrics);
        this.emit('health:updated', { businessId, posType, metrics });
    }
    setupErrorPatternDetection() {
        setInterval(async () => {
            try {
                const keys = await redis_1.redis.keys('error_patterns:*');
                for (const key of keys) {
                    const pattern = await redis_1.redis.get(key);
                    if (pattern) {
                        const patternData = JSON.parse(pattern);
                        const ageHours = (Date.now() - new Date(patternData.lastSeen).getTime()) / (1000 * 60 * 60);
                        if (ageHours > 24) {
                            await redis_1.redis.del(key);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Failed to clean up error patterns:', error);
            }
        }, 3600000);
    }
    async getErrorStats() {
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const totalErrors = await prisma_1.prisma.posErrorLog.count({
                where: { timestamp: { gte: oneDayAgo } }
            });
            const byPOS = await prisma_1.prisma.posErrorLog.groupBy({
                by: ['posType'],
                where: { timestamp: { gte: oneDayAgo } },
                _count: true
            });
            const byCode = await prisma_1.prisma.posErrorLog.groupBy({
                by: ['errorCode'],
                where: { timestamp: { gte: oneDayAgo } },
                _count: true
            });
            const recoveryStats = await prisma_1.prisma.recoveryAction.aggregate({
                where: { createdAt: { gte: oneDayAgo } },
                _count: { id: true },
                _sum: {
                    success: true
                }
            });
            const errorsByPOS = byPOS.reduce((acc, item) => {
                acc[item.posType] = item._count;
                return acc;
            }, {});
            const errorsByCode = byCode.reduce((acc, item) => {
                acc[item.errorCode] = item._count;
                return acc;
            }, {});
            return {
                totalErrors,
                errorsByPOS,
                errorsByCode,
                recoveryActions: {
                    total: recoveryStats._count.id || 0,
                    successful: recoveryStats._sum.success || 0,
                    failed: (recoveryStats._count.id || 0) - (recoveryStats._sum.success || 0)
                }
            };
        }
        catch (error) {
            console.error('Failed to get error stats:', error);
            return {
                totalErrors: 0,
                errorsByPOS: {},
                errorsByCode: {},
                recoveryActions: { total: 0, successful: 0, failed: 0 }
            };
        }
    }
    getHealthMetrics() {
        return Array.from(this.healthMetrics.values());
    }
}
exports.ErrorHandler = ErrorHandler;
ErrorHandler.ERROR_RETENTION_DAYS = 30;
ErrorHandler.HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
ErrorHandler.RECOVERY_INTERVALS = {
    retry: [1000, 5000, 15000, 60000, 300000],
    refresh_token: [60000],
    reset_connection: [300000],
    disable_integration: [0]
};
//# sourceMappingURL=error-handler.js.map