import { EventEmitter } from 'events';
export interface POSFieldConfig {
    name: string;
    label: string;
    type: 'text' | 'password' | 'url' | 'email' | 'select';
    required: boolean;
    placeholder: string;
    helpText?: string;
    validation?: string;
    options?: {
        value: string;
        label: string;
    }[];
}
export interface POSAuthConfig {
    type: 'oauth' | 'api_key' | 'basic_auth';
    oauthConfig?: {
        authorizationUrl: string;
        tokenUrl: string;
        scopes: string[];
        clientIdField: string;
        clientSecretField: string;
        redirectUriRequired: boolean;
        additionalParams?: {
            [key: string]: string;
        };
    };
}
export interface POSWebhookConfig {
    supportedEvents: string[];
    signatureHeader?: string;
    signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
    secretField?: string;
    payloadFormat: 'json' | 'form' | 'xml';
}
export interface POSEndpointConfig {
    baseUrl: string;
    authHeader: 'Authorization' | 'X-API-Key' | 'Bearer' | string;
    authPrefix?: string;
    endpoints: {
        test: string;
        locations: string;
        transactions: string;
        webhooks?: {
            list: string;
            create: string;
            delete: string;
        };
    };
    requestFormat?: {
        dateFormat: string;
        timeZone?: string;
        pagination?: {
            limitParam: string;
            offsetParam: string;
            maxLimit: number;
        };
    };
}
export interface POSDataMapping {
    transaction: {
        id: string;
        timestamp: string;
        totalAmount: string;
        totalTax: string;
        items: string;
        location: string;
        customer?: string;
    };
    location: {
        id: string;
        name: string;
        address: {
            street: string;
            city: string;
            state: string;
            zipCode: string;
            country: string;
        };
    };
}
export interface POSPluginConfig {
    id: string;
    name: string;
    description: string;
    marketFocus: string;
    logo?: string;
    documentationUrl?: string;
    supportUrl?: string;
    version: string;
    lastUpdated: Date;
    auth: POSAuthConfig;
    fields: POSFieldConfig[];
    endpoints: POSEndpointConfig;
    webhooks?: POSWebhookConfig;
    dataMapping: POSDataMapping;
    instructions: string[];
    connectionTest: {
        endpoint: string;
        method: 'GET' | 'POST';
        expectedStatus: number;
        expectedFields?: string[];
    };
    features: {
        realTimeSync: boolean;
        historicalSync: boolean;
        webhooksSupported: boolean;
        multiLocationSupport: boolean;
        taxDetailsSupported: boolean;
    };
}
export declare class POSPluginManager extends EventEmitter {
    private plugins;
    private database;
    constructor(database: any);
    private loadPluginsFromDatabase;
    registerPlugin(pluginConfig: POSPluginConfig): Promise<boolean>;
    getAvailablePlugins(): POSPluginConfig[];
    getPlugin(posId: string): POSPluginConfig | null;
    getSupportedPOSSystems(): {
        id: string;
        name: string;
        description: string;
        authMethod: "oauth" | "api_key" | "basic_auth";
        features: string[];
        marketFocus: string;
        logo: string | undefined;
    }[];
    getCredentialFields(posId: string): POSFieldConfig[];
    getOAuthConfig(posId: string): {
        authorizationUrl: string;
        tokenUrl: string;
        scopes: string[];
        clientIdField: string;
        clientSecretField: string;
        redirectUriRequired: boolean;
        additionalParams?: {
            [key: string]: string;
        };
    } | null | undefined;
    getWebhookConfig(posId: string): POSWebhookConfig | null;
    getEndpoints(posId: string): POSEndpointConfig | null;
    getDataMapping(posId: string): POSDataMapping | null;
    testConnection(posId: string, credentials: {
        [key: string]: string;
    }): Promise<{
        success: boolean;
        message: string;
        details?: any;
    }>;
    removePlugin(posId: string): Promise<boolean>;
    private validatePluginConfig;
    private buildEndpointUrl;
    private buildHeaders;
    private buildAuthValue;
}
export default POSPluginManager;
//# sourceMappingURL=POSPluginManager.d.ts.map