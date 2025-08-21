import { POSSystemType, POSAdapter, TaxDataSchema, RateLimit } from './types';
export interface POSIntegrationTemplate {
    posType: string;
    name: string;
    description: string;
    marketFocus: string;
    supportedFeatures: string[];
    authMethod: 'oauth' | 'api_key' | 'custom';
    baseUrl: string;
    testEndpoints: string[];
    responseSignature: string;
    rateLimit: RateLimit;
    taxDataSchema: TaxDataSchema;
    webhookEvents: string[];
    requiredCredentials: string[];
    oauthScopes?: string[];
    customHeaders?: Record<string, string>;
}
export interface IntegrationChecklist {
    adapterImplemented: boolean;
    authenticationTested: boolean;
    dataTransformationTested: boolean;
    webhooksConfigured: boolean;
    errorHandlingTested: boolean;
    rateLimitingTested: boolean;
    documentationComplete: boolean;
    testsWritten: boolean;
}
export declare class POSIntegrationFactory {
    private static readonly ADAPTER_TEMPLATE_PATH;
    private static readonly TEST_TEMPLATE_PATH;
    static generateAdapter(template: POSIntegrationTemplate): string;
    static generateAdapterTest(template: POSIntegrationTemplate): string;
    static createIntegrationChecklist(posType: string): IntegrationChecklist;
    static validateIntegration(posType: POSSystemType, adapter: POSAdapter, checklist: IntegrationChecklist): {
        isValid: boolean;
        missingItems: string[];
    };
    static registerAdapter(posType: POSSystemType, adapter: POSAdapter, template: POSIntegrationTemplate): Promise<void>;
    private static getAdapterTemplate;
    private static getTestTemplate;
    private static getAdapterClassName;
    private static generateTestCredentials;
}
export declare class IntegrationGuide {
    static getDevelopmentSteps(posType: string): string[];
}
//# sourceMappingURL=integration-framework.d.ts.map