import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api';

test.describe('Redis Integration Tests', () => {
  test('Redis health check should return healthy status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/redis/health`);
    expect(response.status()).toBeLessThan(400);
    
    const health = await response.json();
    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('components');
    expect(health.components).toHaveProperty('redis');
    expect(health.components).toHaveProperty('cache');
    expect(health.components).toHaveProperty('queues');
    expect(health.components).toHaveProperty('sessions');
  });

  test('Performance metrics should be accessible', async ({ request }) => {
    const response = await request.get(`${API_BASE}/redis/metrics`);
    expect(response.status()).toBe(200);
    
    const metrics = await response.json();
    expect(metrics).toHaveProperty('redis');
    expect(metrics).toHaveProperty('cache');
    expect(metrics).toHaveProperty('queues');
    expect(metrics.redis).toHaveProperty('latency');
    expect(metrics.redis).toHaveProperty('memory');
  });

  test('Cache statistics should be available', async ({ request }) => {
    const response = await request.get(`${API_BASE}/redis/cache/stats`);
    expect(response.status()).toBe(200);
    
    const cacheStats = await response.json();
    expect(cacheStats).toHaveProperty('stats');
    expect(cacheStats).toHaveProperty('size');
    expect(cacheStats.stats).toHaveProperty('hitRate');
  });

  test('Queue metrics should show all configured queues', async ({ request }) => {
    const response = await request.get(`${API_BASE}/redis/queues`);
    expect(response.status()).toBe(200);
    
    const queueData = await response.json();
    expect(queueData).toHaveProperty('availableQueues');
    expect(queueData).toHaveProperty('metrics');
    expect(queueData.availableQueues).toContain('tax-calculation');
    expect(queueData.availableQueues).toContain('transaction-processing');
    expect(queueData.availableQueues).toContain('tax-rate-update');
  });

  test('Tax rate caching should improve performance', async ({ request }) => {
    // First request (cache miss)
    const startTime1 = Date.now();
    const response1 = await request.get(`${API_BASE}/tax/rates/CA`);
    const duration1 = Date.now() - startTime1;
    expect(response1.status()).toBe(200);
    
    const headers1 = response1.headers();
    expect(headers1['x-cache']).toBe('MISS');
    
    // Second request (should be cache hit)
    const startTime2 = Date.now();
    const response2 = await request.get(`${API_BASE}/tax/rates/CA`);
    const duration2 = Date.now() - startTime2;
    expect(response2.status()).toBe(200);
    
    const headers2 = response2.headers();
    expect(headers2['x-cache']).toBe('HIT');
    
    // Cache hit should be faster
    expect(duration2).toBeLessThan(duration1);
  });

  test('Cache invalidation should work correctly', async ({ request }) => {
    // Make a request to populate cache
    await request.get(`${API_BASE}/tax/rates/TX`);
    
    // Invalidate cache for TX
    const invalidateResponse = await request.post(`${API_BASE}/redis/cache/invalidate`, {
      data: { state: 'TX' }
    });
    expect(invalidateResponse.status()).toBe(200);
    
    const invalidateResult = await invalidateResponse.json();
    expect(invalidateResult).toHaveProperty('success', true);
    expect(invalidateResult).toHaveProperty('deletedEntries');
  });

  test('Queue operations should work correctly', async ({ request }) => {
    // Get specific queue details
    const queueResponse = await request.get(`${API_BASE}/redis/queues/tax-calculation`);
    expect(queueResponse.status()).toBe(200);
    
    const queueData = await queueResponse.json();
    expect(queueData).toHaveProperty('queueName', 'tax-calculation');
    expect(queueData).toHaveProperty('metrics');
    expect(queueData).toHaveProperty('jobs');
  });

  test('System optimization should execute without errors', async ({ request }) => {
    const response = await request.post(`${API_BASE}/redis/optimize`);
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('optimization');
    expect(result.optimization).toHaveProperty('optimizations');
  });

  test('Diagnostics should provide comprehensive system info', async ({ request }) => {
    const response = await request.get(`${API_BASE}/redis/diagnostics`);
    expect(response.status()).toBe(200);
    
    const diagnostics = await response.json();
    expect(diagnostics).toHaveProperty('redis');
    expect(diagnostics).toHaveProperty('cache');
    expect(diagnostics).toHaveProperty('queues');
    expect(diagnostics).toHaveProperty('system');
  });

  test('Health checks should validate all components', async ({ request }) => {
    const response = await request.post(`${API_BASE}/redis/health-check`);
    expect(response.status()).toBeLessThan(400);
    
    const healthCheck = await response.json();
    expect(healthCheck).toHaveProperty('overall');
    expect(healthCheck).toHaveProperty('checks');
    expect(healthCheck.checks.length).toBeGreaterThan(0);
    
    // All checks should have required properties
    for (const check of healthCheck.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('duration');
    }
  });

  test('Cache warmup should populate cache efficiently', async ({ request }) => {
    // Get initial cache stats
    const initialStatsResponse = await request.get(`${API_BASE}/redis/cache/stats`);
    const initialStats = await initialStatsResponse.json();
    
    // Trigger cache warmup
    const warmupResponse = await request.post(`${API_BASE}/redis/cache/warmup`);
    expect(warmupResponse.status()).toBe(200);
    
    // Check that cache was populated
    const finalStatsResponse = await request.get(`${API_BASE}/redis/cache/stats`);
    const finalStats = await finalStatsResponse.json();
    
    expect(finalStats.size.taxRateKeys).toBeGreaterThan(initialStats.size.taxRateKeys);
  });

  test('Frequently accessed rates preload should work', async ({ request }) => {
    const response = await request.post(`${API_BASE}/redis/cache/preload-frequent`);
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('message');
  });

  test('Session metrics should be tracked', async ({ request }) => {
    const response = await request.get(`${API_BASE}/redis/sessions/metrics`);
    expect(response.status()).toBe(200);
    
    const metrics = await response.json();
    expect(metrics).toHaveProperty('activeSessions');
    expect(metrics).toHaveProperty('totalSessions');
    expect(metrics).toHaveProperty('expiredSessions');
    expect(metrics).toHaveProperty('lastCleanup');
  });

  test('Redis info should provide detailed server information', async ({ request }) => {
    const response = await request.get(`${API_BASE}/redis/redis/info`);
    expect(response.status()).toBe(200);
    
    const info = await response.json();
    expect(info).toHaveProperty('info');
    expect(info).toHaveProperty('connectionHealth');
    expect(info.connectionHealth).toHaveProperty('status');
  });

  test('Tax calculation with caching should work end-to-end', async ({ request }) => {
    const taxCalculationRequest = {
      items: [
        {
          id: 'item1',
          name: 'Test Product',
          quantity: 2,
          unitPrice: 10.00,
          taxCategory: 'general'
        }
      ],
      address: {
        street: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90210',
        country: 'US'
      },
      customerTaxExempt: false
    };

    // Make tax calculation request
    const response = await request.post(`${API_BASE}/tax/calculate`, {
      data: taxCalculationRequest
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('subtotal');
    expect(result).toHaveProperty('totalTax');
    expect(result).toHaveProperty('grandTotal');
    expect(result).toHaveProperty('taxBreakdown');
    expect(result).toHaveProperty('itemBreakdown');
  });

  test('Queue management operations should work', async ({ request }) => {
    const queueName = 'tax-calculation';
    
    // Pause queue
    const pauseResponse = await request.post(`${API_BASE}/redis/queues/${queueName}`, {
      data: { action: 'pause' }
    });
    expect(pauseResponse.status()).toBe(200);
    
    const pauseResult = await pauseResponse.json();
    expect(pauseResult).toHaveProperty('success', true);
    expect(pauseResult).toHaveProperty('action', 'pause');
    
    // Resume queue
    const resumeResponse = await request.post(`${API_BASE}/redis/queues/${queueName}`, {
      data: { action: 'resume' }
    });
    expect(resumeResponse.status()).toBe(200);
    
    const resumeResult = await resumeResponse.json();
    expect(resumeResult).toHaveProperty('success', true);
    expect(resumeResult).toHaveProperty('action', 'resume');
  });
});