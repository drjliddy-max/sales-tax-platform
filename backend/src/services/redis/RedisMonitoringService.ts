import { RedisConnectionService } from './RedisConnectionService';
import { TaxRateCacheService } from './TaxRateCacheService';
import { JobQueueService } from './JobQueueService';
import { SessionService } from './SessionService';
import { logger } from '@/utils';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  components: {
    redis: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      connections: any;
      metrics: any;
      latency?: number;
    };
    cache: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      hitRate: number;
      size: any;
      metrics: any;
    };
    queues: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      metrics: any;
      failedJobs: number;
    };
    sessions: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      metrics: any;
    };
  };
  alerts: Array<{
    severity: 'warning' | 'error' | 'critical';
    component: string;
    message: string;
    timestamp: Date;
  }>;
}

interface PerformanceMetrics {
  redis: {
    latency: {
      current: number;
      average: number;
      p95: number;
      p99: number;
    };
    throughput: {
      commandsPerSecond: number;
      connectionsPerSecond: number;
    };
    memory: {
      used: string;
      peak: string;
      fragmentation: number;
    };
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
    keyspaceHits: number;
    keyspaceMisses: number;
  };
  queues: {
    totalProcessed: number;
    averageProcessingTime: number;
    failureRate: number;
    backlogSize: number;
  };
}

