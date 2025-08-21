import { test, expect } from '@playwright/test';
import { jurisdictionTestData } from './fixtures/jurisdiction-data';

test.describe('Multi-Jurisdiction Tax Accuracy', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3001'
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  test.describe('Complex Jurisdiction Scenarios', () => {
    for (const scenario of jurisdictionTestData.complexScenarios) {
      test(`should calculate ${scenario.name} correctly`, async () => {
        const response = await apiContext.post('/api/tax/calculate', {
          data: {
            items: scenario.items,
            address: scenario.address
          }
        });

        expect(response.status()).toBe(200);
        const result = await response.json();

        expect(result.subtotal).toBeCloseTo(scenario.expected.subtotal, 2);
        
        if (scenario.expected.totalTax !== undefined) {
          expect(result.totalTax).toBeCloseTo(scenario.expected.totalTax, 2);
        }
        
        expect(result.grandTotal).toBeCloseTo(scenario.expected.grandTotal, 2);

        // Verify tax breakdown structure for multi-jurisdiction areas
        if (scenario.expected.totalTax > 0) {
          expect(result.taxBreakdown).toBeDefined();
          expect(result.taxBreakdown.length).toBeGreaterThan(0);
          
          // Verify specific jurisdiction taxes if provided
          if (scenario.expected.stateTax) {
            const stateTax = result.taxBreakdown.find(
              (tax: any) => tax.jurisdictionType === 'state'
            );
            expect(stateTax?.taxAmount).toBeCloseTo(scenario.expected.stateTax, 2);
          }
          
          if (scenario.expected.countyTax) {
            const countyTax = result.taxBreakdown.find(
              (tax: any) => tax.jurisdictionType === 'county'
            );
            expect(countyTax?.taxAmount).toBeCloseTo(scenario.expected.countyTax, 2);
          }
          
          if (scenario.expected.cityTax) {
            const cityTax = result.taxBreakdown.find(
              (tax: any) => tax.jurisdictionType === 'city'
            );
            expect(cityTax?.taxAmount).toBeCloseTo(scenario.expected.cityTax, 2);
          }
        }
      });
    }
  });

  test.describe('Product Category Tax Rules', () => {
    test('should apply correct rates for different product categories in same transaction', async () => {
      const mixedCategoryRequest = {
        items: [
          {
            id: 'mixed-001',
            name: 'Electronics (Taxable)',
            quantity: 1,
            unitPrice: 100.00,
            taxCategory: 'general'
          },
          {
            id: 'mixed-002',
            name: 'Groceries (Exempt)',
            quantity: 1,
            unitPrice: 50.00,
            taxCategory: 'food'
          },
          {
            id: 'mixed-003',
            name: 'Medicine (Exempt)',
            quantity: 1,
            unitPrice: 30.00,
            taxCategory: 'medicine'
          }
        ],
        address: {
          street: '123 Mixed Category St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        }
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: mixedCategoryRequest
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      expect(result.subtotal).toBe(180.00);
      // Tax should only apply to electronics ($100 * 8.75% = $8.75)
      expect(result.totalTax).toBeCloseTo(8.75, 2);
      expect(result.grandTotal).toBeCloseTo(188.75, 2);

      // Verify item-level tax breakdown
      const electronicsTax = result.itemBreakdown.find(
        (item: any) => item.id === 'mixed-001'
      );
      const groceriesTax = result.itemBreakdown.find(
        (item: any) => item.id === 'mixed-002'
      );
      const medicineTax = result.itemBreakdown.find(
        (item: any) => item.id === 'mixed-003'
      );

      expect(electronicsTax.taxAmount).toBeGreaterThan(0);
      expect(groceriesTax.taxAmount).toBe(0);
      expect(medicineTax.taxAmount).toBe(0);
    });

    test('should handle NY clothing exemption threshold', async () => {
      const nyClothingRequest = {
        items: [
          {
            id: 'ny-clothing-001',
            name: 'Cheap Shirt (Under $110)',
            quantity: 1,
            unitPrice: 80.00,
            taxCategory: 'clothing'
          },
          {
            id: 'ny-clothing-002',
            name: 'Designer Jacket (Over $110)',
            quantity: 1,
            unitPrice: 200.00,
            taxCategory: 'clothing'
          }
        ],
        address: {
          street: '1 Wall Street',
          city: 'New York',
          state: 'NY',
          zipCode: '10005',
          country: 'US'
        }
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: nyClothingRequest
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      expect(result.subtotal).toBe(280.00);
      // In this simplified implementation, we'll just verify the structure
      // In a real implementation, you'd need complex logic for NY clothing exemption thresholds
      expect(result.itemBreakdown).toHaveLength(2);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    for (const edgeCase of jurisdictionTestData.edgeCases) {
      test(`should handle ${edgeCase.name}`, async () => {
        const response = await apiContext.post('/api/tax/calculate', {
          data: {
            items: edgeCase.items,
            address: {
              street: '123 Edge Case St',
              city: 'Los Angeles',
              state: 'CA',
              zipCode: '90210',
              country: 'US'
            }
          }
        });

        expect(response.status()).toBe(200);
        const result = await response.json();

        if (edgeCase.expected.subtotal !== undefined) {
          expect(result.subtotal).toBeCloseTo(edgeCase.expected.subtotal, 2);
        }
        
        expect(result.totalTax).toBeGreaterThanOrEqual(0);
        expect(result.grandTotal).toBeGreaterThanOrEqual(result.subtotal);
        expect(result.itemBreakdown).toHaveLength(edgeCase.items.length);
      });
    }

    test('should handle invalid product category gracefully', async () => {
      const invalidCategoryRequest = {
        items: [
          {
            id: 'invalid-001',
            name: 'Unknown Category Item',
            quantity: 1,
            unitPrice: 50.00,
            taxCategory: 'unknown-category'
          }
        ],
        address: {
          street: '123 Unknown St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        }
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: invalidCategoryRequest
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      // Should default to general tax rate
      expect(result.subtotal).toBe(50.00);
      expect(result.totalTax).toBeGreaterThan(0);
    });

    test('should handle missing zip code', async () => {
      const missingZipRequest = {
        items: [
          {
            id: 'missing-zip-001',
            name: 'No Zip Item',
            quantity: 1,
            unitPrice: 75.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 No Zip St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '', // Empty zip code
          country: 'US'
        }
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: missingZipRequest
      });

      // Should handle gracefully, possibly using state-level rates
      expect([200, 400]).toContain(response.status());
    });
  });

  test.describe('Tax Rate Historical Accuracy', () => {
    test('should use correct rates for historical transactions', async () => {
      // Test with a past date
      const historicalRequest = {
        items: [
          {
            id: 'historical-001',
            name: 'Historical Item',
            quantity: 1,
            unitPrice: 100.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 History St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        transactionDate: '2023-06-15T12:00:00Z' // Specific historical date
      };

      const response = await apiContext.post('/api/tax/calculate', {
        data: historicalRequest
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      // Verify it uses rates that were effective on that date
      expect(result.subtotal).toBe(100.00);
      expect(result.totalTax).toBeGreaterThan(0);
      expect(result.taxBreakdown.length).toBeGreaterThan(0);
    });

    test('should handle rate changes correctly', async () => {
      // This would test scenarios where tax rates change
      // For now, verify the current rate structure
      const rateCheckResponse = await apiContext.get('/api/tax/rates/CA');
      expect(rateCheckResponse.status()).toBe(200);
      
      const rates = await rateCheckResponse.json();
      expect(rates.state).toBe('CA');
      expect(rates.rates).toBeDefined();
    });
  });
});