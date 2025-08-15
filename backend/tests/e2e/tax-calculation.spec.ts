import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import { taxCalculationTestCases } from './fixtures/test-data';

test.describe('Tax Calculation Accuracy', () => {
  let apiContext: any;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3001'
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  for (const testCase of taxCalculationTestCases) {
    test(`should calculate correct tax for ${testCase.name}`, async () => {
      const response = await apiContext.post('/api/tax/calculate', {
        data: testCase.request
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      // Verify subtotal calculation
      expect(result.subtotal).toBeCloseTo(testCase.expectedSubtotal, 2);
      
      // Verify tax calculation
      expect(result.totalTax).toBeCloseTo(testCase.expectedTax, 2);
      
      // Verify grand total
      expect(result.grandTotal).toBeCloseTo(testCase.expectedTotal, 2);

      // Verify tax breakdown structure
      if (testCase.expectedTax > 0) {
        expect(result.taxBreakdown).toBeDefined();
        expect(result.taxBreakdown.length).toBeGreaterThan(0);
        
        // Verify tax breakdown totals match
        const breakdownTotal = result.taxBreakdown.reduce(
          (sum: number, tax: any) => sum + tax.taxAmount, 0
        );
        expect(breakdownTotal).toBeCloseTo(testCase.expectedTax, 2);
      } else {
        expect(result.taxBreakdown).toHaveLength(0);
      }

      // Verify item breakdown
      expect(result.itemBreakdown).toBeDefined();
      expect(result.itemBreakdown.length).toBe(testCase.request.items.length);
    });
  }

  test('should handle invalid address gracefully', async () => {
    const invalidRequest = {
      items: [
        {
          id: 'item-001',
          name: 'Test Item',
          quantity: 1,
          unitPrice: 100.00,
          taxCategory: 'general'
        }
      ],
      address: {
        street: '123 Invalid St',
        city: 'Invalid City',
        state: 'XX', // Invalid state
        zipCode: '00000',
        country: 'US'
      }
    };

    const response = await apiContext.post('/api/tax/calculate', {
      data: invalidRequest
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    
    // Should still return a valid calculation (even if tax is 0)
    expect(result.subtotal).toBe(100.00);
    expect(result.totalTax).toBeGreaterThanOrEqual(0);
    expect(result.grandTotal).toBe(result.subtotal + result.totalTax);
  });

  test('should validate required fields', async () => {
    const invalidRequest = {
      items: [], // Empty items array
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'CA',
        zipCode: '90210',
        country: 'US'
      }
    };

    const response = await apiContext.post('/api/tax/calculate', {
      data: invalidRequest
    });

    expect(response.status()).toBe(400);
    const result = await response.json();
    expect(result.error).toBe('Validation Error');
  });

  test('should handle multi-item transactions correctly', async () => {
    const multiItemRequest = {
      items: [
        {
          id: 'item-001',
          name: 'Taxable Item 1',
          quantity: 2,
          unitPrice: 25.00,
          taxCategory: 'general'
        },
        {
          id: 'item-002',
          name: 'Taxable Item 2',
          quantity: 1,
          unitPrice: 75.00,
          taxCategory: 'general'
        },
        {
          id: 'item-003',
          name: 'Food Item',
          quantity: 3,
          unitPrice: 10.00,
          taxCategory: 'food'
        }
      ],
      address: {
        street: '123 Multi St',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90210',
        country: 'US'
      }
    };

    const response = await apiContext.post('/api/tax/calculate', {
      data: multiItemRequest
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    // Subtotal: (2 * $25) + (1 * $75) + (3 * $10) = $155
    expect(result.subtotal).toBe(155.00);
    
    // Tax only on general items: ($50 + $75) * 8.25% = $10.31
    expect(result.totalTax).toBeCloseTo(10.31, 2);
    
    // Total: $155 + $10.31 = $165.31
    expect(result.grandTotal).toBeCloseTo(165.31, 2);

    // Verify item breakdown
    expect(result.itemBreakdown).toHaveLength(3);
    expect(result.itemBreakdown[0].subtotal).toBe(50.00); // 2 * $25
    expect(result.itemBreakdown[1].subtotal).toBe(75.00); // 1 * $75
    expect(result.itemBreakdown[2].subtotal).toBe(30.00); // 3 * $10
  });

  test('should handle edge case amounts correctly', async () => {
    const edgeCaseRequest = {
      items: [
        {
          id: 'item-001',
          name: 'Penny Item',
          quantity: 1,
          unitPrice: 0.01,
          taxCategory: 'general'
        }
      ],
      address: {
        street: '123 Penny Lane',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90210',
        country: 'US'
      }
    };

    const response = await apiContext.post('/api/tax/calculate', {
      data: edgeCaseRequest
    });

    expect(response.status()).toBe(200);
    const result = await response.json();

    expect(result.subtotal).toBe(0.01);
    expect(result.totalTax).toBeGreaterThanOrEqual(0);
    expect(result.grandTotal).toBeGreaterThanOrEqual(0.01);
  });
});