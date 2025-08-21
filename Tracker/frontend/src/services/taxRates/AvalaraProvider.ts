import { 
  TaxRateProvider, 
  TaxRateProviderConfig, 
  TaxRateQuery, 
  TaxRateResponse, 
  TaxRateValidation, 
  TaxRate, 
  TaxRateUpdate 
} from './TaxRateProvider';
import { ApiClient, TimeoutError, NetworkError, isRetryableError } from '../../utils/fetchUtils';

interface AvalaraConfig extends TaxRateProviderConfig {
  companyCode: string;
  accountId: string;
  licenseKey: string;
}

interface AvalaraTaxResponse {
  totalTax: number;
  rate: number;
  lines: Array<{
    lineNumber: string;
    rate: number;
    tax: number;
    details: Array<{
      jurisdiction: string;
      jurisdictionType: string;
      rate: number;
      tax: number;
      taxType: string;
      taxName: string;
    }>;
  }>;
  addresses: Array<{
    textCase: string;
    line1: string;
    city: string;
    region: string;
    country: string;
    postalCode: string;
  }>;
}

interface AvalaraAddressValidationResponse {
  address: {
    textCase: string;
    line1: string;
    city: string;
    region: string;
    country: string;
    postalCode: string;
  };
  validatedAddresses: Array<{
    addressType: string;
    line1: string;
    city: string;
    region: string;
    country: string;
    postalCode: string;
  }>;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  resolutionQuality: string;
  taxAuthorities: Array<{
    avalaraId: string;
    jurisdictionName: string;
    jurisdictionType: string;
    signatureCode: string;
  }>;
}

export class AvalaraProvider extends TaxRateProvider {
  private baseUrl: string;
  private avalaraConfig: AvalaraConfig;
  private apiClient: ApiClient;

  constructor(config: AvalaraConfig) {
    super(config, 'avalara');
    this.avalaraConfig = config;
    this.baseUrl = config.environment === 'production' 
      ? 'https://rest.avatax.com' 
      : 'https://sandbox-rest.avatax.com';
    
    // Initialize API client with timeout and retry configuration
    this.apiClient = new ApiClient(this.baseUrl, {
      timeout: 15000, // 15 second timeout for Avalara API
      retries: 3,
      retryDelay: 1000,
      retryCondition: (error: any) => {
        // Retry on timeouts, network errors, and specific HTTP status codes
        if (error instanceof TimeoutError || error instanceof NetworkError) {
          return true;
        }
        
        // Retry on server errors and rate limits
        if (error.response && error.response.status) {
          const status = error.response.status;
          return status >= 500 || status === 408 || status === 429;
        }
        
        return isRetryableError(error);
      },
      headers: {
        'Authorization': `Basic ${btoa(`${this.avalaraConfig.accountId}:${this.avalaraConfig.licenseKey}`)}`,
        'Content-Type': 'application/json',
        'X-Avalara-Client': 'SalesTaxTracker;1.0;Custom;1.0'
      }
    });
  }

