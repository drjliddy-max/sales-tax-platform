/**
 * TaxCalculator Unit Tests
 * Note: These tests use mocks to avoid database dependencies
 */

import { TaxCalculator, TaxCalculationRequest } from '../../src/services/tax-calculation';

// Mock dependencies
jest.mock('../../src/models', () => ({
  TaxRate: {
    find: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../../src/services/tax-data-collection/FirecrawlService', () => ({
  FirecrawlService: jest.fn().mockImplementation(() => ({
    crawlSpecificJurisdiction: jest.fn().mockResolvedValue([]),
    updateTaxRatesInDatabase: jest.fn().mockResolvedValue(0),
    collectTaxRateUpdates: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock('../../src/services/redis/TaxRateCacheService', () => ({
  TaxRateCacheService: jest.fn().mockImplementation(() => ({
    getCachedTaxRates: jest.fn().mockResolvedValue(null),
    cacheTaxRates: jest.fn().mockResolvedValue(true),
    invalidateForJurisdiction: jest.fn().mockResolvedValue(true)
  }))
}));

jest.mock('../../src/services/redis/JobQueueService', () => ({
  JobQueueService: {
    getInstance: jest.fn().mockReturnValue({
      addTaxRateUpdateJob: jest.fn().mockResolvedValue({ id: 'job123' }),
      addTaxCalculationJob: jest.fn().mockResolvedValue({ id: 'job456' })
    })
  }
}));

jest.mock('../../src/services/monitoring/SentryService', () => ({
  sentryService: {
    startTransaction: jest.fn().mockReturnValue({
      setAttribute: jest.fn(),
      end: jest.fn()
    }),
    trackTaxCalculationAccuracy: jest.fn(),
    captureFinancialError: jest.fn()
  }
}));

jest.mock('../../src/utils', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('TaxCalculator', () => {
  let calculator: TaxCalculator;

  beforeEach(() => {
    calculator = new TaxCalculator();
    jest.clearAllMocks();
  });

  describe('calculateTax', () => {
    it('should return zero tax for tax-exempt customers', async () => {
      const request: TaxCalculationRequest = {
        items: [
          {
            id: '1',
            name: 'Test Item',
            quantity: 2,
            unitPrice: 10.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        customerTaxExempt: true
      };

      const result = await calculator.calculateTax(request);

      expect(result.totalTax).toBe(0);
      expect(result.subtotal).toBe(20.00);
      expect(result.grandTotal).toBe(20.00);
      expect(result.taxBreakdown).toHaveLength(0);
    });

    it('should calculate subtotal correctly for multiple items', async () => {
      const request: TaxCalculationRequest = {
        items: [
          {
            id: '1',
            name: 'Item 1',
            quantity: 2,
            unitPrice: 10.00,
            taxCategory: 'general'
          },
          {
            id: '2',
            name: 'Item 2',
            quantity: 1,
            unitPrice: 15.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        customerTaxExempt: true // Use tax exempt to avoid complex tax calculation logic
      };

      const result = await calculator.calculateTax(request);

      expect(result.subtotal).toBe(35.00);
      expect(result.itemBreakdown).toHaveLength(2);
      expect(result.itemBreakdown[0].subtotal).toBe(20.00);
      expect(result.itemBreakdown[1].subtotal).toBe(15.00);
    });

    it('should handle empty items array', async () => {
      const request: TaxCalculationRequest = {
        items: [],
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        customerTaxExempt: true
      };

      const result = await calculator.calculateTax(request);

      expect(result.subtotal).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.grandTotal).toBe(0);
      expect(result.itemBreakdown).toHaveLength(0);
    });

    it('should handle single item calculation', async () => {
      const request: TaxCalculationRequest = {
        items: [
          {
            id: '1',
            name: 'Single Item',
            quantity: 1,
            unitPrice: 25.99,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        customerTaxExempt: true
      };

      const result = await calculator.calculateTax(request);

      expect(result.subtotal).toBe(25.99);
      expect(result.itemBreakdown).toHaveLength(1);
      expect(result.itemBreakdown[0].id).toBe('1');
      expect(result.itemBreakdown[0].subtotal).toBe(25.99);
    });
  });

  describe('edge cases', () => {
    it('should handle zero quantity items', async () => {
      const request: TaxCalculationRequest = {
        items: [
          {
            id: '1',
            name: 'Zero Quantity Item',
            quantity: 0,
            unitPrice: 10.00,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        customerTaxExempt: true
      };

      const result = await calculator.calculateTax(request);

      expect(result.subtotal).toBe(0);
    });

    it('should handle zero price items', async () => {
      const request: TaxCalculationRequest = {
        items: [
          {
            id: '1',
            name: 'Free Item',
            quantity: 5,
            unitPrice: 0,
            taxCategory: 'general'
          }
        ],
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        },
        customerTaxExempt: true
      };

      const result = await calculator.calculateTax(request);

      expect(result.subtotal).toBe(0);
    });
  });
});
