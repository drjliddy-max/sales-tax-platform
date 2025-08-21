export interface TaxCalculationRequest {
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        taxCategory: string;
    }>;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    customerTaxExempt?: boolean;
}
export interface TaxCalculationResult {
    subtotal: number;
    totalTax: number;
    grandTotal: number;
    taxBreakdown: Array<{
        jurisdiction: string;
        jurisdictionType: 'federal' | 'state' | 'county' | 'city' | 'special';
        rate: number;
        taxableAmount: number;
        taxAmount: number;
    }>;
    itemBreakdown: Array<{
        id: string;
        subtotal: number;
        taxAmount: number;
        total: number;
    }>;
}
export declare class TaxCalculator {
    private firecrawlService;
    private cacheService;
    private jobQueue;
    constructor();
    calculateTax(request: TaxCalculationRequest, businessId?: string): Promise<TaxCalculationResult>;
    private calculateConfidenceScore;
    private fetchMissingRates;
    refreshRatesForLocation(address: any): Promise<number>;
    calculateTaxAsync(request: TaxCalculationRequest, businessId?: string): Promise<string>;
    preloadCacheForLocation(address: any): Promise<void>;
    private getApplicableTaxRatesWithCache;
    private convertCachedRatesToITaxRate;
    private getApplicableTaxRates;
    private calculateItemTaxes;
    private calculateJurisdictionTaxes;
    private getCategoryRate;
    private matchesCounty;
    private createTaxExemptResult;
}
//# sourceMappingURL=TaxCalculator.d.ts.map