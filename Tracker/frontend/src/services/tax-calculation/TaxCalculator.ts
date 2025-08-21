/**
 * Frontend Tax Calculator utility
 * Simplified version for frontend use
 */

export interface TaxCalculationResult {
  totalTax: number;
  breakdown: Array<{
    jurisdiction: string;
    rate: number;
    amount: number;
  }>;
}

export interface TaxCalculationRequest {
  amount: number;
  jurisdiction: string;
  productCategory?: string;
  customerExemptions?: string[];
}

export class TaxCalculator {
  static async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResult> {
    // Frontend implementation - delegates to API
    throw new Error('Tax calculation should be performed via API in frontend');
  }
}

export default TaxCalculator;