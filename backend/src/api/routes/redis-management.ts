import express from 'express';
// import { redisConnection } from '@/services/redis/RedisConnectionService';
import { taxRateCache } from '@/services/redis/TaxRateCacheService';
import { jobQueue } from '@/services/redis/JobQueueService';
import { sessionService } from '@/services/redis/SessionService';
import { redisMonitoring } from '@/services/redis/RedisMonitoringService';
import { cacheMiddleware } from '@/api/middleware';
import { validateRequest } from '@/api/middleware';
import Joi from 'joi';

const router = express.Router();

// Health check endpoint
router.get('/health', async (req, res, next) => {
  try {
    const health = await redisMonitoring.getSystemHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    next(error);
  }
});

// Performance metrics
router.get('/metrics', async (req, res, next) => {
  try {
    const metrics = await redisMonitoring.getPerformanceMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// Comprehensive monitoring report
router.get('/report', async (req, res, next) => {
  try {
    const report = await redisMonitoring.generateReport();
    res.json(report);
  } catch (error) {
    next(error);
  }
});

// Cache management endpoints
router.get('/cache/stats', async (req, res, next) => {
  try {
    const stats = await taxRateCache.getCacheStats();
    const size = await taxRateCache.getCacheSize();
    
    res.json({
      stats,
      size,
      expiringSoon: await taxRateCache.getExpiringSoon()
    });
  } catch (error) {
    next(error);
  }
});

const cacheInvalidateSchema = Joi.object({
  pattern: Joi.string().optional(),
  state: Joi.string().length(2).optional(),
  jurisdiction: Joi.string().optional()
});

router.post('/cache/invalidate', validateRequest(cacheInvalidateSchema), async (req, res, next) => {
  try {
    const { pattern, state, jurisdiction } = req.body;
    
    let deletedCount = 0;
    
    if (pattern) {
      deletedCount = await cacheMiddleware.invalidateCache(pattern);
    } else if (state) {
      deletedCount = await taxRateCache.invalidateForJurisdiction(state, jurisdiction);
    } else {
      deletedCount = await taxRateCache.invalidateCache();
    }
    
    res.json({
      success: true,
      deletedEntries: deletedCount,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/cache/warmup', async (req, res, next) => {
  try {
    await taxRateCache.warmupCache();
    
    res.json({
      success: true,
      message: 'Cache warmup initiated',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/cache/preload-frequent', async (req, res, next) => {
  try {
    await taxRateCache.preloadFrequentlyAccessedRates();
    
    res.json({
      success: true,
      message: 'Frequently accessed rates preloaded',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Queue management endpoints
router.get('/queues', async (req, res, next) => {
  try {
    const metrics = await jobQueue.getAllQueueMetrics();
    const availableQueues = jobQueue.getAvailableQueues();
    
    res.json({
      availableQueues,
      metrics,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/queues/:queueName', async (req, res, next) => {
  try {
    const { queueName } = req.params;
    const metrics = await jobQueue.getQueueMetrics(queueName);
    const activeJobs = await jobQueue.getActiveJobs(queueName);
    const failedJobs = await jobQueue.getFailedJobs(queueName);
    const waitingJobs = await jobQueue.getWaitingJobs(queueName);
    
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
  } catch (error) {
    next(error);
  }
});

const queueActionSchema = Joi.object({
  action: Joi.string().valid('pause', 'resume', 'drain', 'retry-failed').required()
});

router.post('/queues/:queueName', validateRequest(queueActionSchema), async (req, res, next): Promise<void> => {
  try {
    const { queueName } = req.params;
    const { action } = req.body;
    
    let result: any = { success: true, action, queueName };
    
    switch (action) {
      case 'pause':
        await jobQueue.pauseQueue(queueName);
        result.message = `Queue ${queueName} paused`;
        break;
        
      case 'resume':
        await jobQueue.resumeQueue(queueName);
        result.message = `Queue ${queueName} resumed`;
        break;
        
      case 'drain':
        await jobQueue.drainQueue(queueName);
        result.message = `Queue ${queueName} drained`;
        break;
        
      case 'retry-failed':
        const retriedCount = await jobQueue.retryFailedJobs(queueName);
        result.message = `Retried ${retriedCount} failed jobs`;
        result.retriedCount = retriedCount;
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action' });
        return;
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Session management endpoints
router.get('/sessions/metrics', async (req, res, next) => {
  try {
    const metrics = await sessionService.getSessionMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

// System optimization
router.post('/optimize', async (req, res, next) => {
  try {
    const optimization = await redisMonitoring.optimizeRedis();
    
    res.json({
      success: true,
      optimization,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// Diagnostics endpoint
router.get('/diagnostics', async (req, res, next) => {
  try {
    const diagnostics = await redisMonitoring.collectDiagnostics();
    res.json(diagnostics);
  } catch (error) {
    next(error);
  }
});

// Run health checks
router.post('/health-check', async (req, res, next) => {
  try {
    const healthChecks = await redisMonitoring.runHealthChecks();
    
    const statusCode = healthChecks.overall === 'pass' ? 200 : 503;
    res.status(statusCode).json(healthChecks);
  } catch (error) {
    next(error);
  }
});

// Get Redis info
router.get('/redis/info', async (req, res, next) => {
  try {
    // const info = await redisConnection.getRedisInfo();
    // const connectionHealth = await redisConnection.getConnectionHealth();
    const info = { Server: { redis_version: 'Redis disabled in development mode' } };
    const connectionHealth = { status: 'unhealthy', connections: {}, metrics: {} };
    
    res.json({
      info,
      connectionHealth,
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
});

export default router;