/**
 * Enhanced Base Adapter
 * 
 * Abstract base class that provides enterprise-grade features to all integration adapters:
 * - Robust error handling with actionable context
 * - Circuit breaker pattern for reliability
 * - Smart retry logic with exponential backoff
 * - Performance optimization via caching
 * - Health monitoring and telemetry
 * - Webhook handling with signature verification
 */

import {
  EnhancedErrorHandler,
  ErrorContext,
  CircuitBreaker,
  CircuitBreakerOptions,
  SmartRetryService,
  RetryOptions,
  PerformanceOptimizer,
  CacheOptions,
  IntegrationHealthMonitor,
  ReliableWebhookService,
  WebhookPayload,
  WebhookDeliveryOptions,
  AdvancedAnalyticsService,
  AnalyticsEvent
} from './CompetitiveEnhancements';

import { logger } from '../../utils';

// Base interfaces
export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsFailed: number;
  errors: string[];
  lastSyncTime: Date;
}

export interface TaxCalculationRequest {
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    taxCategory?: string;
  }>;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  customerTaxExempt?: boolean;
}

export interface TaxCalculationResult {
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  taxBreakdown: Array<{
    jurisdiction: string;
    rate: number;
    amount: number;
    type: string;
  }>;
  itemBreakdown: Array<{
    id: string;
    subtotal: number;
    tax: number;
    total: number;
  }>;
}

export interface TransactionUpdateRequest {
  transactionId: string;
  status: 'completed' | 'cancelled' | 'refunded';
  amount?: number;
  taxAmount?: number;
  metadata?: Record<string, any>;
}

export interface AdapterConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  credentials: Record<string, string>;
  settings: Record<string, any>;
  circuitBreakerOptions?: CircuitBreakerOptions;
  retryOptions?: RetryOptions;
  cacheOptions?: CacheOptions;
  webhookSecret?: string;
}

/**
 * Enhanced Base Adapter
 * 
 * All integration adapters should extend this class to inherit enterprise features
 */
export abstract class EnhancedBaseAdapter {
  protected readonly config: AdapterConfiguration;
  protected readonly circuitBreaker: CircuitBreaker;
  protected readonly cache: PerformanceOptimizer;
  protected readonly healthMonitor: IntegrationHealthMonitor;
  protected readonly analytics: AdvancedAnalyticsService;

  constructor(config: AdapterConfiguration) {
    this.config = config;
    
    // Initialize circuit breaker
    const circuitOptions: CircuitBreakerOptions = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      ...config.circuitBreakerOptions
    };
    this.circuitBreaker = new CircuitBreaker(circuitOptions);

    // Initialize cache
    const cacheOptions: CacheOptions = {
      ttl: 300, // 5 minutes
      maxSize: 1000,
      ...config.cacheOptions
    };
    this.cache = new PerformanceOptimizer(cacheOptions);

    // Initialize monitoring
    this.healthMonitor = new IntegrationHealthMonitor();
    this.analytics = new AdvancedAnalyticsService();

