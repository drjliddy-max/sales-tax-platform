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
export declare class PrismaTaxCalculator {
    calculateTax(request: TaxCalculationRequest): Promise<TaxBreakdown>;
    private getApplicableTaxRates;
    private calculateTaxBreakdown;
    private createExemptBreakdown;
    private parseLocation;
    private extractStateFromLocation;
    hasNexus(businessId: string, state: string): Promise<boolean>;
    getTaxRatesForLocation(location: string, productCategory?: string): Promise<{
        id: string;
        jurisdiction: string;
        businessId: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        jurisdictionCode: string;
        taxType: string;
        rate: Decimal;
        productCategories: string[];
        effectiveDate: Date;
        expirationDate: Date | null;
    }[]>;
    validateCalculation(request: TaxCalculationRequest, expectedTotal: number): Promise<boolean>;
}
//# sourceMappingURL=PrismaTaxCalculator.d.ts.map