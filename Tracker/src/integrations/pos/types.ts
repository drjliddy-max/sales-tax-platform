/**
 * Core types and interfaces for POS system integrations
 * This provides the foundation for all POS system implementations
 */

export type POSSystemType = 'shopify' | 'square' | 'clover' | 'toast' | 'lightspeed' | 'paypal_here' | 'ncr';

export interface POSFingerprint {
  baseUrl: string;
  testEndpoints: string[];
  authenticationMethod: 'oauth' | 'api_key' | 'custom';
  responseSignature: string;
  headers?: Record<string, string>;
}

export interface AuthCredentials {
  type: 'oauth' | 'api_key' | 'custom';
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  shopDomain?: string; // For Shopify
  merchantId?: string; // For Clover
  restaurantGuid?: string; // For Toast
  customCredentials?: Record<string, any>;
}

export interface TaxLine {
  name: string;
  rate: number;
  amount: number;
  jurisdiction: string;
  type: 'percentage' | 'fixed';
  scope?: 'state' | 'county' | 'city' | 'special';
}

export interface LocationInfo {
  id: string;
  name?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  timezone?: string;
  taxSettings?: {
    taxIncluded: boolean;
    defaultTaxRate?: number;
    exemptions?: string[];
  };
}

export interface LineItemTax {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxes: TaxLine[];
  taxExempt?: boolean;
  category?: string;
}

export interface StandardizedTaxData {
  transactionId: string;
  timestamp: Date;
  totalAmount: number;
  totalTax: number;
  taxBreakdown: TaxLine[];
  location: LocationInfo;
  lineItems: LineItemTax[];
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  metadata?: Record<string, any>;
}

export interface TaxDataSchema {
  totalTaxField: string;
  taxLinesField: string;
  taxRateField: string;
  taxAmountField: string;
  jurisdictionField?: string;
  locationField: string;
  transactionIdField: string;
  timestampField: string;
  totalAmountField: string;
  lineItemsField?: string;
  statusField?: string;
}

export interface RateLimit {
  requestsPerSecond: number;
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstLimit?: number;
  concurrentConnections?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
}

export interface WebhookConfiguration {
  endpoint: string;
  events: string[];
  signatureValidation: boolean;
  retryLogic: RetryConfig;
  secretKey?: string;
}

export interface POSConfiguration {
  posType: POSSystemType;
  credentials: AuthCredentials;
  webhookEndpoints: string[];
  dataSchema: TaxDataSchema;
  rateLimit: RateLimit;
  lastSync?: Date;
  isActive: boolean;
  settings?: {
    autoSync: boolean;
    syncInterval: number; // minutes
    enableWebhooks: boolean;
    taxCalculationMode: 'pos' | 'internal' | 'hybrid';
    multiLocationSupport: boolean;
  };
}

export interface POSDetectionResult {
  posType: POSSystemType;
  confidence: number; // 0-1
  supportedFeatures: string[];
  requiredCredentials: string[];
  configuration: Partial<POSConfiguration>;
}

export interface POSAdapter {
  readonly posType: POSSystemType;
  readonly name: string;
  readonly supportedFeatures: string[];
  
  // Core methods that all adapters must implement
  testConnection(credentials: AuthCredentials): Promise<boolean>;
  authenticate(credentials: AuthCredentials): Promise<AuthCredentials>;
  getLocations(credentials: AuthCredentials): Promise<LocationInfo[]>;
  getTransactions(
    credentials: AuthCredentials, 
    locationId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<StandardizedTaxData[]>;
  
  // Webhook management
  setupWebhooks(credentials: AuthCredentials, webhookUrl: string): Promise<WebhookConfiguration>;
  validateWebhook(payload: any, signature: string, secret: string): boolean;
  
  // Data transformation
  transformRawData(rawData: any): StandardizedTaxData;
  
  // Optional methods for advanced features
  getHistoricalData?(
    credentials: AuthCredentials, 
    locationId: string, 
    days: number
  ): Promise<StandardizedTaxData[]>;
  
  getTaxRates?(
    credentials: AuthCredentials, 
    locationId: string
  ): Promise<TaxLine[]>;
  
  syncInventory?(
    credentials: AuthCredentials, 
    locationId: string
  ): Promise<any[]>;
}

export interface POSIntegrationError extends Error {
  code: string;
  posType: POSSystemType;
  statusCode?: number;
  retryable: boolean;
  details?: Record<string, any>;
}

export class POSIntegrationError extends Error implements POSIntegrationError {
  constructor(
    message: string,
    public code: string,
    public posType: POSSystemType,
    public statusCode?: number,
    public retryable: boolean = false,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'POSIntegrationError';
  }
}

// Event types for the POS integration system
export interface POSEvent {
  type: 'transaction.created' | 'transaction.updated' | 'transaction.refunded' | 'sync.completed' | 'sync.failed' | 'connection.lost' | 'connection.restored';
  posType: POSSystemType;
  locationId?: string;
  timestamp: Date;
  data?: any;
  error?: POSIntegrationError;
}

export interface POSEventHandler {
  (event: POSEvent): Promise<void>;
}
