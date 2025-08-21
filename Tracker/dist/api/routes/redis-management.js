"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const TaxRateCacheService_1 = require("@/services/redis/TaxRateCacheService");
const JobQueueService_1 = require("@/services/redis/JobQueueService");
const SessionService_1 = require("@/services/redis/SessionService");
const RedisMonitoringService_1 = require("@/services/redis/RedisMonitoringService");
const middleware_1 = require("@/api/middleware");
const middleware_2 = require("@/api/middleware");
const joi_1 = __importDefault(require("joi"));
const router = express_1.default.Router();
router.get('/health', async (req, res, next) => {
    try {
        const health = await RedisMonitoringService_1.redisMonitoring.getSystemHealth();
        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 206 : 503;
        res.status(statusCode).json(health);
    }
    catch (error) {
        next(error);
    }
});
router.get('/metrics', async (req, res, next) => {
    try {
        const metrics = await RedisMonitoringService_1.redisMonitoring.getPerformanceMetrics();
        res.json(metrics);
    }
    catch (error) {
        next(error);
    }
});
router.get('/report', async (req, res, next) => {
    try {
        const report = await RedisMonitoringService_1.redisMonitoring.generateReport();
        res.json(report);
    }
    catch (error) {
        next(error);
    }
});
router.get('/cache/stats', async (req, res, next) => {
    try {
        const stats = await TaxRateCacheService_1.taxRateCache.getCacheStats();
        const size = await TaxRateCacheService_1.taxRateCache.getCacheSize();
        res.json({
            stats,
            size,
            expiringSoon: await TaxRateCacheService_1.taxRateCache.getExpiringSoon()
        });
    }
    catch (error) {
        next(error);
    }
});
const cacheInvalidateSchema = joi_1.default.object({
    pattern: joi_1.default.string().optional(),
    state: joi_1.default.string().length(2).optional(),
    jurisdiction: joi_1.default.string().optional()
});
router.post('/cache/invalidate', (0, middleware_2.validateRequest)(cacheInvalidateSchema), async (req, res, next) => {
    try {
        const { pattern, state, jurisdiction } = req.body;
        let deletedCount = 0;
        if (pattern) {
            deletedCount = await middleware_1.cacheMiddleware.invalidateCache(pattern);
        }
        else if (state) {
            deletedCount = await TaxRateCacheService_1.taxRateCache.invalidateForJurisdiction(state, jurisdiction);
        }
        else {
            deletedCount = await TaxRateCacheService_1.taxRateCache.invalidateCache();
        }
        res.json({
            success: true,
            deletedEntries: deletedCount,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/cache/warmup', async (req, res, next) => {
    try {
        await TaxRateCacheService_1.taxRateCache.warmupCache();
        res.json({
            success: true,
            message: 'Cache warmup initiated',
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.post('/cache/preload-frequent', async (req, res, next) => {
    try {
        await TaxRateCacheService_1.taxRateCache.preloadFrequentlyAccessedRates();
        res.json({
            success: true,
            message: 'Frequently accessed rates preloaded',
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/queues', async (req, res, next) => {
    try {
        const metrics = await JobQueueService_1.jobQueue.getAllQueueMetrics();
        const availableQueues = JobQueueService_1.jobQueue.getAvailableQueues();
        res.json({
            availableQueues,
            metrics,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/queues/:queueName', async (req, res, next) => {
    try {
        const { queueName } = req.params;
        const metrics = await JobQueueService_1.jobQueue.getQueueMetrics(queueName);
        const activeJobs = await JobQueueService_1.jobQueue.getActiveJobs(queueName);
        const failedJobs = await JobQueueService_1.jobQueue.getFailedJobs(queueName);
        const waitingJobs = await JobQueueService_1.jobQueue.getWaitingJobs(queueName);
        res.json({
            queueName,
            metrics,
            jobs: {
                active: activeJobs.map(job => ({
                    id: job.id,
                    data: job.data,
                    progress: job.progress(),
                    createdAt: new Date(job.timestamp)
                })),
                failed: failedJobs.slice(0, 10).map(job => ({
                    id: job.id,
                    data: job.data,
                    failedReason: job.failedReason,
                    createdAt: new Date(job.timestamp)
                })),
                waiting: waitingJobs.slice(0, 10).map(job => ({
                    id: job.id,
                    data: job.data,
                    createdAt: new Date(job.timestamp)
                }))
            }
        });
    }
    catch (error) {
        next(error);
    }
});
const queueActionSchema = joi_1.default.object({
    action: joi_1.default.string().valid('pause', 'resume', 'drain', 'retry-failed').required()
});
router.post('/queues/:queueName', (0, middleware_2.validateRequest)(queueActionSchema), async (req, res, next) => {
    try {
        const { queueName } = req.params;
        const { action } = req.body;
        let result = { success: true, action, queueName };
        switch (action) {
            case 'pause':
                await JobQueueService_1.jobQueue.pauseQueue(queueName);
                result.message = `Queue ${queueName} paused`;
                break;
            case 'resume':
                await JobQueueService_1.jobQueue.resumeQueue(queueName);
                result.message = `Queue ${queueName} resumed`;
                break;
            case 'drain':
                await JobQueueService_1.jobQueue.drainQueue(queueName);
                result.message = `Queue ${queueName} drained`;
                break;
            case 'retry-failed':
                const retriedCount = await JobQueueService_1.jobQueue.retryFailedJobs(queueName);
                result.message = `Retried ${retriedCount} failed jobs`;
                result.retriedCount = retriedCount;
                break;
            default:
                res.status(400).json({ error: 'Invalid action' });
                return;
        }
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
router.get('/sessions/metrics', async (req, res, next) => {
    try {
        const metrics = await SessionService_1.sessionService.getSessionMetrics();
        res.json(metrics);
    }
    catch (error) {
        next(error);
    }
});
router.post('/optimize', async (req, res, next) => {
    try {
        const optimization = await RedisMonitoringService_1.redisMonitoring.optimizeRedis();
        res.json({
            success: true,
            optimization,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
router.get('/diagnostics', async (req, res, next) => {
    try {
        const diagnostics = await RedisMonitoringService_1.redisMonitoring.collectDiagnostics();
        res.json(diagnostics);
    }
    catch (error) {
        next(error);
    }
});
router.post('/health-check', async (req, res, next) => {
    try {
        const healthChecks = await RedisMonitoringService_1.redisMonitoring.runHealthChecks();
        const statusCode = healthChecks.overall === 'pass' ? 200 : 503;
        res.status(statusCode).json(healthChecks);
    }
    catch (error) {
        next(error);
    }
});
router.get('/redis/info', async (req, res, next) => {
    try {
        const info = { Server: { redis_version: 'Redis disabled in development mode' } };
        const connectionHealth = { status: 'unhealthy', connections: {}, metrics: {} };
        res.json({
            info,
            connectionHealth,
            timestamp: new Date()
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=redis-management.js.map