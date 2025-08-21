export interface TaxRate {
  id: string;
  jurisdiction: string;
  jurisdictionType: 'federal' | 'state' | 'county' | 'city' | 'special';
  rate: number;
  effectiveDate: Date;
  expirationDate?: Date;
  productCategories: string[];
  isActive: boolean;
  source: 'avalara' | 'taxjar' | 'internal' | 'government';
  lastUpdated: Date;
  confidence: number; // 0-1 confidence score
  metadata?: Record<string, any>;
}

export interface TaxRateQuery {
  address: {
    line1: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
  };
  productCategory?: string;
  customerType?: 'retail' | 'wholesale' | 'exempt';
  transactionDate?: Date;
}

export interface TaxRateResponse {
  rates: TaxRate[];
  totalRate: number;
  breakdown: {
    federal: number;
    state: number;
    county: number;
    city: number;
    special: number;
  };
  jurisdiction: string;
  confidence: number;
  cached: boolean;
  source: string;
}

export interface TaxRateUpdate {
  jurisdiction: string;
  oldRate: number;
  newRate: number;
  effectiveDate: Date;
  source: string;
  changeReason?: string;
}

export interface TaxRateProviderConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
  timeout: number;
  retryAttempts: number;
  cacheEnabled: boolean;
  cacheTtl: number; // seconds
  webhookUrl?: string;
}

export interface TaxRateValidation {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  errors: string[];
  suggestedCorrections?: Partial<TaxRateQuery>;
}

export abstract class TaxRateProvider {
  protected config: TaxRateProviderConfig;
  protected name: string;

  constructor(config: TaxRateProviderConfig, name: string) {
    this.config = config;
    this.name = name;
  }

  /**
   * Get current tax rates for a specific address and transaction type
   */
  abstract getRates(query: TaxRateQuery): Promise<TaxRateResponse>;

  /**
   * Validate an address for tax calculation purposes
   */
  abstract validateAddress(address: TaxRateQuery['address']): Promise<TaxRateValidation>;

  /**
   * Get rate history for a jurisdiction
   */
  abstract getRateHistory(jurisdiction: string, startDate: Date, endDate: Date): Promise<TaxRate[]>;

  /**
   * Subscribe to rate change notifications
   */
  abstract subscribeToUpdates(callback: (update: TaxRateUpdate) => void): Promise<string>;

  /**
   * Unsubscribe from rate change notifications
   */
  abstract unsubscribeFromUpdates(subscriptionId: string): Promise<void>;

  /**
   * Test connection to the provider
   */
  abstract testConnection(): Promise<{ success: boolean; message: string; responseTime: number }>;

  /**
   * Get provider capabilities and limitations
   */
  abstract getCapabilities(): {
    supportsRealTime: boolean;
    supportsHistory: boolean;
    supportsWebhooks: boolean;
    supportedCountries: string[];
    supportedProductCategories: string[];
    maxRequestsPerMinute: number;
  };

  /**
   * Batch get rates for multiple queries
   */
  async getBatchRates(queries: TaxRateQuery[]): Promise<TaxRateResponse[]> {
    // Default implementation - individual calls
    // Override in providers that support batch operations
    const results: TaxRateResponse[] = [];
    for (const query of queries) {
      try {
        const result = await this.getRates(query);
        results.push(result);
      } catch (error) {
        // Add error handling for individual query failures
        results.push({
          rates: [],
          totalRate: 0,
          breakdown: { federal: 0, state: 0, county: 0, city: 0, special: 0 },
          jurisdiction: `${query.address.city}, ${query.address.state}`,
          confidence: 0,
          cached: false,
          source: this.name
        });
      }
    }
    return results;
  }

  /**
   * Get provider name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get provider configuration (without sensitive data)
   */
  getConfig(): Omit<TaxRateProviderConfig, 'apiKey'> {
    const { apiKey, ...safeConfig } = this.config;
    return safeConfig;
  }
}

export interface TaxRateProviderRegistry {
  registerProvider(name: string, provider: TaxRateProvider): void;
  getProvider(name: string): TaxRateProvider | null;
  getAllProviders(): TaxRateProvider[];
  getActiveProvider(): TaxRateProvider | null;
  setActiveProvider(name: string): void;
}

export class DefaultTaxRateProviderRegistry implements TaxRateProviderRegistry {
  private providers = new Map<string, TaxRateProvider>();
  private activeProviderName: string | null = null;

  registerProvider(name: string, provider: TaxRateProvider): void {
    this.providers.set(name, provider);
    if (!this.activeProviderName) {
      this.activeProviderName = name;
    }
  }

  getProvider(name: string): TaxRateProvider | null {
    return this.providers.get(name) || null;
  }

  getAllProviders(): TaxRateProvider[] {
    return Array.from(this.providers.values());
  }

  getActiveProvider(): TaxRateProvider | null {
    return this.activeProviderName ? this.providers.get(this.activeProviderName) || null : null;
  }

  setActiveProvider(name: string): void {
    if (this.providers.has(name)) {
      this.activeProviderName = name;
    } else {
      throw new Error(`Provider ${name} not found`);
    }
  }
}

// Global registry instance
export const taxRateProviderRegistry = new DefaultTaxRateProviderRegistry();
