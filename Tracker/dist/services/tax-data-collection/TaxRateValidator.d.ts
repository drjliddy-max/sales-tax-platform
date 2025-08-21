interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    normalizedData?: any;
}
export declare class TaxRateValidator {
    private validationRules;
    private taxRateSchema;
    constructor();
    private initializeValidationRules;
    private initializeSchema;
    validateTaxRateData(data: any): Promise<ValidationResult>;
    private validateAgainstStateRules;
    private validateBusinessLogic;
    validateBatchData(dataArray: any[]): Promise<{
        valid: any[];
        invalid: any[];
        warnings: any[];
        summary: {
            total: number;
            valid: number;
            invalid: number;
            warningsCount: number;
        };
    }>;
    crossValidateWithExistingRates(newData: any[]): Promise<{
        matches: any[];
        conflicts: any[];
        newRates: any[];
    }>;
    private findExistingRate;
    validateComplianceUpdate(update: any): Promise<ValidationResult>;
}
export {};
//# sourceMappingURL=TaxRateValidator.d.ts.map