  async getRates(query: TaxRateQuery): Promise<TaxRateResponse> {
    const startTime = Date.now();
    
    try {
      // Create transaction for tax calculation
      const transactionRequest = {
        companyCode: this.avalaraConfig.companyCode,
        type: 'SalesOrder',
        customerCode: 'default',
        date: query.transactionDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        lines: [
          {
            number: '1',
            quantity: 1,
            amount: 100, // Use $100 as base for rate calculation
            addresses: {
              ShipTo: {
                line1: query.address.line1,
                city: query.address.city,
                region: query.address.state,
                country: query.address.country || 'US',
                postalCode: query.address.postalCode
              }
            },
            taxCode: this.mapProductCategoryToTaxCode(query.productCategory),
            customerUsageType: this.mapCustomerTypeToUsageType(query.customerType)
          }
        ],
        commit: false // Don't commit, just calculate
      };

      const response = await this.makeRequest('/api/v2/transactions/create', 'POST', transactionRequest);
      
      if (!response || !response.lines || response.lines.length === 0) {
        throw new Error('Invalid response from Avalara API');
      }

      return this.transformAvalaraResponse(response, query, startTime);
    } catch (error) {
      console.error('Avalara API error:', error);
      throw new Error(`Failed to get tax rates from Avalara: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateAddress(address: TaxRateQuery['address']): Promise<TaxRateValidation> {
    try {
      const validationRequest = {
        line1: address.line1,
        city: address.city,
        region: address.state,
        country: address.country || 'US',
        postalCode: address.postalCode,
        textCase: 'Mixed'
      };

      const response: AvalaraAddressValidationResponse = await this.makeRequest(
        '/api/v2/addresses/resolve', 
        'POST', 
        validationRequest
      );

      const isValid = response.resolutionQuality === 'Intersection' || 
                     response.resolutionQuality === 'InterpolatedStreet' ||
                     response.resolutionQuality === 'Zip9';

      const confidence = this.calculateAddressConfidence(response.resolutionQuality);

      return {
        isValid,
        confidence,
        warnings: this.generateAddressWarnings(response),
        errors: this.generateAddressErrors(response),
        suggestedCorrections: this.generateSuggestedCorrections(response, address)
      };
    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        warnings: [],
        errors: [`Address validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async getRateHistory(jurisdiction: string, startDate: Date, endDate: Date): Promise<TaxRate[]> {
    try {
      // Avalara doesn't provide direct rate history API
      // We'll query for specific dates and build history
      const rates: TaxRate[] = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        try {
          const query: TaxRateQuery = {
            address: this.parseJurisdictionToAddress(jurisdiction),
            transactionDate: new Date(currentDate)
          };
          
          const response = await this.getRates(query);
          
          // Convert response to TaxRate format
          response.rates.forEach(rate => {
            rates.push({
              ...rate,
              effectiveDate: new Date(currentDate)
            });
          });
        } catch (error) {
          console.warn(`Failed to get rates for ${currentDate.toISOString()}:`, error);
        }
        
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return rates;
    } catch (error) {
      console.error('Error getting rate history:', error);
      return [];
    }
  }

  async subscribeToUpdates(callback: (update: TaxRateUpdate) => void): Promise<string> {
    // Avalara doesn't provide real-time webhooks for rate changes
    // We'll implement polling mechanism
    const subscriptionId = `avalara_${Date.now()}`;
    
    // Store callback for later use (in a real implementation, this would be persisted)
    console.log(`Subscribed to Avalara updates with ID: ${subscriptionId}`);
    
    // Start polling (in production, this would be handled by a background service)
    this.startPollingForUpdates(callback, subscriptionId);
    
    return subscriptionId;
  }

  async unsubscribeFromUpdates(subscriptionId: string): Promise<void> {
    console.log(`Unsubscribed from Avalara updates: ${subscriptionId}`);
    // Stop polling for this subscription
  }

  async testConnection(): Promise<{ success: boolean; message: string; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      // Test with a simple API call
      await this.makeRequest('/api/v2/utilities/ping', 'GET');
      
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        message: 'Connection successful',
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
        responseTime
      };
    }
  }

  getCapabilities() {
    return {
      supportsRealTime: true,
      supportsHistory: true,
      supportsWebhooks: false, // Avalara doesn't provide rate change webhooks
      supportedCountries: ['US', 'CA'],
      supportedProductCategories: [
        'general', 'food', 'clothing', 'digital', 'pharmaceutical',
        'medical', 'automotive', 'telecommunications', 'software'
      ],
      maxRequestsPerMinute: 1000 // Avalara's rate limit
    };
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any): Promise<any> {
    try {
      switch (method) {
        case 'GET':
          return await this.apiClient.get(endpoint);
        case 'POST':
          return await this.apiClient.post(endpoint, body);
        case 'PUT':
          return await this.apiClient.put(endpoint, body);
        case 'DELETE':
          return await this.apiClient.delete(endpoint);
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }
    } catch (error) {
      // Enhanced error handling with timeout detection
      if (error instanceof TimeoutError) {
        throw new Error(`Avalara API request timeout (${error.timeoutMs}ms): Address validation service temporarily unavailable`);
      }
      
      if (error instanceof NetworkError) {
        throw new Error(`Avalara API network error: ${error.message}`);
      }
      
      // Handle circuit breaker errors
      if (error.message && error.message.includes('Circuit breaker is OPEN')) {
        throw new Error('Avalara API temporarily unavailable due to repeated failures. Please try again later.');
      }
      
      // Re-throw with context
      throw new Error(`Avalara API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private transformAvalaraResponse(response: AvalaraTaxResponse, query: TaxRateQuery, startTime: number): TaxRateResponse {
    const line = response.lines[0];
    const rates: TaxRate[] = [];
    let totalRate = 0;
    
    const breakdown = {
      federal: 0,
      state: 0,
      county: 0,
      city: 0,
      special: 0
    };

    // Process tax details
    line.details.forEach(detail => {
      const rate: TaxRate = {
        id: `avalara_${detail.jurisdiction}_${detail.taxType}`,
        jurisdiction: detail.jurisdiction,
        jurisdictionType: this.mapAvalaraJurisdictionType(detail.jurisdictionType),
        rate: detail.rate,
        effectiveDate: query.transactionDate || new Date(),
        productCategories: query.productCategory ? [query.productCategory] : ['general'],
        isActive: true,
        source: 'avalara',
        lastUpdated: new Date(),
        confidence: 0.98, // High confidence for Avalara data
        metadata: {
          taxType: detail.taxType,
          taxName: detail.taxName
        }
      };

      rates.push(rate);
      totalRate += detail.rate;

      // Categorize into breakdown
      switch (rate.jurisdictionType) {
        case 'federal':
          breakdown.federal += detail.rate;
          break;
        case 'state':
          breakdown.state += detail.rate;
          break;
        case 'county':
          breakdown.county += detail.rate;
          break;
        case 'city':
          breakdown.city += detail.rate;
          break;
        case 'special':
          breakdown.special += detail.rate;
          break;
      }
    });

    return {
      rates,
      totalRate,
      breakdown,
      jurisdiction: `${query.address.city}, ${query.address.state}`,
      confidence: 0.98,
      cached: false,
      source: 'avalara'
    };
  }

  private mapProductCategoryToTaxCode(category?: string): string {
    const mapping: Record<string, string> = {
      'food': 'P0000000',
      'clothing': 'PC040100',
      'digital': 'D0000000',
      'pharmaceutical': 'RX000000',
      'medical': 'MD000000',
      'automotive': 'PC030000',
      'telecommunications': 'TC000000',
      'software': 'DC010200',
      'general': ''
    };
    
    return mapping[category || 'general'] || '';
  }

  private mapCustomerTypeToUsageType(customerType?: string): string {
    const mapping: Record<string, string> = {
      'retail': '',
      'wholesale': 'R',
      'exempt': 'E'
    };
    
    return mapping[customerType || 'retail'] || '';
  }

  private mapAvalaraJurisdictionType(type: string): 'federal' | 'state' | 'county' | 'city' | 'special' {
    const lowerType = type.toLowerCase();
    
    if (lowerType.includes('state')) return 'state';
    if (lowerType.includes('county')) return 'county';
    if (lowerType.includes('city')) return 'city';
    if (lowerType.includes('federal')) return 'federal';
    
    return 'special';
  }

  private calculateAddressConfidence(quality: string): number {
    const confidenceMap: Record<string, number> = {
      'Intersection': 1.0,
      'InterpolatedStreet': 0.95,
      'Zip9': 0.9,
      'Zip5': 0.8,
      'External': 0.7,
      'None': 0.0
    };
    
    return confidenceMap[quality] || 0.5;
  }

  private generateAddressWarnings(response: AvalaraAddressValidationResponse): string[] {
    const warnings: string[] = [];
    
    if (response.resolutionQuality === 'Zip5') {
      warnings.push('Address resolved to ZIP code level only');
    }
    
    if (response.resolutionQuality === 'External') {
      warnings.push('Address validated using external data source');
    }
    
    return warnings;
  }

  private generateAddressErrors(response: AvalaraAddressValidationResponse): string[] {
    const errors: string[] = [];
    
    if (response.resolutionQuality === 'None') {
      errors.push('Address could not be validated');
    }
    
    return errors;
  }

  private generateSuggestedCorrections(
    response: AvalaraAddressValidationResponse, 
    originalAddress: TaxRateQuery['address']
  ): Partial<TaxRateQuery> | undefined {
    if (response.validatedAddresses && response.validatedAddresses.length > 0) {
      const validated = response.validatedAddresses[0];
      
      return {
        address: {
          line1: validated.line1,
          city: validated.city,
          state: validated.region,
          postalCode: validated.postalCode,
          country: validated.country
        }
      };
    }
    
    return undefined;
  }

  private parseJurisdictionToAddress(jurisdiction: string): TaxRateQuery['address'] {
    // Parse jurisdiction string like "Austin, TX" into address components
    const parts = jurisdiction.split(',').map(p => p.trim());
    
    return {
      line1: '123 Main St', // Default street address
      city: parts[0] || '',
      state: parts[1] || '',
      postalCode: '00000', // Default postal code
      country: 'US'
    };
  }

  private startPollingForUpdates(callback: (update: TaxRateUpdate) => void, subscriptionId: string): void {
    // In a real implementation, this would be handled by a background service
    // For now, we'll just log that polling has started
    console.log(`Started polling for tax rate updates (subscription: ${subscriptionId})`);
    
    // Example: Poll every hour for rate changes
    // setInterval(async () => {
    //   try {
    //     // Check for rate changes and call callback if found
    //   } catch (error) {
    //     console.error('Error polling for updates:', error);
    //   }
    // }, 60 * 60 * 1000); // 1 hour
  }
}
