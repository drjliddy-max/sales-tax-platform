import { test, expect } from '@playwright/test';

test.describe('Firecrawl Tax Rate Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should fetch tax updates via manual trigger', async ({ request }) => {
    const response = await request.post('/api/tax-updates/manual-update', {
      data: {
        states: ['CA'],
        force: true
      }
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result).toHaveProperty('updatedRates');
    expect(result).toHaveProperty('timestamp');
  });

  test('should get compliance alerts', async ({ request }) => {
    const response = await request.get('/api/tax-updates/compliance-alerts?days=7');
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('summary');
    expect(Array.isArray(result.alerts)).toBe(true);
  });

  test('should get audit trail', async ({ request }) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    
    const response = await request.get(
      `/api/tax-updates/audit-trail?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    );
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('auditTrail');
    expect(result).toHaveProperty('count');
    expect(Array.isArray(result.auditTrail)).toBe(true);
  });

  test('should generate audit report', async ({ request }) => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    
    const response = await request.get(
      `/api/tax-updates/audit-report?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
    );
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('period');
    expect(result).toHaveProperty('summary');
    expect(result.summary).toHaveProperty('totalEvents');
    expect(result.summary).toHaveProperty('rateUpdates');
  });

  test('should get scheduler status', async ({ request }) => {
    const response = await request.get('/api/tax-updates/scheduler-status');
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('totalSchedules');
    expect(result).toHaveProperty('config');
    expect(result).toHaveProperty('schedules');
  });

  test('should handle emergency mode activation', async ({ request }) => {
    // Enable emergency mode
    const enableResponse = await request.post('/api/tax-updates/emergency-mode');
    expect(enableResponse.status()).toBe(200);
    
    const enableResult = await enableResponse.json();
    expect(enableResult.success).toBe(true);
    expect(enableResult.message).toContain('Emergency mode enabled');
    
    // Check scheduler status shows emergency mode
    const statusResponse = await request.get('/api/tax-updates/scheduler-status');
    const statusResult = await statusResponse.json();
    expect(statusResult.config.emergencyMode).toBe(true);
    
    // Disable emergency mode
    const disableResponse = await request.delete('/api/tax-updates/emergency-mode');
    expect(disableResponse.status()).toBe(200);
    
    const disableResult = await disableResponse.json();
    expect(disableResult.success).toBe(true);
  });

  test('should create and remove custom schedules', async ({ request }) => {
    // Create custom schedule
    const createResponse = await request.post('/api/tax-updates/schedule', {
      data: {
        cronExpression: '0 9 * * 1', // Every Monday at 9 AM
        description: 'Weekly custom update'
      }
    });
    
    expect(createResponse.status()).toBe(201);
    
    const createResult = await createResponse.json();
    expect(createResult.success).toBe(true);
    expect(createResult).toHaveProperty('taskId');
    
    const taskId = createResult.taskId;
    
    // Remove custom schedule
    const removeResponse = await request.delete(`/api/tax-updates/schedule/${taskId}`);
    expect(removeResponse.status()).toBe(200);
    
    const removeResult = await removeResponse.json();
    expect(removeResult.success).toBe(true);
  });

  test('should get sources needing update', async ({ request }) => {
    const response = await request.get('/api/tax-updates/sources-status');
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('sourcesNeedingUpdate');
    expect(result).toHaveProperty('count');
    expect(Array.isArray(result.sourcesNeedingUpdate)).toBe(true);
  });

  test('should handle jurisdiction-specific updates', async ({ request }) => {
    const response = await request.post('/api/tax-updates/manual-update', {
      data: {
        states: ['TX'],
        jurisdiction: 'Austin',
        force: true
      }
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.jurisdiction).toContain('Austin');
  });

  test('should validate tax rate updates accurately', async ({ request }) => {
    // This test would typically involve mocking or using test data
    // For now, we'll test the validation endpoint structure
    
    const response = await request.post('/api/tax-updates/manual-update', {
      data: {
        states: ['CA', 'TX'],
        force: false
      }
    });
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('summary');
    
    if (result.summary) {
      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('valid');
      expect(result.summary).toHaveProperty('invalid');
    }
  });

  test('should handle pending audit reviews', async ({ request }) => {
    const response = await request.get('/api/tax-updates/pending-reviews');
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('pendingReviews');
    expect(result).toHaveProperty('count');
    expect(Array.isArray(result.pendingReviews)).toBe(true);
  });

  test('should filter compliance alerts by severity', async ({ request }) => {
    const response = await request.get('/api/tax-updates/compliance-alerts?severity=critical&days=7');
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('summary');
    
    // All alerts should be critical if filter is working
    if (result.alerts.length > 0) {
      for (const alert of result.alerts) {
        expect(alert.severity).toBe('critical');
      }
    }
  });

  test('should handle state-specific compliance alerts', async ({ request }) => {
    const response = await request.get('/api/tax-updates/compliance-alerts?state=TX&days=30');
    
    expect(response.status()).toBe(200);
    
    const result = await response.json();
    expect(result).toHaveProperty('alerts');
    
    // All alerts should be for Texas if filter is working
    if (result.alerts.length > 0) {
      for (const alert of result.alerts) {
        expect(alert.affectedStates).toContain('TX');
      }
    }
  });
});