import { test, expect } from '@playwright/test';
import { businessTestData } from './fixtures/test-data';

test.describe('API Endpoints', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3001'
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await apiContext.get('/health');
      
      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  test.describe('Business API', () => {
    test('should create a new business', async () => {
      const response = await apiContext.post('/api/business', {
        data: businessTestData.validBusiness
      });

      expect(response.status()).toBe(201);
      const result = await response.json();
      expect(result.businessId).toBe(businessTestData.validBusiness.businessId);
      expect(result.name).toBe(businessTestData.validBusiness.name);
      expect(result.locations).toHaveLength(1);
    });

    test('should retrieve business by ID', async () => {
      const response = await apiContext.get(`/api/business/${businessTestData.validBusiness.businessId}`);

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.businessId).toBe(businessTestData.validBusiness.businessId);
      expect(result.name).toBe(businessTestData.validBusiness.name);
    });

    test('should update business information', async () => {
      const updateData = {
        name: 'Updated Business Name',
        settings: {
          autoSync: false,
          emailNotifications: false
        }
      };

      const response = await apiContext.put(`/api/business/${businessTestData.validBusiness.businessId}`, {
        data: updateData
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.name).toBe('Updated Business Name');
      expect(result.settings.autoSync).toBe(false);
    });

    test('should return 404 for non-existent business', async () => {
      const response = await apiContext.get('/api/business/non-existent-id');
      expect(response.status()).toBe(404);
    });
  });

  test.describe('Transactions API', () => {
    let testTransactionId: string;

    test('should create a new transaction', async () => {
      const transactionData = {
        transactionId: 'test-txn-001',
        source: 'square',
        sourceTransactionId: 'sq-001',
        businessId: businessTestData.validBusiness.businessId,
        locationId: 'loc-002',
        timestamp: new Date().toISOString(),
        subtotal: 100.00,
        totalTax: 8.25,
        grandTotal: 108.25,
        currency: 'USD',
        items: [
          {
            id: 'item-001',
            name: 'Test Product',
            quantity: 1,
            unitPrice: 100.00,
            totalPrice: 100.00,
            taxCategory: 'general',
            taxable: true
          }
        ],
        taxBreakdown: [
          {
            jurisdiction: 'California',
            jurisdictionType: 'state',
            rate: 7.25,
            taxableAmount: 100.00,
            taxAmount: 7.25
          }
        ],
        address: {
          street: '123 Test St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        status: 'completed'
      };

      const response = await apiContext.post('/api/transactions', {
        data: transactionData
      });

      expect(response.status()).toBe(201);
      const result = await response.json();
      expect(result.transactionId).toBe('test-txn-001');
      expect(result.totalTax).toBe(8.25);
      testTransactionId = result.transactionId;
    });

    test('should retrieve transaction by ID', async () => {
      const response = await apiContext.get(`/api/transactions/${testTransactionId}`);

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.transactionId).toBe(testTransactionId);
      expect(result.source).toBe('square');
      expect(result.items).toHaveLength(1);
    });

    test('should list transactions with pagination', async () => {
      // Create additional test transactions
      for (let i = 2; i <= 5; i++) {
        await apiContext.post('/api/transactions', {
          data: {
            transactionId: `test-txn-00${i}`,
            source: 'square',
            sourceTransactionId: `sq-00${i}`,
            businessId: businessTestData.validBusiness.businessId,
            locationId: 'loc-002',
            timestamp: new Date().toISOString(),
            subtotal: 50.00 * i,
            totalTax: 4.12 * i,
            grandTotal: (50.00 + 4.12) * i,
            currency: 'USD',
            items: [],
            taxBreakdown: [],
            address: {
              street: '123 Test St',
              city: 'Los Angeles',
              state: 'CA',
              zipCode: '90210',
              country: 'US'
            },
            status: 'completed'
          }
        });
      }

      const response = await apiContext.get('/api/transactions?limit=3&offset=0');

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.transactions).toHaveLength(3);
      expect(result.pagination.total).toBeGreaterThanOrEqual(5);
      expect(result.pagination.hasMore).toBe(true);
    });

    test('should filter transactions by business ID', async () => {
      const response = await apiContext.get(`/api/transactions?businessId=${businessTestData.validBusiness.businessId}`);

      expect(response.status()).toBe(200);
      const result = await response.json();
      
      result.transactions.forEach((transaction: any) => {
        expect(transaction.businessId).toBe(businessTestData.validBusiness.businessId);
      });
    });

    test('should filter transactions by date range', async () => {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const response = await apiContext.get(
        `/api/transactions?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );

      expect(response.status()).toBe(200);
      const result = await response.json();
      
      result.transactions.forEach((transaction: any) => {
        const txnDate = new Date(transaction.timestamp);
        expect(txnDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(txnDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });
  });

  test.describe('Integration Status API', () => {
    test('should check POS integration status', async () => {
      const response = await apiContext.get('/api/integrations/pos/status');

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.status).toBeDefined();
      expect(result.lastSync).toBeDefined();
    });

    test('should trigger POS sync', async () => {
      const response = await apiContext.post('/api/integrations/pos/sync', {
        data: { businessId: businessTestData.validBusiness.businessId }
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('sync');
    });

    test('should trigger accounting sync', async () => {
      const response = await apiContext.post('/api/integrations/accounting/sync', {
        data: { businessId: businessTestData.validBusiness.businessId }
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('sync');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 routes gracefully', async () => {
      const response = await apiContext.get('/api/non-existent-endpoint');

      expect(response.status()).toBe(404);
      const result = await response.json();
      expect(result.error).toBe('Not Found');
    });

    test('should handle malformed JSON', async () => {
      const response = await apiContext.post('/api/tax/calculate', {
        data: 'invalid-json',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status()).toBe(400);
    });

    test('should enforce rate limiting', async () => {
      // Make many requests quickly to trigger rate limiting
      const requests = Array.from({ length: 150 }, (_, i) => 
        apiContext.get('/health')
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});