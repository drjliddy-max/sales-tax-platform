import { TaxCalculator, TaxCalculationRequest } from '@/services/tax-calculation';

describe('TaxCalculator', () => {
  let calculator: TaxCalculator;

  beforeEach(() => {
    calculator = new TaxCalculator();
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

    it('should calculate subtotal correctly', async () => {
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
        }
      };

      const result = await calculator.calculateTax(request);

      expect(result.subtotal).toBe(35.00);
    });
  });
});