    logger.info(`Enhanced adapter initialized: ${config.name}`, { id: config.id });
  }

  // Abstract methods that subclasses must implement
  protected abstract doSyncTransactions(lastSyncTime?: Date): Promise<SyncResult>;
  protected abstract doSyncProducts(lastSyncTime?: Date): Promise<SyncResult>;
  protected abstract doSyncCustomers(lastSyncTime?: Date): Promise<SyncResult>;
  protected abstract doCalculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult>;

  // Public API methods with enhanced features
  
  /**
   * Sync transactions with enhanced error handling and monitoring
   */
  async syncTransactions(lastSyncTime?: Date): Promise<SyncResult> {
    return this.executeWithEnhancements(
      'syncTransactions',
      () => this.doSyncTransactions(lastSyncTime),
      { useCache: true, cacheTTL: 300 }
    );
  }

  /**
   * Sync products with enhanced error handling and monitoring
   */
  async syncProducts(lastSyncTime?: Date): Promise<SyncResult> {
    return this.executeWithEnhancements(
      'syncProducts',
      () => this.doSyncProducts(lastSyncTime),
      { useCache: true, cacheTTL: 600 }
    );
  }

  /**
   * Sync customers with enhanced error handling and monitoring
   */
  async syncCustomers(lastSyncTime?: Date): Promise<SyncResult> {
    return this.executeWithEnhancements(
      'syncCustomers',
      () => this.doSyncCustomers(lastSyncTime),
      { useCache: true, cacheTTL: 600 }
    );
  }

  /**
   * Calculate tax with enhanced error handling and caching
   */
  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    const cacheKey = this.generateTaxCacheKey(request);
    
    // Try cache first
    const cached = await this.cache.get<TaxCalculationResult>(cacheKey);
    if (cached) {
      this.trackAnalyticsEvent('tax_calculation_cache_hit', { cacheKey });
      return cached;
    }

    return this.executeWithEnhancements(
      'calculateTax',
      async () => {
        const result = await this.doCalculateTax(request);
        
        // Cache the result
        await this.cache.set(cacheKey, result);
        this.trackAnalyticsEvent('tax_calculation_cache_miss', { cacheKey });
        
        return result;
      },
      { useCache: false } // We handle caching manually for tax calculations
    );
  }

  /**
   * Update transaction status
   */
  async updateTransaction(request: TransactionUpdateRequest): Promise<boolean> {
    return this.executeWithEnhancements(
      'updateTransaction',
      async () => {
        // Default implementation - subclasses can override
        logger.info('Transaction update requested', {
          integrationId: this.config.id,
          transactionId: request.transactionId,
          status: request.status
        });
        return true;
      },
      { useCache: false }
    );
  }

  /**
   * Handle webhook with signature verification
   */
  async handleWebhook(payload: any, signature?: string): Promise<boolean> {
    try {
      // Verify webhook signature if secret is configured
      if (this.config.webhookSecret && signature) {
        const isValid = this.verifyWebhookSignature(payload, signature);
        if (!isValid) {
          logger.warn('Invalid webhook signature', { integrationId: this.config.id });
          return false;
        }
      }

      // Track webhook received
      this.trackAnalyticsEvent('webhook_received', {
        type: payload.type || 'unknown',
        hasSignature: !!signature
      });

      // Process webhook - subclasses can override this method
      const processed = await this.processWebhook(payload);
      
      if (processed) {
        this.trackAnalyticsEvent('webhook_processed', { type: payload.type });
      }

      return processed;
    } catch (error) {
      logger.error('Webhook processing failed', {
        integrationId: this.config.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Send webhook to external endpoint
   */
  async sendWebhook(url: string, payload: WebhookPayload, options?: Partial<WebhookDeliveryOptions>): Promise<boolean> {
    return ReliableWebhookService.deliverWebhook(
      url,
      payload,
      this.config.webhookSecret,
      options
    );
  }

  /**
   * Get integration health metrics
   */
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

  /**
   * Generate analytics report for a time range
   */
  getAnalyticsReport(timeRange: { start: Date; end: Date }) {
    return this.analytics.getIntegrationMetrics(this.config.id, timeRange);
  }

  // Protected methods for subclasses

  /**
   * Execute operation with enhanced features (circuit breaker, retry, monitoring)
   */
  protected async executeWithEnhancements<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { useCache?: boolean; cacheTTL?: number; cacheKey?: string } = {}
  ): Promise<T> {
    const startTime = Date.now();
    const context: ErrorContext = {
      operation,
      integrationId: this.config.id
    };

    try {
      // Check cache if enabled
      if (options.useCache && options.cacheKey) {
        const cached = await this.cache.get<T>(options.cacheKey);
        if (cached) {
          this.trackAnalyticsEvent('cache_hit', { operation, cacheKey: options.cacheKey });
          return cached;
        }
      }

      // Execute with circuit breaker and retry
      const result = await this.circuitBreaker.execute(() =>
        SmartRetryService.executeWithRetry(fn, this.config.retryOptions)
      );

      // Cache result if enabled
      if (options.useCache && options.cacheKey && options.cacheTTL) {
        const originalTTL = this.cache['options'].ttl;
        this.cache['options'].ttl = options.cacheTTL;
        await this.cache.set(options.cacheKey, result);
        this.cache['options'].ttl = originalTTL;
      }

      // Record success metrics
      const duration = Date.now() - startTime;
      this.healthMonitor.recordRequest(this.config.id, true, duration);
      
      this.trackAnalyticsEvent('operation_success', {
        operation,
        duration,
        cacheUsed: options.useCache || false
      });

      return result;
    } catch (error) {
      // Record failure metrics
      const duration = Date.now() - startTime;
      this.healthMonitor.recordRequest(this.config.id, false, duration);

      // Create actionable error
      const actionableError = EnhancedErrorHandler.createActionableError(
        error as Error,
        context
      );

      this.trackAnalyticsEvent('operation_failure', {
        operation,
        duration,
        errorCode: actionableError.code,
        retryable: actionableError.retryable
      });

      logger.error('Enhanced operation failed', {
        integrationId: this.config.id,
        operation,
        actionableError
      });

      throw actionableError;
    }
  }

  /**
   * Process webhook - subclasses can override
   */
  protected async processWebhook(payload: any): Promise<boolean> {
    logger.info('Processing webhook', {
      integrationId: this.config.id,
      type: payload.type
    });
    return true;
  }

  /**
   * Verify webhook signature
   */
  protected verifyWebhookSignature(payload: any, signature: string): boolean {
    if (!this.config.webhookSecret) return true;
    
    try {
      const crypto = require('crypto');
      const payloadString = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payloadString)
        .digest('hex');
      
      return signature === expectedSignature || signature === `sha256=${expectedSignature}`;
    } catch (error) {
      logger.error('Webhook signature verification failed', {
        integrationId: this.config.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Generate cache key for tax calculations
   */
  protected generateTaxCacheKey(request: TaxCalculationRequest): string {
    const crypto = require('crypto');
    const keyData = {
      items: request.items,
      address: request.address,
      customerTaxExempt: request.customerTaxExempt || false
    };
    
    return `tax_${crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex')}`;
  }

  /**
   * Track analytics event
   */
  protected trackAnalyticsEvent(event: string, properties: Record<string, any> = {}): void {
    const analyticsEvent: AnalyticsEvent = {
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

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.cache.clear();
    logger.info(`Enhanced adapter cleanup completed: ${this.config.name}`);
  }
}
