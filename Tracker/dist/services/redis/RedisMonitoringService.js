"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisMonitoring = exports.RedisMonitoringService = void 0;
const RedisConnectionService_1 = require("./RedisConnectionService");
const TaxRateCacheService_1 = require("./TaxRateCacheService");
const JobQueueService_1 = require("./JobQueueService");
const SessionService_1 = require("./SessionService");
const utils_1 = require("@/utils");
class RedisMonitoringService {
    constructor() {
        this.performanceHistory = [];
        this.alertHistory = [];
        this.monitoringInterval = null;
        this.redisConnection = RedisConnectionService_1.RedisConnectionService.getInstance();
        this.cacheService = new TaxRateCacheService_1.TaxRateCacheService();
        this.jobQueue = JobQueueService_1.JobQueueService.getInstance();
        this.sessionService = SessionService_1.SessionService.getInstance();
        this.startMonitoring();
    }
    static getInstance() {
        if (!RedisMonitoringService.instance) {
            RedisMonitoringService.instance = new RedisMonitoringService();
        }
        return RedisMonitoringService.instance;
    }
    async getSystemHealth() {
        const timestamp = new Date();
        const alerts = [];
        try {
            const redisHealth = await this.redisConnection.getConnectionHealth();
            const cacheStats = await this.cacheService.getCacheStats();
            const cacheSize = await this.cacheService.getCacheSize();
            const queueHealth = await this.jobQueue.healthCheck();
            const queueMetrics = await this.jobQueue.getAllQueueMetrics();
            const totalFailedJobs = Object.values(queueMetrics)
                .reduce((sum, metrics) => sum + metrics.failed, 0);
            const sessionMetrics = await this.sessionService.getSessionMetrics();
            const redisStatus = redisHealth.status;
            if (redisStatus !== 'healthy') {
                alerts.push({
                    severity: redisStatus === 'unhealthy' ? 'critical' : 'warning',
                    component: 'redis',
                    message: `Redis connection ${redisStatus}`,
                    timestamp
                });
            }
            const cacheStatus = this.determineCacheStatus(cacheStats, cacheSize);
            if (cacheStatus !== 'healthy') {
                alerts.push({
                    severity: 'warning',
                    component: 'cache',
                    message: `Cache performance ${cacheStatus}`,
                    timestamp
                });
            }
            const queueStatus = queueHealth.status;
            if (queueStatus !== 'healthy' || totalFailedJobs > 10) {
                alerts.push({
                    severity: totalFailedJobs > 50 ? 'error' : 'warning',
                    component: 'queues',
                    message: `${totalFailedJobs} failed jobs detected`,
                    timestamp
                });
            }
            const sessionStatus = this.determineSessionStatus(sessionMetrics);
            if (sessionStatus !== 'healthy') {
                alerts.push({
                    severity: 'warning',
                    component: 'sessions',
                    message: 'Session management issues detected',
                    timestamp
                });
            }
            const componentStatuses = [redisStatus, cacheStatus, queueStatus, sessionStatus];
            let overallStatus = 'healthy';
            if (componentStatuses.includes('unhealthy')) {
                overallStatus = 'unhealthy';
            }
            else if (componentStatuses.includes('degraded')) {
                overallStatus = 'degraded';
            }
            return {
                status: overallStatus,
                timestamp,
                components: {
                    redis: {
                        status: redisStatus,
                        connections: redisHealth.connections,
                        metrics: redisHealth.metrics,
                        latency: redisHealth.latency
                    },
                    cache: {
                        status: cacheStatus,
                        hitRate: cacheStats.hitRate,
                        size: cacheSize,
                        metrics: cacheStats
                    },
                    queues: {
                        status: queueStatus,
                        metrics: queueMetrics,
                        failedJobs: totalFailedJobs
                    },
                    sessions: {
                        status: sessionStatus,
                        metrics: sessionMetrics
                    }
                },
                alerts
            };
        }
        catch (error) {
            utils_1.logger.error('Error getting system health:', error);
            return {
                status: 'unhealthy',
                timestamp,
                components: {
                    redis: { status: 'unhealthy', connections: {}, metrics: {} },
                    cache: { status: 'unhealthy', hitRate: 0, size: {}, metrics: {} },
                    queues: { status: 'unhealthy', metrics: {}, failedJobs: 0 },
                    sessions: { status: 'unhealthy', metrics: {} }
                },
                alerts: [{
                        severity: 'critical',
                        component: 'monitoring',
                        message: 'Health check failed',
                        timestamp
                    }]
            };
        }
    }
    determineCacheStatus(stats, size) {
        if (stats.hitRate < 50)
            return 'degraded';
        if (stats.errors > stats.hits * 0.1)
            return 'degraded';
        if (size.taxRateKeys > 10000)
            return 'degraded';
        return 'healthy';
    }
    determineSessionStatus(metrics) {
        if (metrics.activeSessions > 1000)
            return 'degraded';
        if (metrics.expiredSessions > metrics.activeSessions * 2)
            return 'degraded';
        return 'healthy';
    }
    async getPerformanceMetrics() {
        try {
            const redisInfo = await this.redisConnection.getRedisInfo();
            const client = await this.redisConnection.getClient();
            const redisStats = redisInfo.Stats || {};
            const redisMemory = redisInfo.Memory || {};
            const startTime = Date.now();
            await client.ping();
            const latency = Date.now() - startTime;
            const cacheStats = await this.cacheService.getCacheStats();
            const queueMetrics = await this.jobQueue.getAllQueueMetrics();
            const totalProcessed = Object.values(queueMetrics)
                .reduce((sum, metrics) => sum + metrics.processed, 0);
            const totalFailed = Object.values(queueMetrics)
                .reduce((sum, metrics) => sum + metrics.failed, 0);
            return {
                redis: {
                    latency: {
                        current: latency,
                        average: this.calculateAverageLatency(),
                        p95: this.calculatePercentileLatency(95),
                        p99: this.calculatePercentileLatency(99)
                    },
                    throughput: {
                        commandsPerSecond: parseInt(redisStats.instantaneous_ops_per_sec) || 0,
                        connectionsPerSecond: parseInt(redisStats.total_connections_received) || 0
                    },
                    memory: {
                        used: redisMemory.used_memory_human || '0B',
                        peak: redisMemory.used_memory_peak_human || '0B',
                        fragmentation: parseFloat(redisMemory.mem_fragmentation_ratio) || 1.0
                    }
                },
                cache: {
                    hitRate: cacheStats.hitRate,
                    missRate: 100 - cacheStats.hitRate,
                    evictions: parseInt(redisStats.evicted_keys) || 0,
                    keyspaceHits: parseInt(redisStats.keyspace_hits) || 0,
                    keyspaceMisses: parseInt(redisStats.keyspace_misses) || 0
                },
                queues: {
                    totalProcessed,
                    averageProcessingTime: this.calculateAverageProcessingTime(),
                    failureRate: totalProcessed > 0 ? (totalFailed / totalProcessed) * 100 : 0,
                    backlogSize: Object.values(queueMetrics)
                        .reduce((sum, metrics) => sum + metrics.waiting, 0)
                }
            };
        }
        catch (error) {
            utils_1.logger.error('Error getting performance metrics:', error);
            throw error;
        }
    }
    calculateAverageLatency() {
        if (this.performanceHistory.length === 0)
            return 0;
        const latencies = this.performanceHistory
            .slice(-100)
            .map(entry => entry.metrics.latency)
            .filter(l => l !== undefined);
        return latencies.length > 0
            ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length
            : 0;
    }
    calculatePercentileLatency(percentile) {
        if (this.performanceHistory.length === 0)
            return 0;
        const latencies = this.performanceHistory
            .slice(-100)
            .map(entry => entry.metrics.latency)
            .filter(l => l !== undefined)
            .sort((a, b) => a - b);
        if (latencies.length === 0)
            return 0;
        const index = Math.ceil((percentile / 100) * latencies.length) - 1;
        return latencies[Math.max(0, index)];
    }
    calculateAverageProcessingTime() {
        return 150;
    }
    async collectDiagnostics() {
        try {
            const [redisInfo, cacheStats, queueMetrics] = await Promise.all([
                this.redisConnection.getRedisInfo(),
                this.cacheService.getCacheStats(),
                this.jobQueue.getAllQueueMetrics()
            ]);
            const client = await this.redisConnection.getClient();
            const redisConfig = await client.config('GET', '*');
            return {
                redis: {
                    info: redisInfo,
                    config: redisConfig,
                    memory: redisInfo.Memory,
                    stats: redisInfo.Stats,
                    clients: redisInfo.Clients
                },
                cache: {
                    stats: cacheStats,
                    size: await this.cacheService.getCacheSize(),
                    expiringSoon: await this.cacheService.getExpiringSoon()
                },
                queues: {
                    metrics: queueMetrics,
                    availableQueues: this.jobQueue.getAvailableQueues()
                },
                system: {
                    nodeVersion: process.version,
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage(),
                    timestamp: new Date()
                }
            };
        }
        catch (error) {
            utils_1.logger.error('Error collecting diagnostics:', error);
            throw error;
        }
    }
    async runHealthChecks() {
        const checks = [];
        let overallStatus = 'pass';
        const redisCheck = await this.runSingleHealthCheck('Redis Connectivity', () => this.redisConnection.testConnection());
        checks.push(redisCheck);
        if (redisCheck.status === 'fail')
            overallStatus = 'fail';
        const cacheCheck = await this.runSingleHealthCheck('Cache Functionality', () => this.testCacheFunctionality());
        checks.push(cacheCheck);
        if (cacheCheck.status === 'fail')
            overallStatus = 'fail';
        const queueCheck = await this.runSingleHealthCheck('Queue System', () => this.testQueueFunctionality());
        checks.push(queueCheck);
        if (queueCheck.status === 'fail')
            overallStatus = 'fail';
        const performanceCheck = await this.runSingleHealthCheck('Performance', () => this.testPerformance());
        checks.push(performanceCheck);
        if (performanceCheck.status === 'fail')
            overallStatus = 'fail';
        return { overall: overallStatus, checks };
    }
    async runSingleHealthCheck(name, testFunction) {
        const startTime = Date.now();
        try {
            const result = await testFunction();
            const duration = Date.now() - startTime;
            return {
                name,
                status: result ? 'pass' : 'fail',
                duration,
                message: result ? undefined : 'Test failed'
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            return {
                name,
                status: 'fail',
                duration,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async testCacheFunctionality() {
        try {
            const client = await this.redisConnection.getClient();
            const testKey = 'health-check:cache-test';
            const testValue = { test: true, timestamp: Date.now() };
            await client.setex(testKey, 10, JSON.stringify(testValue));
            const retrieved = await client.get(testKey);
            const parsed = retrieved ? JSON.parse(retrieved) : null;
            await client.del(testKey);
            return parsed && parsed.test === true;
        }
        catch (error) {
            utils_1.logger.error('Cache functionality test failed:', error);
            return false;
        }
    }
    async testQueueFunctionality() {
        try {
            const metrics = await this.jobQueue.getAllQueueMetrics();
            return Object.keys(metrics).length > 0;
        }
        catch (error) {
            utils_1.logger.error('Queue functionality test failed:', error);
            return false;
        }
    }
    async testPerformance() {
        try {
            const client = await this.redisConnection.getClient();
            const startTime = Date.now();
            await Promise.all([
                client.set('perf-test-1', 'value1'),
                client.set('perf-test-2', 'value2'),
                client.set('perf-test-3', 'value3')
            ]);
            await Promise.all([
                client.get('perf-test-1'),
                client.get('perf-test-2'),
                client.get('perf-test-3')
            ]);
            await Promise.all([
                client.del('perf-test-1'),
                client.del('perf-test-2'),
                client.del('perf-test-3')
            ]);
            const duration = Date.now() - startTime;
            return duration < 100;
        }
        catch (error) {
            utils_1.logger.error('Performance test failed:', error);
            return false;
        }
    }
    async generateReport() {
        try {
            const health = await this.getSystemHealth();
            const performance = await this.getPerformanceMetrics();
            const recommendations = this.generateRecommendations(health, performance);
            return {
                summary: {
                    status: health.status,
                    uptime: process.uptime(),
                    lastCheck: health.timestamp
                },
                performance,
                alerts: health.alerts,
                recommendations
            };
        }
        catch (error) {
            utils_1.logger.error('Error generating monitoring report:', error);
            throw error;
        }
    }
    generateRecommendations(health, performance) {
        const recommendations = [];
        if (performance.cache.hitRate < 70) {
            recommendations.push('Consider cache warmup strategy - hit rate is below 70%');
        }
        if (performance.redis.memory.fragmentation > 1.5) {
            recommendations.push('Redis memory fragmentation is high - consider running MEMORY DOCTOR');
        }
        if (performance.queues.failureRate > 5) {
            recommendations.push('High job failure rate detected - review error logs and retry policies');
        }
        if (performance.redis.latency.p95 > 10) {
            recommendations.push('Redis latency is high - check network connectivity and server load');
        }
        if (health.components.queues.failedJobs > 50) {
            recommendations.push('High number of failed jobs - consider increasing worker capacity');
        }
        return recommendations;
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(async () => {
            try {
                const metrics = await this.getPerformanceMetrics();
                this.performanceHistory.push({
                    timestamp: new Date(),
                    metrics
                });
                if (this.performanceHistory.length > 288) {
                    this.performanceHistory = this.performanceHistory.slice(-288);
                }
                const health = await this.getSystemHealth();
                if (health.alerts.length > 0) {
                    this.alertHistory.push({
                        timestamp: new Date(),
                        alert: health.alerts
                    });
                    if (this.alertHistory.length > 100) {
                        this.alertHistory = this.alertHistory.slice(-100);
                    }
                }
            }
            catch (error) {
                utils_1.logger.error('Error during monitoring cycle:', error);
            }
        }, 5 * 60 * 1000);
    }
    async optimizeRedis() {
        const optimizations = [];
        const beforeMetrics = await this.getPerformanceMetrics();
        try {
            const client = await this.redisConnection.getClient();
            const expiredKeys = await this.cacheService.getExpiringSoon(0);
            if (expiredKeys.length > 0) {
                for (const key of expiredKeys) {
                    await client.del(key);
                }
                optimizations.push(`Cleaned up ${expiredKeys.length} expired keys`);
            }
            const refreshed = await this.cacheService.refreshExpiringSoon();
            if (refreshed > 0) {
                optimizations.push(`Refreshed ${refreshed} expiring cache entries`);
            }
            for (const queueName of this.jobQueue.getAvailableQueues()) {
                await this.jobQueue.cleanOldJobs(queueName);
            }
            optimizations.push('Cleaned old jobs from all queues');
            const afterMetrics = await this.getPerformanceMetrics();
            return {
                optimizations,
                before: beforeMetrics,
                after: afterMetrics
            };
        }
        catch (error) {
            utils_1.logger.error('Error during Redis optimization:', error);
            throw error;
        }
    }
    getAlertHistory(limit = 10) {
        return this.alertHistory
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }
    getPerformanceHistory(hours = 24) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.performanceHistory
            .filter(entry => entry.timestamp >= cutoff)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    async shutdown() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        utils_1.logger.info('Redis monitoring service shutdown completed');
    }
}
exports.RedisMonitoringService = RedisMonitoringService;
exports.redisMonitoring = RedisMonitoringService.getInstance();
//# sourceMappingURL=RedisMonitoringService.js.map