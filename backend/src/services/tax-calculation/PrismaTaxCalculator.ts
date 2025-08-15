import prisma from '@/lib/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface TaxCalculationRequest {
  amount: number;
  businessId: string;
  saleLocation: string;
  customerLocation?: string;
  productCategory?: string;
  customerType?: 'RETAIL' | 'WHOLESALE' | 'EXEMPT';
  exemptionReason?: string;
  transactionDate?: Date;
}

export interface TaxBreakdown {
  federalTax: number;
  stateTax: number;
  countyTax: number;
  cityTax: number;
  specialDistrictTax: number;
  totalTax: number;
  effectiveRate: number;
  jurisdictions: JurisdictionTax[];
}

export interface JurisdictionTax {
  jurisdiction: string;
  jurisdictionCode: string;
  taxType: string;
  rate: number;
  amount: number;
  description?: string;
}

export class PrismaTaxCalculator {
  async calculateTax(request: TaxCalculationRequest): Promise<TaxBreakdown> {
    try {
      // Validate business exists and get nexus information
      const business = await prisma.business.findUnique({
        where: { id: request.businessId },
        select: { nexusStates: true, state: true }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      // Check if customer is exempt
      if (request.customerType === 'EXEMPT') {
        return this.createExemptBreakdown();
      }

      // Determine applicable jurisdictions based on sale location and nexus
      const saleState = this.extractStateFromLocation(request.saleLocation);
      const hasNexus = business.nexusStates.includes(saleState) || business.state === saleState;

      if (!hasNexus) {
        return this.createExemptBreakdown();
      }

      // Get applicable tax rates
      const taxRates = await this.getApplicableTaxRates(
        request.saleLocation,
        request.productCategory,
        request.transactionDate || new Date()
      );

      // Calculate taxes by jurisdiction
      const breakdown = this.calculateTaxBreakdown(request.amount, taxRates);

      return breakdown;
    } catch (error) {
      console.error('Tax calculation error:', error);
      throw new Error('Failed to calculate tax');
    }
  }

  private async getApplicableTaxRates(
    location: string,
    productCategory?: string,
    transactionDate: Date = new Date()
  ) {
    const locationParts = this.parseLocation(location);
    
    return await prisma.taxRate.findMany({
      where: {
        isActive: true,
        effectiveDate: { lte: transactionDate },
        OR: [
          { expirationDate: null },
          { expirationDate: { gte: transactionDate } }
        ],
        AND: [
          {
            OR: [
              { jurisdictionCode: locationParts.state },
              { jurisdictionCode: locationParts.county },
              { jurisdictionCode: locationParts.city },
              { jurisdiction: 'Federal' }
            ]
          },
          {
            OR: [
              { productCategories: { isEmpty: true } },
              { productCategories: { has: productCategory || 'GENERAL' } }
            ]
          }
        ]
      },
      orderBy: [
        { jurisdiction: 'asc' },
        { rate: 'desc' }
      ]
    });
  }

  private calculateTaxBreakdown(amount: number, taxRates: any[]): TaxBreakdown {
    let federalTax = 0;
    let stateTax = 0;
    let countyTax = 0;
    let cityTax = 0;
    let specialDistrictTax = 0;
    const jurisdictions: JurisdictionTax[] = [];

    for (const rate of taxRates) {
      const taxAmount = amount * parseFloat(rate.rate.toString());
      
      const jurisdictionTax: JurisdictionTax = {
        jurisdiction: rate.jurisdiction,
        jurisdictionCode: rate.jurisdictionCode,
        taxType: rate.taxType,
        rate: parseFloat(rate.rate.toString()),
        amount: taxAmount,
        description: rate.description
      };

      jurisdictions.push(jurisdictionTax);

      // Categorize by jurisdiction type
      switch (rate.jurisdiction.toLowerCase()) {
        case 'federal':
          federalTax += taxAmount;
          break;
        case 'state':
          stateTax += taxAmount;
          break;
        case 'county':
          countyTax += taxAmount;
          break;
        case 'city':
          cityTax += taxAmount;
          break;
        case 'special district':
          specialDistrictTax += taxAmount;
          break;
        default:
          specialDistrictTax += taxAmount;
      }
    }

    const totalTax = federalTax + stateTax + countyTax + cityTax + specialDistrictTax;
    const effectiveRate = amount > 0 ? totalTax / amount : 0;

    return {
      federalTax: Math.round(federalTax * 10000) / 10000,
      stateTax: Math.round(stateTax * 10000) / 10000,
      countyTax: Math.round(countyTax * 10000) / 10000,
      cityTax: Math.round(cityTax * 10000) / 10000,
      specialDistrictTax: Math.round(specialDistrictTax * 10000) / 10000,
      totalTax: Math.round(totalTax * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 1000000) / 1000000,
      jurisdictions
    };
  }

  private createExemptBreakdown(): TaxBreakdown {
    return {
      federalTax: 0,
      stateTax: 0,
      countyTax: 0,
      cityTax: 0,
      specialDistrictTax: 0,
      totalTax: 0,
      effectiveRate: 0,
      jurisdictions: []
    };
  }

  private parseLocation(location: string) {
    // Parse location string like "New York, NY, USA" or "Austin, TX"
    const parts = location.split(',').map(p => p.trim());
    
    return {
      city: parts[0] || '',
      state: parts[1] || '',
      county: parts[2] || '',
      country: parts[3] || 'US'
    };
  }

  private extractStateFromLocation(location: string): string {
    const locationParts = this.parseLocation(location);
    return locationParts.state;
  }

  // Nexus determination
  async hasNexus(businessId: string, state: string): Promise<boolean> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { nexusStates: true, state: true }
    });

    if (!business) return false;

    return business.nexusStates.includes(state) || business.state === state;
  }

  // Get tax rates for a specific location
  async getTaxRatesForLocation(location: string, productCategory?: string) {
    const transactionDate = new Date();
    return await this.getApplicableTaxRates(location, productCategory, transactionDate);
  }

  // Validate tax calculation
  async validateCalculation(request: TaxCalculationRequest, expectedTotal: number): Promise<boolean> {
    const breakdown = await this.calculateTax(request);
    const calculatedTotal = request.amount + breakdown.totalTax;
    const tolerance = 0.01; // 1 cent tolerance
    
    return Math.abs(calculatedTotal - expectedTotal) <= tolerance;
  }
}