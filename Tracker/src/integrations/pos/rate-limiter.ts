/**
 * Rate Limiting System
 * Manages API request rates across different POS systems with adaptive backoff
 */

import { redis } from '@/lib/redis';
import {
  POSSystemType,
  RateLimit,
  RetryConfig,
  POSIntegrationError
} from './types';

interface RequestMetrics {
  count: number;
  resetTime: number;
  retryAfter?: number;
  consecutiveErrors: number;
  lastErrorTime?: number;
}

interface QueuedRequest {
  id: string;
  posType: POSSystemType;
  priority: number;
  createdAt: number;
  retryCount: number;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export class RateLimitManager {
  private static instance: RateLimitManager;
  private requestQueues: Map<POSSystemType, QueuedRequest[]> = new Map();
  private processingQueues: Set<POSSystemType> = new Set();
  private metrics: Map<string, RequestMetrics> = new Map();

  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    backoff: 'exponential',
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ['RATE_LIMITED', 'TIMEOUT', 'CONNECTION_ERROR']
  };

  private static readonly RATE_LIMITS: Record<POSSystemType, RateLimit> = {
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

  private constructor() {
    // Initialize queues for all POS types
    Object.keys(this.RATE_LIMITS).forEach(posType => {
      this.requestQueues.set(posType as POSSystemType, []);
    });

    // Start queue processors
    this.startQueueProcessors();
  }

  public static getInstance(): RateLimitManager {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager();
    }
    return RateLimitManager.instance;
  }

  /**
   * Execute a request with rate limiting and retry logic
   */
  public async executeRequest<T>(
    posType: POSSystemType,
    requestFn: () => Promise<T>,
    priority: number = 0,
    retryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.DEFAULT_RETRY_CONFIG, ...retryConfig };
    
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
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

