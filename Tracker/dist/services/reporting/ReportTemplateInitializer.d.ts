export interface DefaultTemplate {
    name: string;
    description: string;
    category: 'executive' | 'operational' | 'financial' | 'custom';
    templateConfig: {
        chartTypes: string[];
        metrics: string[];
        filters: Record<string, any>;
        layout: Record<string, any>;
    };
    isDefault: boolean;
    isPublic: boolean;
}
export declare const DEFAULT_REPORT_TEMPLATES: DefaultTemplate[];
export declare class ReportTemplateInitializer {
    static initializeDefaultTemplates(): Promise<void>;
    static updateExistingTemplates(): Promise<void>;
    static getTemplatesSummary(): Promise<Record<string, any>>;
    static resetDefaultTemplates(): Promise<void>;
    static getAvailableCategories(): string[];
    static getTemplatesByCategory(category: string): DefaultTemplate[];
    static getTotalTemplateCount(): number;
    static validateTemplate(template: DefaultTemplate): {
        valid: boolean;
        errors: string[];
    };
}
//# sourceMappingURL=ReportTemplateInitializer.d.ts.map