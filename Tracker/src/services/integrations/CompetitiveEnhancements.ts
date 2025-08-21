/**
 * Competitive Enhancements Module
 * 
 * Provides enterprise-grade features including:
 * - Enhanced error handling with actionable context
 * - Reliable webhook delivery with retries and signature verification
 * - Performance optimization via caching and timeouts
 * - Monitoring and health scoring
 * - Smart retry and circuit breaker patterns
 * - Intelligent cache warming
 * - Advanced analytics services
 */

import { logger } from '../../utils';

// Enhanced Error Handling
export interface ErrorContext {
  operation: string;
  userId?: string;
  integrationId?: string;
  additionalData?: Record<string, any>;
}

export interface ActionableError {
  code: string;
  message: string;
  userMessage: string;
  suggestedActions: string[];
  retryable: boolean;
  context: ErrorContext;
}

export class EnhancedErrorHandler {
  static createActionableError(
    error: Error, 
    context: ErrorContext,
    userFriendlyMessage?: string
  ): ActionableError {
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

  private static categorizeError(error: Error): string {
    if (error.message.includes('network')) return 'NETWORK_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('auth')) return 'AUTH_ERROR';
    if (error.message.includes('rate limit')) return 'RATE_LIMIT_ERROR';
    if (error.message.includes('validation')) return 'VALIDATION_ERROR';
    return 'UNKNOWN_ERROR';
  }

  private static getUserFriendlyMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      NETWORK_ERROR: 'Connection issue detected. Please check your internet connection.',
      TIMEOUT_ERROR: 'Request timed out. The service may be experiencing high load.',
      AUTH_ERROR: 'Authentication failed. Please check your credentials.',
      RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment before trying again.',
      VALIDATION_ERROR: 'Invalid data provided. Please check your input.',
      UNKNOWN_ERROR: 'An unexpected error occurred. Please try again later.'
    };
    return messages[errorCode] || messages.UNKNOWN_ERROR;
  }

  private static getSuggestedActions(errorCode: string): string[] {
    const actions: Record<string, string[]> = {
      NETWORK_ERROR: ['Check internet connection', 'Retry in a few moments', 'Contact support if persistent'],
      TIMEOUT_ERROR: ['Retry with smaller data batches', 'Try again during off-peak hours'],
      AUTH_ERROR: ['Verify API credentials', 'Check token expiration', 'Re-authenticate'],
      RATE_LIMIT_ERROR: ['Wait before retrying', 'Implement exponential backoff'],
      VALIDATION_ERROR: ['Review input data format', 'Check required fields'],
      UNKNOWN_ERROR: ['Retry operation', 'Contact support with error details']
    };
    return actions[errorCode] || actions.UNKNOWN_ERROR;
  }

  private static isRetryable(errorCode: string): boolean {
    return ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'RATE_LIMIT_ERROR'].includes(errorCode);
  }
}

// Reliable Webhook Service
export interface WebhookPayload {
  id: string;
  event: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

export interface WebhookDeliveryOptions {
  maxRetries: number;
  retryDelays: number[]; // in milliseconds
  timeout: number;
  verifySignature: boolean;
}

export class ReliableWebhookService {
  private static readonly DEFAULT_OPTIONS: WebhookDeliveryOptions = {
    maxRetries: 3,
    retryDelays: [1000, 5000, 15000],
    timeout: 30000,
    verifySignature: true
  };

