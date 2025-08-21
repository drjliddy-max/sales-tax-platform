import { POSSystemType, TaxDataSchema, StandardizedTaxData } from './types';
export declare class TaxDataTransformer {
    private schema;
    private posType;
    constructor(posType: POSSystemType, schema: TaxDataSchema);
    transform(rawData: any): StandardizedTaxData;
    private extractTransactionId;
    private extractTimestamp;
    private extractTotalAmount;
    private extractTotalTax;
    private extractTaxLines;
    private transformTaxLine;
    private extractTaxLineName;
    private extractLocation;
    private extractLocationName;
    private extractLocationAddress;
    private extractTimezone;
    private extractTaxSettings;
    private extractLineItems;
    private transformLineItem;
    private extractItemTaxes;
    private isItemTaxExempt;
    private extractItemCategory;
    private extractCurrency;
    private extractStatus;
    private extractMetadata;
    private extractValue;
    private findFieldValue;
    private normalizeAmount;
    private normalizeTaxRate;
    private determineTaxType;
    private determineTaxScope;
    private normalizeStatus;
}
//# sourceMappingURL=transformer.d.ts.map