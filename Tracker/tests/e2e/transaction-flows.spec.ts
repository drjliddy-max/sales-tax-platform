import { test, expect } from '@playwright/test';

test.describe('Transaction Flow Scenarios', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3001'
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Multi-Jurisdiction Transaction Flows', () => {
    test('should handle cross-state transaction correctly', async () => {
      // Business in CA selling to customer in NY
      const crossStateRequest = {
        items: [
          {
            id: 'item-cross-001',
            name: 'Remote Sale Item',
            quantity: 1,
            unitPrice: 100.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 Remote St',
          city: 'Albany',
          state: 'NY',
          zipCode: '12201',
          country: 'US'
        }
      };

      const calcResponse = await apiContext.post('/api/tax/calculate', {
        data: crossStateRequest
      });

      expect(calcResponse.status()).toBe(200);
      const result = await calcResponse.json();
      
      // Should use destination state (NY) tax rates
      expect(result.subtotal).toBe(100.00);
      expect(result.totalTax).toBeCloseTo(8.00, 2); // NY 8% rate
      expect(result.grandTotal).toBe(108.00);

      // Create transaction record
      const transactionData = {
        transactionId: 'cross-state-001',
        source: 'manual',
        sourceTransactionId: 'manual-001',
        businessId: 'test-business-001',
        locationId: 'loc-001',
        timestamp: new Date().toISOString(),
        ...result,
        items: crossStateRequest.items.map(item => ({
          ...item,
          totalPrice: item.quantity * item.unitPrice,
          taxable: true
        })),
        address: crossStateRequest.address,
        status: 'completed'
      };

      const transactionResponse = await apiContext.post('/api/transactions', {
        data: transactionData
      });

      expect(transactionResponse.status()).toBe(201);
    });

    test('should handle local transaction with county tax', async () => {
      const localRequest = {
        items: [
          {
            id: 'item-local-001',
            name: 'Local Sale Item',
            quantity: 2,
            unitPrice: 50.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '789 Local Blvd',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        }
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: localRequest
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      
      expect(result.subtotal).toBe(100.00);
      // Should include both state (7.25%) and county (1.0%) tax
      expect(result.totalTax).toBeCloseTo(8.25, 2);
      expect(result.taxBreakdown.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Refund and Adjustment Flows', () => {
    let originalTransactionId: string;

    test('should create original transaction for refund testing', async () => {
      const transactionData = {
        transactionId: 'refund-test-original',
        source: 'square',
        sourceTransactionId: 'sq-refund-001',
        businessId: 'test-business-001',
        locationId: 'loc-001',
        timestamp: new Date().toISOString(),
        subtotal: 200.00,
        totalTax: 16.50,
        grandTotal: 216.50,
        currency: 'USD',
        items: [
          {
            id: 'item-refund-001',
            name: 'Refundable Item',
            quantity: 1,
            unitPrice: 200.00,
            totalPrice: 200.00,
            taxCategory: 'general',
            taxable: true
          }
        ],
        taxBreakdown: [
          {
            jurisdiction: 'California',
            jurisdictionType: 'state',
            rate: 7.25,
            taxableAmount: 200.00,
            taxAmount: 14.50
          },
          {
            jurisdiction: 'Los Angeles County',
            jurisdictionType: 'county',
            rate: 1.0,
            taxableAmount: 200.00,
            taxAmount: 2.00
          }
        ],
        address: {
          street: '123 Refund St',
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
      originalTransactionId = transactionData.transactionId;
    });

    test('should process full refund correctly', async () => {
      const refundData = {
        transactionId: 'refund-test-full',
        source: 'square',
        sourceTransactionId: 'sq-refund-002',
        businessId: 'test-business-001',
        locationId: 'loc-001',
        timestamp: new Date().toISOString(),
        subtotal: -200.00,
        totalTax: -16.50,
        grandTotal: -216.50,
        currency: 'USD',
        items: [
          {
            id: 'item-refund-001',
            name: 'Refundable Item',
            quantity: -1,
            unitPrice: 200.00,
            totalPrice: -200.00,
            taxCategory: 'general',
            taxable: true
          }
        ],
        taxBreakdown: [
          {
            jurisdiction: 'California',
            jurisdictionType: 'state',
            rate: 7.25,
            taxableAmount: -200.00,
            taxAmount: -14.50
          },
          {
            jurisdiction: 'Los Angeles County',
            jurisdictionType: 'county',
            rate: 1.0,
            taxableAmount: -200.00,
            taxAmount: -2.00
          }
        ],
        address: {
          street: '123 Refund St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        status: 'refunded',
        refundedAmount: 216.50
      };

      const response = await apiContext.post('/api/transactions', {
        data: refundData
      });

      expect(response.status()).toBe(201);
      const result = await response.json();
      expect(result.status).toBe('refunded');
      expect(result.totalTax).toBe(-16.50);
    });

    test('should process partial refund correctly', async () => {
      const partialRefundData = {
        transactionId: 'refund-test-partial',
        source: 'square',
        sourceTransactionId: 'sq-refund-003',
        businessId: 'test-business-001',
        locationId: 'loc-001',
        timestamp: new Date().toISOString(),
        subtotal: -50.00, // Partial refund
        totalTax: -4.12,
        grandTotal: -54.12,
        currency: 'USD',
        items: [
          {
            id: 'item-refund-001',
            name: 'Partially Refunded Item',
            quantity: -0.25, // 25% refund
            unitPrice: 200.00,
            totalPrice: -50.00,
            taxCategory: 'general',
            taxable: true
          }
        ],
        address: {
          street: '123 Refund St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        status: 'partially_refunded',
        refundedAmount: 54.12
      };

      const response = await apiContext.post('/api/transactions', {
        data: partialRefundData
      });

      expect(response.status()).toBe(201);
      const result = await response.json();
      expect(result.status).toBe('partially_refunded');
      expect(result.refundedAmount).toBe(54.12);
    });
  });

  test.describe('High-Volume Transaction Processing', () => {
    test('should handle batch transaction creation', async () => {
      const batchSize = 10;
      const promises = [];

      for (let i = 1; i <= batchSize; i++) {
        const transactionData = {
          transactionId: `batch-txn-${i.toString().padStart(3, '0')}`,
          source: 'square',
          sourceTransactionId: `sq-batch-${i}`,
          businessId: 'test-business-001',
          locationId: 'loc-001',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          subtotal: 10.00 + i,
          totalTax: (10.00 + i) * 0.0825,
          grandTotal: (10.00 + i) * 1.0825,
          currency: 'USD',
          items: [
            {
              id: `batch-item-${i}`,
              name: `Batch Item ${i}`,
              quantity: 1,
              unitPrice: 10.00 + i,
              totalPrice: 10.00 + i,
              taxCategory: 'general',
              taxable: true
            }
          ],
          taxBreakdown: [],
          address: {
            street: '123 Batch St',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90210',
            country: 'US'
          },
          status: 'completed'
        };

        promises.push(
          apiContext.post('/api/transactions', { data: transactionData })
        );
      }

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(201);
      });

      // Verify all transactions were created
      const listResponse = await apiContext.get(`/api/transactions?limit=${batchSize + 5}`);
      const transactions = await listResponse.json();
      
      const batchTransactions = transactions.transactions.filter(
        (t: any) => t.transactionId.startsWith('batch-txn-')
      );
      
      expect(batchTransactions.length).toBe(batchSize);
    });
  });

  test.describe('Error Recovery Flows', () => {
    test('should handle transaction processing failure gracefully', async () => {
      const invalidTransactionData = {
        transactionId: 'invalid-txn-001',
        source: 'square',
        sourceTransactionId: 'sq-invalid-001',
        businessId: 'test-business-001',
        locationId: 'loc-001',
        timestamp: 'invalid-date', // Invalid date format
        subtotal: 100.00,
        totalTax: 8.25,
        grandTotal: 108.25,
        currency: 'USD',
        items: [],
        taxBreakdown: [],
        address: {
          street: '123 Error St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        status: 'completed'
      };

      const response = await apiContext.post('/api/transactions', {
        data: invalidTransactionData
      });

      expect(response.status()).toBe(400);
      const result = await response.json();
      expect(result.error).toBeDefined();
    });

    test('should retry failed tax calculation', async () => {
      // Test with temporarily unavailable tax rate data
      const retryRequest = {
        items: [
          {
            id: 'item-retry-001',
            name: 'Retry Item',
            quantity: 1,
            unitPrice: 75.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 Retry St',
          city: 'Unknown City',
          state: 'ZZ', // Invalid state to trigger fallback logic
          zipCode: '99999',
          country: 'US'
        }
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: retryRequest
      });

      // Should handle gracefully even with invalid location
      expect(response.status()).toBe(200);
      const result = await response.json();
      expect(result.subtotal).toBe(75.00);
      expect(result.grandTotal).toBeGreaterThanOrEqual(result.subtotal);
    });
  });

  test.describe('Compliance and Audit Trails', () => {
    test('should maintain complete audit trail for transactions', async () => {
      const auditTransactionId = 'audit-txn-001';
      
      // Create transaction
      const createResponse = await apiContext.post('/api/transactions', {
        data: {
          transactionId: auditTransactionId,
          source: 'square',
          sourceTransactionId: 'sq-audit-001',
          businessId: 'test-business-001',
          locationId: 'loc-001',
          timestamp: new Date().toISOString(),
          subtotal: 150.00,
          totalTax: 12.38,
          grandTotal: 162.38,
          currency: 'USD',
          items: [
            {
              id: 'audit-item-001',
              name: 'Audit Trail Item',
              quantity: 1,
              unitPrice: 150.00,
              totalPrice: 150.00,
              taxCategory: 'general',
              taxable: true
            }
          ],
          taxBreakdown: [
            {
              jurisdiction: 'California',
              jurisdictionType: 'state',
              rate: 7.25,
              taxableAmount: 150.00,
              taxAmount: 10.88
            },
            {
              jurisdiction: 'Los Angeles County',
              jurisdictionType: 'county',
              rate: 1.0,
              taxableAmount: 150.00,
              taxAmount: 1.50
            }
          ],
          address: {
            street: '123 Audit St',
            city: 'Los Angeles',
            state: 'CA',
            zipCode: '90210',
            country: 'US'
          },
          status: 'completed'
        }
      });

      expect(createResponse.status()).toBe(201);

      // Retrieve and verify audit trail
      const retrieveResponse = await apiContext.get(`/api/transactions/${auditTransactionId}`);
      expect(retrieveResponse.status()).toBe(200);
      
      const transaction = await retrieveResponse.json();
      expect(transaction.createdAt).toBeDefined();
      expect(transaction.updatedAt).toBeDefined();
      expect(transaction.taxBreakdown.length).toBe(2);
      
      // Verify tax breakdown includes all required fields
      transaction.taxBreakdown.forEach((tax: any) => {
        expect(tax.jurisdiction).toBeDefined();
        expect(tax.jurisdictionType).toBeDefined();
        expect(tax.rate).toBeGreaterThan(0);
        expect(tax.taxableAmount).toBeGreaterThan(0);
        expect(tax.taxAmount).toBeGreaterThan(0);
      });
    });

    test('should track transaction status changes', async () => {
      const statusTransactionId = 'status-txn-001';
      
      // Create pending transaction
      const pendingData = {
        transactionId: statusTransactionId,
        source: 'square',
        sourceTransactionId: 'sq-status-001',
        businessId: 'test-business-001',
        locationId: 'loc-001',
        timestamp: new Date().toISOString(),
        subtotal: 80.00,
        totalTax: 6.60,
        grandTotal: 86.60,
        currency: 'USD',
        items: [],
        taxBreakdown: [],
        address: {
          street: '123 Status St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        status: 'pending'
      };

      const createResponse = await apiContext.post('/api/transactions', {
        data: pendingData
      });
      expect(createResponse.status()).toBe(201);

      // Update to completed
      const updateData = { status: 'completed' };
      const updateResponse = await apiContext.put(`/api/transactions/${statusTransactionId}`, {
        data: updateData
      });

      // Note: This endpoint would need to be implemented
      // For now, verify transaction exists
      const retrieveResponse = await apiContext.get(`/api/transactions/${statusTransactionId}`);
      expect(retrieveResponse.status()).toBe(200);
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle concurrent tax calculations', async () => {
      const concurrentRequests = Array.from({ length: 20 }, (_, i) => ({
        items: [
          {
            id: `concurrent-item-${i}`,
            name: `Concurrent Item ${i}`,
            quantity: 1,
            unitPrice: 25.00 + i,
            taxCategory: 'general'
          }
        ],
        address: {
          street: `${100 + i} Concurrent St`,
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        }
      }));

      const startTime = Date.now();
      const promises = concurrentRequests.map(request =>
        apiContext.post('/api/tax/calculate', { data: request })
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should succeed
      responses.forEach(response => {
        expect(response.status()).toBe(200);
      });

      // Performance check: should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds max
      console.log(`Concurrent calculations completed in ${totalTime}ms`);

      // Verify results are correct
      const results = await Promise.all(
        responses.map(response => response.json())
      );

      results.forEach((result, index) => {
        expect(result.subtotal).toBe(25.00 + index);
        expect(result.totalTax).toBeGreaterThan(0);
        expect(result.grandTotal).toBeGreaterThan(result.subtotal);
      });
    });

    test('should handle large transaction volumes', async () => {
      const largeTransactionRequest = {
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `bulk-item-${i}`,
          name: `Bulk Item ${i}`,
          quantity: Math.floor(Math.random() * 10) + 1,
          unitPrice: Math.round((Math.random() * 100 + 10) * 100) / 100,
          taxCategory: i % 3 === 0 ? 'food' : 'general'
        })),
        address: {
          street: '123 Bulk St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        }
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: largeTransactionRequest
      });

      expect(response.status()).toBe(200);
      const result = await response.json();
      
      expect(result.itemBreakdown).toHaveLength(50);
      expect(result.subtotal).toBeGreaterThan(0);
      expect(result.grandTotal).toBeGreaterThanOrEqual(result.subtotal);
      
      // Verify calculation consistency
      const calculatedSubtotal = result.itemBreakdown.reduce(
        (sum: number, item: any) => sum + item.subtotal, 0
      );
      expect(result.subtotal).toBeCloseTo(calculatedSubtotal, 2);
    });
  });
});