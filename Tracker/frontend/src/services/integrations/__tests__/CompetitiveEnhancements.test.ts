import {
  EnhancedErrorHandler,
  ReliableWebhookService,
  PerformanceOptimizer,
  CircuitBreaker,
  SmartRetryService,
  IntegrationMonitoringService,
  IntegrationAnalyticsService,
  IntegrationHealthScorer,
  PredictiveMaintenanceService,
  IntelligentCacheService,
  IntegrationHealth,
  IntegrationIssue
} from '../enhancements/CompetitiveEnhancements';

// Mock logger for testing
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => ({
  logger: mockLogger
}));

describe('Competitive Enhancements', () => {
  
  describe('EnhancedErrorHandler', () => {
    it('should create enhanced error for tax calculation failure', () => {
      const error = EnhancedErrorHandler.createError('TAX_CALCULATION_FAILED', {
        address: { city: 'San Francisco', state: 'CA' }
      });

      expect(error.errorCode).toBe('TAX_CALC_001');
      expect(error.message).toContain('Tax calculation failed');
      expect(error.details).toContain('San Francisco, CA');
      expect(error.resolution).toBeTruthy();
      expect(error.documentation).toContain('docs.salestax.dev');
    });

    it('should create enhanced error for rate limit exceeded', () => {
      const error = EnhancedErrorHandler.createError('RATE_LIMIT_EXCEEDED', {
        limit: 1000,
        window: 'hour',
        current: 1200
      });

      expect(error.errorCode).toBe('RATE_001');
      expect(error.details).toContain('1000');
      expect(error.details).toContain('hour');
      expect(error.retryAfter).toBeTruthy();
    });

    it('should create generic error for unknown error type', () => {
      const error = EnhancedErrorHandler.createError('UNKNOWN_ERROR', {});

      expect(error.errorCode).toBe('UNKNOWN_001');
      expect(error.message).toBe('An unexpected error occurred');
    });
  });

  describe('PerformanceOptimizer', () => {
    let optimizer: PerformanceOptimizer;

    beforeEach(() => {
      optimizer = new PerformanceOptimizer();
    });

    it('should cache and return cached data', async () => {
      const fetcherMock = jest.fn().mockResolvedValue('test-data');
      
      // First call - should call fetcher
      const result1 = await optimizer.withCaching('test-key', 1000, fetcherMock);
      expect(result1).toBe('test-data');
      expect(fetcherMock).toHaveBeenCalledTimes(1);

      // Second call - should return cached data
      const result2 = await optimizer.withCaching('test-key', 1000, fetcherMock);
      expect(result2).toBe('test-data');
      expect(fetcherMock).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should honor cache TTL', async () => {
      const fetcherMock = jest.fn()
        .mockResolvedValueOnce('first-data')
        .mockResolvedValueOnce('second-data');
      
      // First call
      await optimizer.withCaching('test-key', 100, fetcherMock);
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second call - should fetch again
      const result = await optimizer.withCaching('test-key', 100, fetcherMock);
      expect(result).toBe('second-data');
      expect(fetcherMock).toHaveBeenCalledTimes(2);
    });

    it('should handle timeout correctly', async () => {
      const slowPromise = new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(
        optimizer.withTimeout(slowPromise, 100)
      ).rejects.toThrow('Operation timed out after 100ms');
    });

    it('should record and calculate metrics', () => {
      optimizer.recordMetric('test-operation', 100);
      optimizer.recordMetric('test-operation', 200);
      optimizer.recordMetric('test-operation', 150);

      const metrics = optimizer.getMetrics();
      expect(metrics['test-operation']).toBeDefined();
      expect(metrics['test-operation'].avg).toBe(150);
      expect(metrics['test-operation'].min).toBe(100);
      expect(metrics['test-operation'].max).toBe(200);
      expect(metrics['test-operation'].count).toBe(3);
    });
  });

  describe('ReliableWebhookService', () => {
    let webhookService: ReliableWebhookService;

    beforeEach(() => {
      webhookService = new ReliableWebhookService();
      
      // Mock fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should deliver webhook successfully on first attempt', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const deliveryId = await webhookService.deliver('http://example.com/webhook', { test: 'data' });
      
      expect(deliveryId).toBeTruthy();
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const status = webhookService.getDeliveryStatus(deliveryId);
      expect(status?.status).toBe('delivered');
    });

    it('should retry on failure and eventually succeed', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        });

      const deliveryId = await webhookService.deliver('http://example.com/webhook', { test: 'data' });
      
      // Wait for retry logic
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const status = webhookService.getDeliveryStatus(deliveryId);
      expect(status?.attempts.length).toBeGreaterThan(1);
    });

    it('should calculate delivery metrics correctly', () => {
      const metrics = webhookService.getDeliveryMetrics();
      
      expect(metrics).toHaveProperty('totalDeliveries');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics).toHaveProperty('failedDeliveries');
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(2, 1000); // 2 failures, 1 second timeout
    });

    it('should allow operations when circuit is closed', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after threshold failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('failure'));
      
      // First failure
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      
      // Second failure - should open circuit
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      
      // Third call - should fail due to open circuit
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is open');
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should transition to half-open after recovery timeout', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('failure'))
        .mockRejectedValueOnce(new Error('failure'))
        .mockResolvedValueOnce('success');
      
      // Trigger failures to open circuit
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should allow one attempt in half-open state
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');
    });

    it('should provide correct state information', () => {
      const state = circuitBreaker.getState();
      
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('failures');
      expect(state).toHaveProperty('lastFailTime');
    });
  });

  describe('SmartRetryService', () => {
    let retryService: SmartRetryService;

    beforeEach(() => {
      retryService = new SmartRetryService();
    });

    it('should succeed without retry on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      const result = await retryService.executeWithRetry('test-key', operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValueOnce('success');
      
      const result = await retryService.executeWithRetry('test-key', operation, {
        maxRetries: 2,
        baseDelay: 10 // Shorter delay for tests
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue({ status: 400 });
      
      await expect(
        retryService.executeWithRetry('test-key', operation)
      ).rejects.toMatchObject({ status: 400 });
      
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should respect max retries', async () => {
      const operation = jest.fn().mockRejectedValue({ status: 500 });
      
      await expect(
        retryService.executeWithRetry('test-key', operation, {
          maxRetries: 2,
          baseDelay: 10
        })
      ).rejects.toMatchObject({ status: 500 });
      
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('IntegrationHealthScorer', () => {
    let healthScorer: IntegrationHealthScorer;

    beforeEach(() => {
      healthScorer = new IntegrationHealthScorer();
    });

    it('should calculate perfect health score for excellent metrics', () => {
      const mockHealth: IntegrationHealth = {
        integrationId: 'test',
        status: 'healthy',
        lastSuccessfulSync: new Date(),
        errorRate: 0,
        averageResponseTime: 30,
        uptime: 100,
        rateLimitStatus: { remaining: 900, limit: 1000, resetTime: new Date() },
        issues: []
      };

      const score = healthScorer.calculateHealthScore(mockHealth);
      
      expect(score.score).toBeGreaterThanOrEqual(95);
      expect(score.breakdown.performance).toBe(25);
      expect(score.breakdown.reliability).toBe(25);
      expect(score.breakdown.availability).toBe(25);
      expect(score.recommendations).toHaveLength(0);
    });

    it('should penalize poor performance metrics', () => {
      const mockHealth: IntegrationHealth = {
        integrationId: 'test',
        status: 'degraded',
        lastSuccessfulSync: new Date(),
        errorRate: 10,
        averageResponseTime: 600,
        uptime: 90,
        rateLimitStatus: { remaining: 50, limit: 1000, resetTime: new Date() },
        issues: []
      };

      const score = healthScorer.calculateHealthScore(mockHealth);
      
      expect(score.score).toBeLessThan(70);
      expect(score.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide correct health grade for different scores', () => {
      const gradeA = healthScorer.getHealthGrade(95);
      expect(gradeA.grade).toBe('A+');
      expect(gradeA.color).toContain('green');

      const gradeF = healthScorer.getHealthGrade(30);
      expect(gradeF.grade).toBe('F');
      expect(gradeF.color).toContain('red');
    });
  });

  describe('PredictiveMaintenanceService', () => {
    let maintenanceService: PredictiveMaintenanceService;

    beforeEach(() => {
      maintenanceService = new PredictiveMaintenanceService();
    });

    it('should predict low risk for stable metrics', () => {
      // Record stable performance
      for (let i = 0; i < 20; i++) {
        maintenanceService.recordPerformanceMetrics('test-integration', {
          responseTime: 100,
          errorRate: 0.5
        });
      }

      const prediction = maintenanceService.predictMaintenanceNeeds('test-integration');
      
      expect(prediction.riskLevel).toBe('low');
      expect(prediction.predictions).toHaveLength(0);
    });

    it('should predict high risk for degrading metrics', () => {
      // Record degrading performance
      for (let i = 0; i < 20; i++) {
        maintenanceService.recordPerformanceMetrics('test-integration', {
          responseTime: 100 + i * 10, // Increasing response time
          errorRate: i * 0.2 // Increasing error rate
        });
      }

      const prediction = maintenanceService.predictMaintenanceNeeds('test-integration');
      
      expect(prediction.riskLevel).not.toBe('low');
      expect(prediction.predictions.length).toBeGreaterThan(0);
    });

    it('should return low risk for insufficient data', () => {
      const prediction = maintenanceService.predictMaintenanceNeeds('new-integration');
      
      expect(prediction.riskLevel).toBe('low');
      expect(prediction.predictions).toHaveLength(0);
    });
  });

  describe('IntelligentCacheService', () => {
    let cacheService: IntelligentCacheService;
    let performanceOptimizer: PerformanceOptimizer;

    beforeEach(() => {
      performanceOptimizer = new PerformanceOptimizer();
      cacheService = new IntelligentCacheService(performanceOptimizer);
    });

    it('should record cache access patterns', () => {
      cacheService.recordCacheAccess('test-key', true);
      cacheService.recordCacheAccess('test-key', false);
      cacheService.recordCacheAccess('test-key', true);

      const analytics = cacheService.getAnalytics();
      expect(analytics.totalKeys).toBe(1);
    });

    it('should provide cache analytics', () => {
      cacheService.recordCacheAccess('key1', true);
      cacheService.recordCacheAccess('key2', false);
      cacheService.recordCacheAccess('key1', true);

      const analytics = cacheService.getAnalytics();
      
      expect(analytics).toHaveProperty('totalKeys');
      expect(analytics).toHaveProperty('averageHitRate');
      expect(analytics).toHaveProperty('topKeys');
      expect(analytics.totalKeys).toBe(2);
    });
  });

  describe('IntegrationMonitoringService', () => {
    let monitoringService: IntegrationMonitoringService;

    beforeEach(() => {
      monitoringService = new IntegrationMonitoringService();
    });

    it('should generate health report', async () => {
      const report = await monitoringService.generateHealthReport();
      
      expect(report).toHaveProperty('overallStatus');
      expect(report).toHaveProperty('totalIntegrations');
      expect(report).toHaveProperty('healthyIntegrations');
      expect(report).toHaveProperty('degradedIntegrations');
      expect(report).toHaveProperty('downIntegrations');
      expect(report).toHaveProperty('averageResponseTime');
      expect(report).toHaveProperty('totalIssues');
    });

    it('should return all integrations health', async () => {
      const healthList = await monitoringService.getAllIntegrationsHealth();
      
      expect(Array.isArray(healthList)).toBe(true);
    });
  });

  describe('IntegrationAnalyticsService', () => {
    let analyticsService: IntegrationAnalyticsService;

    beforeEach(() => {
      analyticsService = new IntegrationAnalyticsService();
    });

    it('should generate analytics for integration', async () => {
      const analytics = await analyticsService.generateAnalytics('test-integration', 'day');
      
      expect(analytics.integrationId).toBe('test-integration');
      expect(analytics.period).toBe('day');
      expect(analytics.metrics).toBeDefined();
      expect(analytics.insights).toBeDefined();
      
      expect(analytics.metrics).toHaveProperty('totalRequests');
      expect(analytics.metrics).toHaveProperty('successfulRequests');
      expect(analytics.metrics).toHaveProperty('failedRequests');
      expect(analytics.metrics).toHaveProperty('averageResponseTime');
      expect(analytics.metrics).toHaveProperty('dataVolume');
      expect(analytics.metrics).toHaveProperty('uniqueUsers');
      expect(analytics.metrics).toHaveProperty('topEndpoints');
      expect(analytics.metrics).toHaveProperty('errorBreakdown');
    });

    it('should provide meaningful insights', async () => {
      const analytics = await analyticsService.generateAnalytics('test-integration', 'hour');
      
      expect(Array.isArray(analytics.insights)).toBe(true);
      
      analytics.insights.forEach(insight => {
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('message');
        expect(insight).toHaveProperty('impact');
        expect(insight).toHaveProperty('recommendation');
        expect(['performance', 'usage', 'error', 'optimization']).toContain(insight.type);
        expect(['low', 'medium', 'high']).toContain(insight.impact);
      });
    });
  });
});

// Integration tests for combined functionality
describe('Competitive Enhancements Integration', () => {
  it('should work together for enhanced error handling and retry', async () => {
    const retryService = new SmartRetryService();
    const circuitBreaker = new CircuitBreaker();
    
    let attempts = 0;
    const flakyOperation = () => {
      attempts++;
      if (attempts <= 2) {
        return Promise.reject({ status: 500 });
      }
      return Promise.resolve('success');
    };

    const result = await circuitBreaker.execute(async () => {
      return await retryService.executeWithRetry('test-op', flakyOperation, {
        maxRetries: 3,
        baseDelay: 10
      });
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should combine performance optimization with intelligent caching', async () => {
    const performanceOptimizer = new PerformanceOptimizer();
    const cacheService = new IntelligentCacheService(performanceOptimizer);

    let fetchCalls = 0;
    const mockFetcher = () => {
      fetchCalls++;
      return Promise.resolve(`data-${fetchCalls}`);
    };

    // First call - should fetch and cache
    const result1 = await performanceOptimizer.withCaching('test-key', 1000, mockFetcher);
    cacheService.recordCacheAccess('test-key', false); // Cache miss

    // Second call - should use cache
    const result2 = await performanceOptimizer.withCaching('test-key', 1000, mockFetcher);
    cacheService.recordCacheAccess('test-key', true); // Cache hit

    expect(result1).toBe('data-1');
    expect(result2).toBe('data-1'); // Same data from cache
    expect(fetchCalls).toBe(1);

    const analytics = cacheService.getAnalytics();
    expect(analytics.averageHitRate).toBe(0.5); // 50% hit rate
  });
});
