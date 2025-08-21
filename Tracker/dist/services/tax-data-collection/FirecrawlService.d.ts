interface TaxRateSource {
    name: string;
    url: string;
    state: string;
    extractionPattern: string;
    apiEndpoint?: string;
    updateFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    lastCrawled?: Date;
}
interface ExtractedTaxData {
    state: string;
    jurisdiction: string;
    jurisdictionType: 'state' | 'county' | 'city' | 'special';
    rate: number;
    effectiveDate: Date;
    source: string;
    sourceUrl: string;
    productCategories?: string[];
}
export declare class FirecrawlService {
    private firecrawl;
    private taxRateSources;
    constructor();
    private initializeTaxRateSources;
    collectTaxRateUpdates(): Promise<ExtractedTaxData[]>;
    private collectFromWebsite;
    private parseMarkdownForTaxRates;
    crawlSpecificJurisdiction(state: string, jurisdiction: string): Promise<ExtractedTaxData[]>;
    updateTaxRatesInDatabase(taxData: ExtractedTaxData[]): Promise<number>;
    monitorComplianceChanges(): Promise<any[]>;
    getSourcesNeedingUpdate(): Promise<TaxRateSource[]>;
}
export {};
//# sourceMappingURL=FirecrawlService.d.ts.map