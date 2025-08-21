import { POSAdapter, POSSystemType, AuthCredentials, StandardizedTaxData, LocationInfo, TaxLine, WebhookConfiguration } from '../types';
export declare class SquareAdapter implements POSAdapter {
    readonly posType: POSSystemType;
    readonly name = "Square POS";
    readonly supportedFeatures: string[];
    private transformer;
    private rateLimiter;
    private baseUrl;
    constructor(environment?: 'production' | 'sandbox');
    testConnection(credentials: AuthCredentials): Promise<boolean>;
    authenticate(credentials: AuthCredentials): Promise<AuthCredentials>;
    getLocations(credentials: AuthCredentials): Promise<LocationInfo[]>;
    getTransactions(credentials: AuthCredentials, locationId: string, startDate: Date, endDate: Date): Promise<StandardizedTaxData[]>;
    private getOrders;
    private getPayments;
    setupWebhooks(credentials: AuthCredentials, webhookUrl: string): Promise<WebhookConfiguration>;
    validateWebhook(payload: any, signature: string, secret: string): boolean;
    transformRawData(rawData: any): StandardizedTaxData;
    getHistoricalData(credentials: AuthCredentials, locationId: string, days: number): Promise<StandardizedTaxData[]>;
    getTaxRates(credentials: AuthCredentials, locationId: string): Promise<TaxLine[]>;
    private makeRequest;
    private wrapError;
    static generateOAuthUrl(clientId: string, redirectUri: string, scopes?: string[], state?: string): string;
    static exchangeCodeForToken(clientId: string, clientSecret: string, code: string, redirectUri: string): Promise<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>;
    static refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<{
        accessToken: string;
        refreshToken?: string;
        expiresAt?: Date;
    }>;
}
//# sourceMappingURL=SquareAdapter.d.ts.map