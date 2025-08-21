import { POSAdapter, POSSystemType, AuthCredentials, StandardizedTaxData, LocationInfo, TaxLine, WebhookConfiguration } from '../types';
export declare class ShopifyAdapter implements POSAdapter {
    readonly posType: POSSystemType;
    readonly name = "Shopify POS";
    readonly supportedFeatures: string[];
    private transformer;
    private rateLimiter;
    constructor();
    testConnection(credentials: AuthCredentials): Promise<boolean>;
    authenticate(credentials: AuthCredentials): Promise<AuthCredentials>;
    getLocations(credentials: AuthCredentials): Promise<LocationInfo[]>;
    getTransactions(credentials: AuthCredentials, locationId: string, startDate: Date, endDate: Date): Promise<StandardizedTaxData[]>;
    setupWebhooks(credentials: AuthCredentials, webhookUrl: string): Promise<WebhookConfiguration>;
    validateWebhook(payload: any, signature: string, secret: string): boolean;
    transformRawData(rawData: any): StandardizedTaxData;
    getHistoricalData(credentials: AuthCredentials, locationId: string, days: number): Promise<StandardizedTaxData[]>;
    getTaxRates(credentials: AuthCredentials, locationId: string): Promise<TaxLine[]>;
    private makeRequest;
    private enrichOrderData;
    private wrapError;
    static generateOAuthUrl(clientId: string, shopDomain: string, redirectUri: string, scopes?: string[]): string;
    static exchangeCodeForToken(clientId: string, clientSecret: string, shopDomain: string, code: string): Promise<{
        accessToken: string;
        scope: string;
    }>;
}
//# sourceMappingURL=ShopifyAdapter.d.ts.map