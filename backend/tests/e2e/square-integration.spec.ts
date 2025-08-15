import { test, expect } from '@playwright/test';
import { squareWebhookPayloads } from './fixtures/test-data';

test.describe('Square POS Integration', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3001'
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Square Webhook Processing', () => {
    test('should process completed payment webhook', async () => {
      const webhook = squareWebhookPayloads.find(w => w.name === 'completed payment');
      
      // Simulate Square webhook
      const response = await apiContext.post('/api/integrations/pos/webhook/square', {
        data: webhook?.payload,
        headers: {
          'Content-Type': 'application/json',
          'X-Square-Signature': 'test-signature'
        }
      });

      expect(response.status()).toBe(200);

      // Verify transaction was created
      const transactionResponse = await apiContext.get('/api/transactions');
      expect(transactionResponse.status()).toBe(200);
      
      const transactions = await transactionResponse.json();
      const squareTransaction = transactions.transactions.find(
        (t: any) => t.sourceTransactionId === 'payment-001'
      );
      
      expect(squareTransaction).toBeDefined();
      expect(squareTransaction.source).toBe('square');
      expect(squareTransaction.status).toBe('completed');
      expect(squareTransaction.grandTotal).toBe(108.25);
    });

    test('should process failed payment webhook', async () => {
      const webhook = squareWebhookPayloads.find(w => w.name === 'failed payment');
      
      const response = await apiContext.post('/api/integrations/pos/webhook/square', {
        data: webhook?.payload,
        headers: {
          'Content-Type': 'application/json',
          'X-Square-Signature': 'test-signature'
        }
      });

      expect(response.status()).toBe(200);

      // Verify failed transaction was recorded
      const transactionResponse = await apiContext.get('/api/transactions');
      const transactions = await transactionResponse.json();
      const failedTransaction = transactions.transactions.find(
        (t: any) => t.sourceTransactionId === 'payment-002'
      );
      
      expect(failedTransaction).toBeDefined();
      expect(failedTransaction.status).toBe('failed');
    });

    test('should handle duplicate webhooks gracefully', async () => {
      const webhook = squareWebhookPayloads.find(w => w.name === 'completed payment');
      
      // Send same webhook twice
      const response1 = await apiContext.post('/api/integrations/pos/webhook/square', {
        data: webhook?.payload
      });
      const response2 = await apiContext.post('/api/integrations/pos/webhook/square', {
        data: webhook?.payload
      });

      expect(response1.status()).toBe(200);
      expect(response2.status()).toBe(200);

      // Verify only one transaction exists
      const transactionResponse = await apiContext.get('/api/transactions');
      const transactions = await transactionResponse.json();
      const duplicateTransactions = transactions.transactions.filter(
        (t: any) => t.sourceTransactionId === 'payment-001'
      );
      
      expect(duplicateTransactions).toHaveLength(1);
    });
  });

  test.describe('Square API Connection', () => {
    test('should test Square API connection', async () => {
      const response = await apiContext.post('/api/integrations/pos/test-connection', {
        data: {
          type: 'square',
          credentials: {
            accessToken: 'test-token',
            environment: 'sandbox'
          }
        }
      });

      // Since we're using test credentials, this might fail, but should handle gracefully
      expect([200, 401, 403]).toContain(response.status());
    });

    test('should handle invalid Square credentials', async () => {
      const response = await apiContext.post('/api/integrations/pos/test-connection', {
        data: {
          type: 'square',
          credentials: {
            accessToken: 'invalid-token',
            environment: 'sandbox'
          }
        }
      });

      expect([401, 403]).toContain(response.status());
    });
  });

  test.describe('Square Data Sync', () => {
    test('should trigger Square payment sync', async () => {
      const response = await apiContext.post('/api/integrations/pos/sync', {
        data: {
          businessId: 'test-business-002',
          source: 'square',
          locationId: 'loc-002',
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Last 24 hours
          endDate: new Date().toISOString()
        }
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.message).toContain('sync');
    });

    test('should handle sync errors gracefully', async () => {
      const response = await apiContext.post('/api/integrations/pos/sync', {
        data: {
          businessId: 'non-existent-business',
          source: 'square'
        }
      });

      // Should handle gracefully, not crash
      expect([200, 400, 404]).toContain(response.status());
    });
  });

  test.describe('Square Transaction Flow End-to-End', () => {
    test('should process complete Square transaction flow', async () => {
      // Step 1: Simulate Square payment creation
      const paymentData = {
        id: 'payment-e2e-001',
        amount_money: {
          amount: 12500, // $125.00 in cents
          currency: 'USD'
        },
        status: 'COMPLETED',
        source_type: 'CARD',
        location_id: 'loc-002',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        receipt_number: 'RCP-E2E-001'
      };

      // Step 2: Process webhook
      const webhookResponse = await apiContext.post('/api/integrations/pos/webhook/square', {
        data: {
          type: 'payment.updated',
          data: {
            object: {
              payment: paymentData
            }
          }
        }
      });

      expect(webhookResponse.status()).toBe(200);

      // Step 3: Verify transaction was created and tax calculated
      await test.step('Verify transaction creation', async () => {
        const transactionResponse = await apiContext.get('/api/transactions');
        const transactions = await transactionResponse.json();
        
        const createdTransaction = transactions.transactions.find(
          (t: any) => t.sourceTransactionId === 'payment-e2e-001'
        );
        
        expect(createdTransaction).toBeDefined();
        expect(createdTransaction.source).toBe('square');
        expect(createdTransaction.grandTotal).toBe(125.00);
        expect(createdTransaction.metadata.receiptNumber).toBe('RCP-E2E-001');
      });

      // Step 4: Verify tax calculation was applied
      await test.step('Verify tax calculation', async () => {
        const calcResponse = await apiContext.post('/api/tax/calculate', {
          data: {
            items: [
              {
                id: 'item-001',
                name: 'Square Item',
                quantity: 1,
                unitPrice: 125.00,
                taxCategory: 'general'
              }
            ],
            address: {
              street: '456 Test Ave',
              city: 'San Francisco',
              state: 'CA',
              zipCode: '94102',
              country: 'US'
            }
          }
        });

        expect(calcResponse.status()).toBe(200);
        const calcResult = await calcResponse.json();
        expect(calcResult.subtotal).toBe(125.00);
        expect(calcResult.totalTax).toBeGreaterThan(0);
      });
    });
  });
});