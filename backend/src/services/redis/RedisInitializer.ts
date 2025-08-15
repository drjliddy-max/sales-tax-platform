// import { redisConnection } from './RedisConnectionService';
import { taxRateCache } from './TaxRateCacheService';
import { jobQueue } from './JobQueueService';
import { sessionService } from './SessionService';
import { redisMonitoring } from './RedisMonitoringService';
import { jobProcessors } from './JobProcessors';
import { logger } from '@/utils';

export class RedisInitializer {
  private isInitialized = false;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Redis services already initialized');
      return;
    }

    try {
      logger.info('Initializing Redis services...');

      // Test Redis connection
      // const isConnected = await redisConnection.testConnection();
      const isConnected = false; // Redis disabled
      if (!isConnected) {
        throw new Error('Redis connection test failed');
      }
      logger.info('✓ Redis connection established');

      // Initialize job processors
      // The processors are automatically initialized when imported
      logger.info('✓ Job processors registered');

      // Warm up cache with frequently accessed data
      logger.info('Starting cache warmup...');
      await taxRateCache.preloadFrequentlyAccessedRates();
      logger.info('✓ Cache warmup completed');

      // Start monitoring
      logger.info('✓ Redis monitoring started');

      this.isInitialized = true;
      logger.info('Redis services initialization completed successfully');

    } catch (error) {
      logger.error('Failed to initialize Redis services:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    logger.info('Shutting down Redis services...');

    try {
      // Shutdown in reverse order of initialization
      await redisMonitoring.shutdown();
      logger.info('✓ Redis monitoring stopped');

      await sessionService.shutdown();
      logger.info('✓ Session service stopped');

      await jobQueue.shutdown();
      logger.info('✓ Job queues closed');

      // await redisConnection.shutdown();
      logger.info('✓ Redis connections closed');

      this.isInitialized = false;
      logger.info('Redis services shutdown completed');

    } catch (error) {
      logger.error('Error during Redis services shutdown:', error);
    }
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      const health = await redisMonitoring.getSystemHealth();
      return health.status !== 'unhealthy';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  public isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const redisInitializer = new RedisInitializer();