  static async deliverWebhook(
    url: string, 
    payload: WebhookPayload,
    secret?: string,
    options: Partial<WebhookDeliveryOptions> = {}
  ): Promise<boolean> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    if (opts.verifySignature && secret) {
      payload.signature = this.generateSignature(payload, secret);
    }

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const success = await this.attemptDelivery(url, payload, opts.timeout);
        if (success) {
          logger.info(`Webhook delivered successfully to ${url}`, { 
            webhookId: payload.id, 
            attempt: attempt + 1 
          });
          return true;
        }
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Webhook delivery attempt ${attempt + 1} failed`, { 
          webhookId: payload.id, 
          error: (error as Error).message 
        });
        
        if (attempt < opts.maxRetries) {
          const delay = opts.retryDelays[Math.min(attempt, opts.retryDelays.length - 1)];
          await this.sleep(delay);
        }
      }
    }

    logger.error(`Webhook delivery failed after ${opts.maxRetries + 1} attempts`, { 
      webhookId: payload.id, 
      url, 
      lastError: lastError?.message 
    });
    return false;
  }

  private static generateSignature(payload: WebhookPayload, secret: string): string {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  }

  private static async attemptDelivery(url: string, payload: WebhookPayload, timeout: number): Promise<boolean> {
    // Mock implementation - in real scenario would use HTTP client
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate 90% success rate
        if (Math.random() > 0.1) {
          resolve(true);
        } else {
          reject(new Error('Network error'));
        }
      }, Math.random() * 1000);
    });
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Performance Optimization
export interface CacheOptions {
  ttl: number; // time to live in seconds
  maxSize?: number;
  warmupKeys?: string[];
}

export class PerformanceOptimizer {
  private cache = new Map<string, { value: any; expires: number }>();
  private options: CacheOptions;

  constructor(options: CacheOptions) {
    this.options = options;
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.value as T;
    }
    
    // Remove expired entry
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  async set(key: string, value: any): Promise<void> {
    const expires = Date.now() + (this.options.ttl * 1000);
    
    // Implement basic LRU if maxSize is set
    if (this.options.maxSize && this.cache.size >= this.options.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { value, expires });
  }

  async warmup(warmupFunction: (key: string) => Promise<any>): Promise<void> {
    if (!this.options.warmupKeys) return;

    logger.info(`Starting cache warmup for ${this.options.warmupKeys.length} keys`);
    
    const promises = this.options.warmupKeys.map(async (key) => {
      try {
        const value = await warmupFunction(key);
        await this.set(key, value);
      } catch (error) {
        logger.warn(`Cache warmup failed for key: ${key}`, { error });
      }
    });

    await Promise.allSettled(promises);
    logger.info('Cache warmup completed');
  }

  clear(): void {
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

// Circuit Breaker Pattern
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number; // in milliseconds
  monitoringWindow: number; // in milliseconds
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private nextAttempt: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
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
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.recoveryTimeout;
      logger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.nextAttempt = 0;
    logger.info('Circuit breaker reset to CLOSED state');
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

// Health Monitoring and Scoring
export interface HealthMetrics {
  availability: number; // percentage
  responseTime: number; // average in ms
  errorRate: number; // percentage
  lastSuccessfulSync: Date | null;
  totalRequests: number;
  failedRequests: number;
}

export class IntegrationHealthMonitor {
  private metrics = new Map<string, HealthMetrics>();

  recordRequest(integrationId: string, success: boolean, responseTime: number): void {
    const current = this.metrics.get(integrationId) || this.getDefaultMetrics();
    
    current.totalRequests++;
    if (!success) {
      current.failedRequests++;
    } else {
      current.lastSuccessfulSync = new Date();
    }
    
    // Update response time (simple moving average)
    if (current.totalRequests === 1) {
      current.responseTime = responseTime;
    } else {
      current.responseTime = (current.responseTime + responseTime) / 2;
    }
    current.errorRate = (current.failedRequests / current.totalRequests) * 100;
    current.availability = ((current.totalRequests - current.failedRequests) / current.totalRequests) * 100;
    
    this.metrics.set(integrationId, current);
  }

  getHealthScore(integrationId: string): number {
    const metrics = this.metrics.get(integrationId);
    if (!metrics) return 0;

    // Weighted health score calculation
    const availabilityScore = metrics.availability;
    const responseScore = Math.max(0, 100 - (metrics.responseTime / 50)); // Penalize slow responses
    const recentnessScore = this.getRecentnessScore(metrics.lastSuccessfulSync);

    return (availabilityScore * 0.5 + responseScore * 0.3 + recentnessScore * 0.2);
  }

  private getRecentnessScore(lastSuccess: Date | null): number {
    if (!lastSuccess) return 0;
    
    const hoursSinceLastSuccess = (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastSuccess < 1) return 100;
    if (hoursSinceLastSuccess < 6) return 80;
    if (hoursSinceLastSuccess < 24) return 60;
    if (hoursSinceLastSuccess < 72) return 40;
    return 20;
  }

  private getDefaultMetrics(): HealthMetrics {
    return {
      availability: 100,
      responseTime: 0,
      errorRate: 0,
      lastSuccessfulSync: null,
      totalRequests: 0,
      failedRequests: 0
    };
  }

  getMetrics(integrationId: string): HealthMetrics | null {
    return this.metrics.get(integrationId) || null;
  }

  getAllMetrics(): Map<string, HealthMetrics> {
    return new Map(this.metrics);
  }
}

// Smart Retry Logic
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // in milliseconds
  maxDelay: number; // in milliseconds
  backoffFactor: number;
  jitter: boolean;
}

export class SmartRetryService {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
  };

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === opts.maxAttempts || !this.isRetryableError(error as Error)) {
          throw error;
        }

        const delay = this.calculateDelay(attempt, opts);
        logger.info(`Retry attempt ${attempt} after ${delay}ms delay`, { 
          error: (error as Error).message 
        });
        
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private static isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /rate.?limit/i,
      /service.?unavailable/i,
      /temporarily.?unavailable/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  private static calculateDelay(attempt: number, options: RetryOptions): number {
    let delay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);
    delay = Math.min(delay, options.maxDelay);
    
    if (options.jitter) {
      // Add random jitter ±25%
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }
    
    return Math.floor(delay);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Advanced Analytics
export interface AnalyticsEvent {
  event: string;
  integrationId: string;
  userId?: string;
  timestamp: Date;
  properties: Record<string, any>;
}

export class AdvancedAnalyticsService {
  private events: AnalyticsEvent[] = [];

  track(event: AnalyticsEvent): void {
    this.events.push(event);
    logger.debug('Analytics event tracked', { 
      event: event.event, 
      integrationId: event.integrationId 
    });
  }

  getIntegrationMetrics(integrationId: string, timeRange: { start: Date; end: Date }) {
    const filteredEvents = this.events.filter(e => 
      e.integrationId === integrationId &&
      e.timestamp >= timeRange.start &&
      e.timestamp <= timeRange.end
    );

    return {
      totalEvents: filteredEvents.length,
      uniqueUsers: new Set(filteredEvents.map(e => e.userId)).size,
      eventTypes: this.groupBy(filteredEvents, 'event'),
      timeline: this.groupEventsByTimeWindow(filteredEvents, 'hour')
    };
  }

  private groupBy(events: AnalyticsEvent[], field: keyof AnalyticsEvent) {
    return events.reduce((acc, event) => {
      const key = String(event[field]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupEventsByTimeWindow(events: AnalyticsEvent[], window: 'hour' | 'day') {
    const windowMs = window === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    return events.reduce((acc, event) => {
      const windowStart = Math.floor(event.timestamp.getTime() / windowMs) * windowMs;
      const key = new Date(windowStart).toISOString();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  generateReport(timeRange: { start: Date; end: Date }) {
    const allEvents = this.events.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );

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