  /**
   * Check if we can make a request now
   */
  public async canMakeRequest(
    posType: POSSystemType,
    businessId?: string
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    const limits = this.RATE_LIMITS[posType];
    const key = this.getMetricsKey(posType, businessId);
    const now = Date.now();

    // Get current metrics
    const metrics = await this.getMetrics(key);

    // Check different rate limit windows
    const checks = [
      { window: 1000, limit: limits.requestsPerSecond },
      { window: 60000, limit: limits.requestsPerMinute },
      { window: 3600000, limit: limits.requestsPerHour }
    ];

    for (const check of checks) {
      if (!check.limit) continue;

      if (metrics.count >= check.limit && now < metrics.resetTime) {
        const retryAfter = metrics.resetTime - now;
        return { allowed: false, retryAfter };
      }
    }

    // Check if we're in an error backoff period
    if (metrics.consecutiveErrors > 0 && metrics.lastErrorTime) {
      const backoffTime = this.calculateBackoffTime(metrics.consecutiveErrors);
      const timeSinceError = now - metrics.lastErrorTime;
      
      if (timeSinceError < backoffTime) {
        return { allowed: false, retryAfter: backoffTime - timeSinceError };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a successful request
   */
  public async recordSuccess(posType: POSSystemType, businessId?: string): Promise<void> {
    const key = this.getMetricsKey(posType, businessId);
    const metrics = await this.getMetrics(key);
    
    // Reset consecutive errors on success
    metrics.consecutiveErrors = 0;
    metrics.lastErrorTime = undefined;
    
    await this.updateMetrics(key, metrics);
  }

  /**
   * Record a failed request
   */
  public async recordFailure(
    posType: POSSystemType,
    error: POSIntegrationError,
    businessId?: string
  ): Promise<void> {
    const key = this.getMetricsKey(posType, businessId);
    const metrics = await this.getMetrics(key);
    
    metrics.consecutiveErrors++;
    metrics.lastErrorTime = Date.now();

    // Handle rate limit specific errors
    if (error.code === 'RATE_LIMITED' || error.statusCode === 429) {
      // Extract retry-after header if available
      const retryAfter = this.extractRetryAfter(error);
      if (retryAfter) {
        metrics.retryAfter = Date.now() + (retryAfter * 1000);
      }
    }
    
    await this.updateMetrics(key, metrics);
  }

  /**
   * Get current rate limit status
   */
  public async getRateLimitStatus(
    posType: POSSystemType,
    businessId?: string
  ): Promise<{
    remaining: number;
    resetTime: number;
    retryAfter?: number;
    consecutiveErrors: number;
  }> {
    const limits = this.RATE_LIMITS[posType];
    const key = this.getMetricsKey(posType, businessId);
    const metrics = await this.getMetrics(key);

    // Calculate remaining requests (using the most restrictive limit)
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

  /**
   * Start processing queues for all POS types
   */
  private startQueueProcessors(): void {
    Object.keys(this.RATE_LIMITS).forEach(posType => {
      this.processQueue(posType as POSSystemType);
    });
  }

  /**
   * Process requests in the queue for a specific POS type
   */
  private async processQueue(posType: POSSystemType): Promise<void> {
    if (this.processingQueues.has(posType)) {
      return; // Already processing this queue
    }

    this.processingQueues.add(posType);

    try {
      while (true) {
        const queue = this.requestQueues.get(posType) || [];
        
        if (queue.length === 0) {
          await this.sleep(100); // Wait 100ms before checking again
          continue;
        }

        // Sort queue by priority and creation time
        queue.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority; // Higher priority first
          }
          return a.createdAt - b.createdAt; // Older first
        });

        const request = queue[0];
        
        // Check if we can make this request
        const { allowed, retryAfter } = await this.canMakeRequest(posType);
        
        if (!allowed) {
          if (retryAfter) {
            await this.sleep(Math.min(retryAfter, 5000)); // Wait up to 5 seconds
          } else {
            await this.sleep(1000); // Default wait
          }
          continue;
        }

        // Remove request from queue
        queue.shift();

        // Execute the request
        try {
          await this.incrementRequestCount(posType);
          const result = await request.execute();
          await this.recordSuccess(posType);
          request.resolve(result);
        } catch (error) {
          const posError = this.wrapError(error, posType);
          await this.recordFailure(posType, posError);
          
          // Check if we should retry
          if (this.shouldRetry(posError, request, this.DEFAULT_RETRY_CONFIG)) {
            request.retryCount++;
            const delay = this.calculateRetryDelay(request.retryCount, this.DEFAULT_RETRY_CONFIG);
            
            // Re-add to queue after delay
            setTimeout(() => {
              queue.push(request);
            }, delay);
          } else {
            request.reject(posError);
          }
        }

        // Add small delay between requests
        const limits = this.RATE_LIMITS[posType];
        const delayBetweenRequests = 1000 / limits.requestsPerSecond;
        await this.sleep(delayBetweenRequests);
      }
    } finally {
      this.processingQueues.delete(posType);
      // Restart processor after a short delay
      setTimeout(() => this.processQueue(posType), 1000);
    }
  }

  /**
   * Add request to queue
   */
  private enqueueRequest(request: QueuedRequest): void {
    const queue = this.requestQueues.get(request.posType);
    if (queue) {
      queue.push(request);
    }
  }

  /**
   * Increment request count and update metrics
   */
  private async incrementRequestCount(posType: POSSystemType, businessId?: string): Promise<void> {
    const key = this.getMetricsKey(posType, businessId);
    const now = Date.now();
    const limits = this.RATE_LIMITS[posType];

    // Use Redis for distributed rate limiting
    const pipeline = redis.pipeline();
    
    // Increment counters for different windows
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

  /**
   * Get metrics for a specific key
   */
  private async getMetrics(key: string): Promise<RequestMetrics> {
    try {
      const data = await redis.get(`${key}:metrics`);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to get metrics:', error);
    }

    return {
      count: 0,
      resetTime: Date.now() + 1000,
      consecutiveErrors: 0
    };
  }

  /**
   * Update metrics for a specific key
   */
  private async updateMetrics(key: string, metrics: RequestMetrics): Promise<void> {
    try {
      await redis.setex(`${key}:metrics`, 3600, JSON.stringify(metrics));
    } catch (error) {
      console.error('Failed to update metrics:', error);
    }
  }

  /**
   * Generate metrics key
   */
  private getMetricsKey(posType: POSSystemType, businessId?: string): string {
    return businessId ? `rate_limit:${posType}:${businessId}` : `rate_limit:${posType}:global`;
  }

  /**
   * Calculate backoff time based on consecutive errors
   */
  private calculateBackoffTime(consecutiveErrors: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    
    const delay = Math.min(baseDelay * Math.pow(2, consecutiveErrors - 1), maxDelay);
    return delay;
  }

  /**
   * Calculate retry delay
   */
  private calculateRetryDelay(retryCount: number, config: RetryConfig): number {
    if (config.backoff === 'linear') {
      return Math.min(config.baseDelayMs * retryCount, config.maxDelayMs);
    } else {
      const exponentialDelay = config.baseDelayMs * Math.pow(2, retryCount - 1);
      return Math.min(exponentialDelay, config.maxDelayMs);
    }
  }

  /**
   * Check if we should retry a failed request
   */
  private shouldRetry(error: POSIntegrationError, request: QueuedRequest, config: RetryConfig): boolean {
    if (request.retryCount >= config.maxAttempts) {
      return false;
    }

    if (!error.retryable) {
      return false;
    }

    return config.retryableErrors?.includes(error.code) || false;
  }

  /**
   * Wrap generic error as POSIntegrationError
   */
  private wrapError(error: any, posType: POSSystemType): POSIntegrationError {
    if (error instanceof POSIntegrationError) {
      return error;
    }

    let code = 'UNKNOWN_ERROR';
    let retryable = false;
    let statusCode: number | undefined;

    if (error.response) {
      statusCode = error.response.status;
      
      if (statusCode === 429) {
        code = 'RATE_LIMITED';
        retryable = true;
      } else if (statusCode >= 500) {
        code = 'SERVER_ERROR';
        retryable = true;
      } else if (statusCode === 401 || statusCode === 403) {
        code = 'AUTH_ERROR';
        retryable = false;
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      code = 'CONNECTION_ERROR';
      retryable = true;
    }

    return new POSIntegrationError(
      error.message || 'Unknown error occurred',
      code,
      posType,
      statusCode,
      retryable,
      { originalError: error }
    );
  }

  /**
   * Extract retry-after header from error
   */
  private extractRetryAfter(error: POSIntegrationError): number | undefined {
    if (error.details?.originalError?.response?.headers) {
      const retryAfter = error.details.originalError.response.headers['retry-after'];
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        return isNaN(seconds) ? undefined : seconds;
      }
    }
    return undefined;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status for monitoring
   */
  public getQueueStatus(): Record<POSSystemType, { queueLength: number; processing: boolean }> {
    const status = {} as Record<POSSystemType, { queueLength: number; processing: boolean }>;
    
    for (const [posType, queue] of this.requestQueues.entries()) {
      status[posType] = {
        queueLength: queue.length,
        processing: this.processingQueues.has(posType)
      };
    }
    
    return status;
  }

  /**
   * Clear all queues (for testing/debugging)
   */
  public clearAllQueues(): void {
    for (const queue of this.requestQueues.values()) {
      queue.length = 0;
    }
  }
}