export class RedisMonitoringService {
  private static instance: RedisMonitoringService;
  private redisConnection: RedisConnectionService;
  private cacheService: TaxRateCacheService;
  private jobQueue: JobQueueService;
  private sessionService: SessionService;
  private performanceHistory: Array<{ timestamp: Date; metrics: any }> = [];
  private alertHistory: Array<{ timestamp: Date; alert: any }> = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.redisConnection = RedisConnectionService.getInstance();
    this.cacheService = new TaxRateCacheService();
    this.jobQueue = JobQueueService.getInstance();
    this.sessionService = SessionService.getInstance();
    this.startMonitoring();
  }

  public static getInstance(): RedisMonitoringService {
    if (!RedisMonitoringService.instance) {
      RedisMonitoringService.instance = new RedisMonitoringService();
    }
    return RedisMonitoringService.instance;
  }

  public async getSystemHealth(): Promise<SystemHealth> {
    const timestamp = new Date();
    const alerts: SystemHealth['alerts'] = [];

    try {
      // Check Redis health
      const redisHealth = await this.redisConnection.getConnectionHealth();
      
      // Check cache health
      const cacheStats = await this.cacheService.getCacheStats();
      const cacheSize = await this.cacheService.getCacheSize();
      
      // Check queue health
      const queueHealth = await this.jobQueue.healthCheck();
      const queueMetrics = await this.jobQueue.getAllQueueMetrics();
      const totalFailedJobs = Object.values(queueMetrics)
        .reduce((sum, metrics) => sum + metrics.failed, 0);
      
      // Check session health
      const sessionMetrics = await this.sessionService.getSessionMetrics();

      // Determine component statuses and generate alerts
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

      // Determine overall system status
      const componentStatuses = [redisStatus, cacheStatus, queueStatus, sessionStatus];
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (componentStatuses.includes('unhealthy')) {
        overallStatus = 'unhealthy';
      } else if (componentStatuses.includes('degraded')) {
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

    } catch (error) {
      logger.error('Error getting system health:', error);
      
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

  private determineCacheStatus(stats: any, size: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (stats.hitRate < 50) return 'degraded';
    if (stats.errors > stats.hits * 0.1) return 'degraded';
    if (size.taxRateKeys > 10000) return 'degraded'; // Too many cached keys
    return 'healthy';
  }

  private determineSessionStatus(metrics: any): 'healthy' | 'degraded' | 'unhealthy' {
    if (metrics.activeSessions > 1000) return 'degraded'; // High session count
    if (metrics.expiredSessions > metrics.activeSessions * 2) return 'degraded';
    return 'healthy';
  }

  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const redisInfo = await this.redisConnection.getRedisInfo();
      const client = await this.redisConnection.getClient();
      
      // Redis performance metrics
      const redisStats = redisInfo.Stats || {};
      const redisMemory = redisInfo.Memory || {};
      
      // Measure latency
      const startTime = Date.now();
      await client.ping();
      const latency = Date.now() - startTime;
      
      // Cache metrics
      const cacheStats = await this.cacheService.getCacheStats();
      
      // Queue metrics
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
      
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      throw error;
    }
  }

  private calculateAverageLatency(): number {
    if (this.performanceHistory.length === 0) return 0;
    
    const latencies = this.performanceHistory
      .slice(-100) // Last 100 measurements
      .map(entry => entry.metrics.latency)
      .filter(l => l !== undefined);
    
    return latencies.length > 0 
      ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length 
      : 0;
  }

  private calculatePercentileLatency(percentile: number): number {
    if (this.performanceHistory.length === 0) return 0;
    
    const latencies = this.performanceHistory
      .slice(-100)
      .map(entry => entry.metrics.latency)
      .filter(l => l !== undefined)
      .sort((a, b) => a - b);
    
    if (latencies.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * latencies.length) - 1;
    return latencies[Math.max(0, index)];
  }

  private calculateAverageProcessingTime(): number {
    // This would be calculated from job completion times
    // For now, return a placeholder
    return 150; // ms
  }

  public async collectDiagnostics(): Promise<{
    redis: any;
    cache: any;
    queues: any;
    system: any;
  }> {
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
      
    } catch (error) {
      logger.error('Error collecting diagnostics:', error);
      throw error;
    }
  }

  public async runHealthChecks(): Promise<{
    overall: 'pass' | 'fail';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      duration: number;
      message?: string;
    }>;
  }> {
    const checks = [];
    let overallStatus: 'pass' | 'fail' = 'pass';

    // Redis connectivity check
    const redisCheck = await this.runSingleHealthCheck(
      'Redis Connectivity',
      () => this.redisConnection.testConnection()
    );
    checks.push(redisCheck);
    if (redisCheck.status === 'fail') overallStatus = 'fail';

    // Cache functionality check
    const cacheCheck = await this.runSingleHealthCheck(
      'Cache Functionality',
      () => this.testCacheFunctionality()
    );
    checks.push(cacheCheck);
    if (cacheCheck.status === 'fail') overallStatus = 'fail';

    // Queue functionality check
    const queueCheck = await this.runSingleHealthCheck(
      'Queue System',
      () => this.testQueueFunctionality()
    );
    checks.push(queueCheck);
    if (queueCheck.status === 'fail') overallStatus = 'fail';

    // Performance check
    const performanceCheck = await this.runSingleHealthCheck(
      'Performance',
      () => this.testPerformance()
    );
    checks.push(performanceCheck);
    if (performanceCheck.status === 'fail') overallStatus = 'fail';

    return { overall: overallStatus, checks };
  }

  private async runSingleHealthCheck(
    name: string, 
    testFunction: () => Promise<boolean>
  ): Promise<{ name: string; status: 'pass' | 'fail'; duration: number; message?: string }> {
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
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        name,
        status: 'fail',
        duration,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testCacheFunctionality(): Promise<boolean> {
    try {
      const client = await this.redisConnection.getClient();
      const testKey = 'health-check:cache-test';
      const testValue = { test: true, timestamp: Date.now() };
      
      // Test write
      await client.setex(testKey, 10, JSON.stringify(testValue));
      
      // Test read
      const retrieved = await client.get(testKey);
      const parsed = retrieved ? JSON.parse(retrieved) : null;
      
      // Test delete
      await client.del(testKey);
      
      return parsed && parsed.test === true;
    } catch (error) {
      logger.error('Cache functionality test failed:', error);
      return false;
    }
  }

  private async testQueueFunctionality(): Promise<boolean> {
    try {
      // Test if we can get queue metrics without errors
      const metrics = await this.jobQueue.getAllQueueMetrics();
      return Object.keys(metrics).length > 0;
    } catch (error) {
      logger.error('Queue functionality test failed:', error);
      return false;
    }
  }

  private async testPerformance(): Promise<boolean> {
    try {
      const client = await this.redisConnection.getClient();
      
      // Test multiple operations for performance
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
      
      // Performance is considered healthy if operations complete in under 100ms
      return duration < 100;
      
    } catch (error) {
      logger.error('Performance test failed:', error);
      return false;
    }
  }

  public async generateReport(): Promise<{
    summary: {
      status: string;
      uptime: number;
      lastCheck: Date;
    };
    performance: PerformanceMetrics;
    alerts: any[];
    recommendations: string[];
  }> {
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
      
    } catch (error) {
      logger.error('Error generating monitoring report:', error);
      throw error;
    }
  }

  private generateRecommendations(health: SystemHealth, performance: PerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
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

  private startMonitoring(): void {
    // Collect metrics every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getPerformanceMetrics();
        this.performanceHistory.push({
          timestamp: new Date(),
          metrics
        });
        
        // Keep only last 288 entries (24 hours worth at 5-minute intervals)
        if (this.performanceHistory.length > 288) {
          this.performanceHistory = this.performanceHistory.slice(-288);
        }
        
        // Check for alerts
        const health = await this.getSystemHealth();
        if (health.alerts.length > 0) {
          this.alertHistory.push({
            timestamp: new Date(),
            alert: health.alerts
          });
          
          // Keep only last 100 alert entries
          if (this.alertHistory.length > 100) {
            this.alertHistory = this.alertHistory.slice(-100);
          }
        }
        
      } catch (error) {
        logger.error('Error during monitoring cycle:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  public async optimizeRedis(): Promise<{
    optimizations: string[];
    before: any;
    after: any;
  }> {
    const optimizations: string[] = [];
    const beforeMetrics = await this.getPerformanceMetrics();
    
    try {
      const client = await this.redisConnection.getClient();
      
      // Clean up expired keys
      const expiredKeys = await this.cacheService.getExpiringSoon(0); // Already expired
      if (expiredKeys.length > 0) {
        for (const key of expiredKeys) {
          await client.del(key);
        }
        optimizations.push(`Cleaned up ${expiredKeys.length} expired keys`);
      }
      
      // Refresh expiring cache entries
      const refreshed = await this.cacheService.refreshExpiringSoon();
      if (refreshed > 0) {
        optimizations.push(`Refreshed ${refreshed} expiring cache entries`);
      }
      
      // Clean old jobs
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
      
    } catch (error) {
      logger.error('Error during Redis optimization:', error);
      throw error;
    }
  }

  public getAlertHistory(limit: number = 10): any[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  public getPerformanceHistory(hours: number = 24): any[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.performanceHistory
      .filter(entry => entry.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    logger.info('Redis monitoring service shutdown completed');
  }
}

// Export singleton instance
export const redisMonitoring = RedisMonitoringService.getInstance();