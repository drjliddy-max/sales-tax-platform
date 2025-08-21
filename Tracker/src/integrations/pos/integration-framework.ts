/**
 * POS Integration Framework
 * Systematic process and tools for adding new POS integrations
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  POSSystemType,
  POSAdapter,
  POSFingerprint,
  TaxDataSchema,
  RateLimit,
  AuthCredentials,
  POSConfiguration
} from './types';
import { POSDetector } from './detection';
import { TaxDataTransformer } from './transformer';
import { WebhookManager } from './webhook-manager';

/**
 * Integration template for new POS systems
 */
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

/**
 * Integration checklist for validation
 */
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

/**
 * POS Integration Factory
 * Provides tools and templates for creating new integrations
 */
export class POSIntegrationFactory {
  private static readonly ADAPTER_TEMPLATE_PATH = join(__dirname, 'templates', 'adapter-template.ts');
  private static readonly TEST_TEMPLATE_PATH = join(__dirname, 'templates', 'adapter-test-template.ts');

  /**
   * Generate a new POS adapter from template
   */
  public static generateAdapter(template: POSIntegrationTemplate): string {
    const adapterTemplate = this.getAdapterTemplate();
    
    return adapterTemplate
      .replace(/{{POS_TYPE}}/g, template.posType)
      .replace(/{{POS_NAME}}/g, template.name)
      .replace(/{{POS_DESCRIPTION}}/g, template.description)
      .replace(/{{MARKET_FOCUS}}/g, template.marketFocus)
      .replace(/{{SUPPORTED_FEATURES}}/g, JSON.stringify(template.supportedFeatures, null, 2))
      .replace(/{{AUTH_METHOD}}/g, template.authMethod)
      .replace(/{{BASE_URL}}/g, template.baseUrl)
      .replace(/{{TEST_ENDPOINTS}}/g, JSON.stringify(template.testEndpoints))
      .replace(/{{RESPONSE_SIGNATURE}}/g, template.responseSignature)
      .replace(/{{RATE_LIMIT}}/g, JSON.stringify(template.rateLimit, null, 2))
      .replace(/{{TAX_DATA_SCHEMA}}/g, JSON.stringify(template.taxDataSchema, null, 2))
      .replace(/{{WEBHOOK_EVENTS}}/g, JSON.stringify(template.webhookEvents))
      .replace(/{{REQUIRED_CREDENTIALS}}/g, JSON.stringify(template.requiredCredentials))
      .replace(/{{OAUTH_SCOPES}}/g, JSON.stringify(template.oauthScopes || []))
      .replace(/{{CUSTOM_HEADERS}}/g, JSON.stringify(template.customHeaders || {}, null, 2));
  }

  /**
   * Generate test file for new adapter
   */
  public static generateAdapterTest(template: POSIntegrationTemplate): string {
    const testTemplate = this.getTestTemplate();
    
    return testTemplate
      .replace(/{{POS_TYPE}}/g, template.posType)
      .replace(/{{POS_NAME}}/g, template.name)
      .replace(/{{ADAPTER_CLASS}}/g, this.getAdapterClassName(template.posType))
      .replace(/{{TEST_CREDENTIALS}}/g, this.generateTestCredentials(template))
      .replace(/{{TEST_ENDPOINTS}}/g, JSON.stringify(template.testEndpoints));
  }

  /**
   * Create integration checklist
   */
  public static createIntegrationChecklist(posType: string): IntegrationChecklist {
    return {
      adapterImplemented: false,
      authenticationTested: false,
      dataTransformationTested: false,
      webhooksConfigured: false,
      errorHandlingTested: false,
      rateLimitingTested: false,
      documentationComplete: false,
      testsWritten: false
    };
  }

  /**
   * Validate integration completeness
   */
  public static validateIntegration(
    posType: POSSystemType,
    adapter: POSAdapter,
    checklist: IntegrationChecklist
  ): { isValid: boolean; missingItems: string[] } {
    const missingItems: string[] = [];

    // Check adapter implementation
    if (!adapter || adapter.posType !== posType) {
      missingItems.push('Adapter implementation');
    }

    // Check required methods
    const requiredMethods = [
      'testConnection',
      'authenticate',
      'getLocations',
      'getTransactions',
      'setupWebhooks',
      'validateWebhook',
      'transformRawData'
    ];

    for (const method of requiredMethods) {
      if (typeof (adapter as any)[method] !== 'function') {
        missingItems.push(`${method} method`);
      }
    }

    // Check checklist items
    Object.entries(checklist).forEach(([key, completed]) => {
      if (!completed) {
        missingItems.push(key.replace(/([A-Z])/g, ' $1').toLowerCase());
      }
    });

    return {
      isValid: missingItems.length === 0,
      missingItems
    };
  }

  /**
   * Register new POS adapter in the system
   */
  public static async registerAdapter(
    posType: POSSystemType,
    adapter: POSAdapter,
    template: POSIntegrationTemplate
  ): Promise<void> {
    try {
      // Add to detector
      const fingerprint: POSFingerprint = {
        baseUrl: template.baseUrl,
        testEndpoints: template.testEndpoints,
        authenticationMethod: template.authMethod,
        responseSignature: template.responseSignature,
        headers: template.customHeaders
      };

      // Update detection mappings (this would typically be done through configuration)
      console.log(`Registering ${posType} adapter with fingerprint:`, fingerprint);

      // Add to webhook manager
      const webhookManager = WebhookManager.getInstance();
      webhookManager.addAdapter(posType, adapter);

      // Update configuration templates
      POSDetector.getConfigurationTemplate(posType);

      console.log(`Successfully registered ${posType} adapter`);
    } catch (error) {
      throw new Error(`Failed to register ${posType} adapter: ${error.message}`);
    }
  }

  /**
   * Get adapter template content
   */
  private static getAdapterTemplate(): string {
    return `/**
 * {{POS_NAME}} POS Integration Adapter
 * {{POS_DESCRIPTION}}
 * Market Focus: {{MARKET_FOCUS}}
 */

import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import {
  POSAdapter,
  POSSystemType,
  AuthCredentials,
  StandardizedTaxData,
  LocationInfo,
  TaxLine,
  WebhookConfiguration,
  POSIntegrationError
} from '../types';
import { TaxDataTransformer } from '../transformer';
import { RateLimitManager } from '../rate-limiter';

export class {{ADAPTER_CLASS}} implements POSAdapter {
  public readonly posType: POSSystemType = '{{POS_TYPE}}';
  public readonly name = '{{POS_NAME}}';
  public readonly supportedFeatures = {{SUPPORTED_FEATURES}};

  private transformer: TaxDataTransformer;
  private rateLimiter: RateLimitManager;
  private baseUrl = '{{BASE_URL}}';

  constructor() {
    this.transformer = new TaxDataTransformer('{{POS_TYPE}}', {{TAX_DATA_SCHEMA}});
    this.rateLimiter = RateLimitManager.getInstance();
  }

  /**
   * Test connection to {{POS_NAME}} API
   */
  public async testConnection(credentials: AuthCredentials): Promise<boolean> {
    try {
      // Validate required credentials
      const required = {{REQUIRED_CREDENTIALS}};
      for (const field of required) {
        if (!(credentials as any)[field]) {
          throw new POSIntegrationError(
            \`Missing required credential: \${field}\`,
            'INVALID_CREDENTIALS',
            '{{POS_TYPE}}'
          );
        }
      }

      const response = await this.rateLimiter.executeRequest(
        '{{POS_TYPE}}',
        () => this.makeRequest('{{TEST_ENDPOINT}}', 'GET', credentials)
      );

      return response.status === 200;
    } catch (error) {
      console.error('{{POS_NAME}} connection test failed:', error);
      return false;
    }
  }

  /**
   * Authenticate and validate credentials
   */
  public async authenticate(credentials: AuthCredentials): Promise<AuthCredentials> {
    try {
      const isValid = await this.testConnection(credentials);
      if (!isValid) {
        throw new POSIntegrationError(
          'Invalid {{POS_NAME}} credentials',
          'AUTH_FAILED',
          '{{POS_TYPE}}'
        );
      }

      // TODO: Enrich credentials with additional information
      return credentials;
    } catch (error) {
      if (error instanceof POSIntegrationError) {
        throw error;
      }
      throw new POSIntegrationError(
        \`{{POS_NAME}} authentication failed: \${error.message}\`,
        'AUTH_FAILED',
        '{{POS_TYPE}}',
        error.response?.status,
        false
      );
    }
  }

  /**
   * Get all locations
   */
  public async getLocations(credentials: AuthCredentials): Promise<LocationInfo[]> {
    try {
      // TODO: Implement location fetching
      const response = await this.rateLimiter.executeRequest(
        '{{POS_TYPE}}',
        () => this.makeRequest('/locations', 'GET', credentials)
      );

      return response.data.locations.map((location: any) => ({
        id: String(location.id),
        name: location.name,
        address: {
          street: location.address?.street || '',
          city: location.address?.city || '',
          state: location.address?.state || '',
          zipCode: location.address?.zipCode || '',
          country: location.address?.country || 'US'
        },
        timezone: location.timezone,
        taxSettings: {
          taxIncluded: location.taxIncluded || false,
          exemptions: []
        }
      }));
    } catch (error) {
      throw this.wrapError(error, 'Failed to get {{POS_NAME}} locations');
    }
  }

  /**
   * Get transactions for a specific date range
   */
  public async getTransactions(
    credentials: AuthCredentials,
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StandardizedTaxData[]> {
    try {
      // TODO: Implement transaction fetching
      const params = {
        location_id: locationId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      };

      const response = await this.rateLimiter.executeRequest(
        '{{POS_TYPE}}',
        () => this.makeRequest('/transactions', 'GET', credentials, { params })
      );

      const transactions = response.data.transactions || [];

      return transactions.map((transaction: any) => {
        try {
          return this.transformer.transform(transaction);
        } catch (error) {
          console.error(\`Failed to transform {{POS_NAME}} transaction \${transaction.id}:\`, error);
          return null;
        }
      }).filter(Boolean) as StandardizedTaxData[];
    } catch (error) {
      throw this.wrapError(error, 'Failed to get {{POS_NAME}} transactions');
    }
  }

  /**
   * Setup webhooks for real-time notifications
   */
  public async setupWebhooks(
    credentials: AuthCredentials,
    webhookUrl: string
  ): Promise<WebhookConfiguration> {
    try {
      const webhookEvents = {{WEBHOOK_EVENTS}};

      // TODO: Implement webhook setup
      const webhookData = {
        url: \`\${webhookUrl}/{{POS_TYPE}}\`,
        events: webhookEvents
      };

      const response = await this.rateLimiter.executeRequest(
        '{{POS_TYPE}}',
        () => this.makeRequest('/webhooks', 'POST', credentials, { data: webhookData })
      );

      return {
        endpoint: \`\${webhookUrl}/{{POS_TYPE}}\`,
        events: webhookEvents,
        signatureValidation: true,
        retryLogic: {
          maxAttempts: 3,
          backoff: 'exponential',
          baseDelayMs: 1000,
          maxDelayMs: 30000
        },
        secretKey: response.data.secret || crypto.randomBytes(32).toString('hex')
      };
    } catch (error) {
      throw this.wrapError(error, 'Failed to setup {{POS_NAME}} webhooks');
    }
  }

  /**
   * Validate webhook signature
   */
  public validateWebhook(payload: any, signature: string, secret: string): boolean {
    try {
      // TODO: Implement signature validation based on {{POS_NAME}} specification
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(payload));
      const calculatedSignature = hmac.digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(calculatedSignature, 'hex')
      );
    } catch (error) {
      console.error('{{POS_NAME}} webhook validation error:', error);
      return false;
    }
  }

  /**
   * Transform raw {{POS_NAME}} data to standardized format
   */
  public transformRawData(rawData: any): StandardizedTaxData {
    return this.transformer.transform(rawData);
  }

  /**
   * Get historical data for a location (optional method)
   */
  public async getHistoricalData(
    credentials: AuthCredentials,
    locationId: string,
    days: number
  ): Promise<StandardizedTaxData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getTransactions(credentials, locationId, startDate, endDate);
  }

  /**
   * Make authenticated request to {{POS_NAME}} API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    credentials: AuthCredentials,
    options?: AxiosRequestConfig
  ): Promise<any> {
    const url = \`\${this.baseUrl}\${endpoint}\`;
    
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        'Authorization': \`Bearer \${credentials.accessToken}\`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...{{CUSTOM_HEADERS}}
      },
      timeout: 30000,
      ...options
    };

    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      throw this.wrapError(error, \`{{POS_NAME}} API request failed: \${method} \${endpoint}\`);
    }
  }

  /**
   * Wrap errors in POSIntegrationError
   */
  private wrapError(error: any, message: string): POSIntegrationError {
    let code = 'UNKNOWN_ERROR';
    let retryable = false;
    let statusCode: number | undefined;

    if (error.response) {
      statusCode = error.response.status;
      
      switch (statusCode) {
        case 429:
          code = 'RATE_LIMITED';
          retryable = true;
          break;
        case 401:
        case 403:
          code = 'AUTH_ERROR';
          retryable = false;
          break;
        case 404:
          code = 'NOT_FOUND';
          retryable = false;
          break;
        default:
          if (statusCode >= 500) {
            code = 'SERVER_ERROR';
            retryable = true;
          }
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      code = 'CONNECTION_ERROR';
      retryable = true;
    }

    return new POSIntegrationError(
      \`\${message}: \${error.message}\`,
      code,
      '{{POS_TYPE}}',
      statusCode,
      retryable,
      { originalError: error, endpoint: error.config?.url }
    );
  }
}`;
  }

  /**
   * Get test template content
   */
  private static getTestTemplate(): string {
    return `/**
 * {{POS_NAME}} Adapter Tests
 */

import { {{ADAPTER_CLASS}} } from '../adapters/{{ADAPTER_CLASS}}';
import { AuthCredentials, POSIntegrationError } from '../types';

describe('{{ADAPTER_CLASS}}', () => {
  let adapter: {{ADAPTER_CLASS}};
  let mockCredentials: AuthCredentials;

  beforeEach(() => {
    adapter = new {{ADAPTER_CLASS}}();
    mockCredentials = {{TEST_CREDENTIALS}};
  });

  describe('initialization', () => {
    it('should have correct POS type', () => {
      expect(adapter.posType).toBe('{{POS_TYPE}}');
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('{{POS_NAME}}');
    });

    it('should have supported features', () => {
      expect(adapter.supportedFeatures).toBeInstanceOf(Array);
      expect(adapter.supportedFeatures.length).toBeGreaterThan(0);
    });
  });

  describe('testConnection', () => {
    it('should return false for invalid credentials', async () => {
      const result = await adapter.testConnection({} as AuthCredentials);
      expect(result).toBe(false);
    });

    // TODO: Add more connection tests
  });

  describe('authenticate', () => {
    it('should throw error for invalid credentials', async () => {
      await expect(adapter.authenticate({} as AuthCredentials))
        .rejects.toThrow(POSIntegrationError);
    });

    // TODO: Add more authentication tests
  });

  describe('getLocations', () => {
    // TODO: Implement location tests
  });

  describe('getTransactions', () => {
    // TODO: Implement transaction tests
  });

  describe('setupWebhooks', () => {
    // TODO: Implement webhook tests
  });

  describe('validateWebhook', () => {
    it('should validate webhook signatures correctly', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const signature = 'valid-signature'; // TODO: Generate actual signature
      
      // TODO: Implement actual validation test
      expect(typeof adapter.validateWebhook(payload, signature, secret)).toBe('boolean');
    });
  });

  describe('transformRawData', () => {
    it('should transform raw data to standardized format', () => {
      const rawData = {
        // TODO: Add sample raw data from {{POS_NAME}}
      };

      const result = adapter.transformRawData(rawData);
      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('totalAmount');
      expect(result).toHaveProperty('totalTax');
    });
  });
});`;
  }

  /**
   * Get adapter class name
   */
  private static getAdapterClassName(posType: string): string {
    return posType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('') + 'Adapter';
  }

  /**
   * Generate test credentials based on auth method
   */
  private static generateTestCredentials(template: POSIntegrationTemplate): string {
    const credentials: any = { type: template.authMethod };

    switch (template.authMethod) {
      case 'oauth':
        credentials.accessToken = 'test-access-token';
        if (template.requiredCredentials.includes('refreshToken')) {
          credentials.refreshToken = 'test-refresh-token';
        }
        break;
      case 'api_key':
        credentials.apiKey = 'test-api-key';
        break;
      case 'custom':
        credentials.customCredentials = { testKey: 'test-value' };
        break;
    }

    // Add POS-specific credentials
    template.requiredCredentials.forEach(field => {
      if (!credentials[field]) {
        credentials[field] = `test-${field.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      }
    });

    return JSON.stringify(credentials, null, 2);
  }
}

/**
 * Integration Development Guide
 * Step-by-step process for adding new POS integrations
 */
export class IntegrationGuide {
  /**
   * Get development steps for new integration
   */
  public static getDevelopmentSteps(posType: string): string[] {
    return [
      '1. Research POS System',
      '   - API documentation review',
      '   - Authentication methods',
      '   - Rate limits and restrictions',
      '   - Available endpoints for tax data',
      '   - Webhook capabilities',
      '',
      '2. Create Integration Template',
      \`   - Run: POSIntegrationFactory.createTemplate('\${posType}')\`,
      '   - Fill in all template fields',
      '   - Define tax data schema mapping',
      '   - Configure rate limits',
      '',
      '3. Generate Adapter Code',
      \`   - Run: POSIntegrationFactory.generateAdapter(template)\`,
      '   - Implement authentication logic',
      '   - Implement data fetching methods',
      '   - Implement webhook handling',
      '   - Add error handling',
      '',
      '4. Create Tests',
      \`   - Run: POSIntegrationFactory.generateAdapterTest(template)\`,
      '   - Add unit tests for all methods',
      '   - Add integration tests with mock data',
      '   - Test error scenarios',
      '',
      '5. Integration Testing',
      '   - Test with sandbox/development POS account',
      '   - Verify data transformation accuracy',
      '   - Test webhook delivery and validation',
      '   - Test rate limiting behavior',
      '',
      '6. Documentation',
      '   - API integration guide',
      '   - Setup instructions for merchants',
      '   - Troubleshooting guide',
      '   - Feature limitations and known issues',
      '',
      '7. Registration and Deployment',
      \`   - Run: POSIntegrationFactory.registerAdapter('\${posType}', adapter, template)\`,
      '   - Update detection fingerprints',
      '   - Deploy to staging environment',
      '   - Conduct end-to-end testing',
      '',
      '8. Production Deployment',
      '   - Deploy to production',
      '   - Monitor error rates and performance',
      '   - Set up alerting and monitoring',
      '   - Update user documentation'
    ];
  }

  /**
   * Get testing checklist
   */
  public static getTestingChecklist(): string[] {
    return [
      '✅ Authentication flow tested',
      '✅ Connection test passes',
      '✅ Location data retrieval works',
      '✅ Transaction data retrieval works',
      '✅ Data transformation is accurate',
      '✅ Tax calculations are correct',
      '✅ Webhook setup functions',
      '✅ Webhook signature validation works',
      '✅ Error handling covers all scenarios',
      '✅ Rate limiting respects POS limits',
      '✅ Retry logic functions correctly',
      '✅ Integration handles edge cases',
      '✅ Performance meets requirements',
      '✅ Security review completed',
      '✅ Documentation is complete',
      '✅ End-to-end testing passed'
    ];
  }

  /**
   * Get common pitfalls and solutions
   */
  public static getCommonPitfalls(): Record<string, string> {
    return {
      'Rate Limiting': 'Always implement proper rate limiting and respect POS system limits. Use exponential backoff for retries.',
      'Authentication': 'Handle token expiration gracefully. Implement refresh token logic where available.',
      'Data Mapping': 'POS systems have different data structures. Always validate field mappings with real data.',
      'Webhooks': 'Implement proper signature validation and handle webhook retries. Test webhook reliability.',
      'Error Handling': 'Categorize errors correctly (retryable vs non-retryable). Log errors with sufficient context.',
      'Testing': 'Test with real POS sandbox accounts. Mock data may not reflect real-world edge cases.',
      'Timezone Handling': 'Be careful with timezone conversions. Store timestamps in UTC when possible.',
      'Currency Handling': 'Some POS systems use cents, others use decimal amounts. Normalize carefully.',
      'Pagination': 'Implement proper pagination handling for large datasets. Set reasonable limits.',
      'Configuration': 'Make integration configurable. Different merchants may have different requirements.'
    };
  }
}

/**
 * Example usage and integration templates
 */
export class IntegrationExamples {
  /**
   * Get example integration template for Clover POS
   */
  public static getCloverExample(): POSIntegrationTemplate {
    return {
      posType: 'clover',
      name: 'Clover POS',
      description: 'Comprehensive merchant services platform',
      marketFocus: 'Small to medium businesses, restaurants',
      supportedFeatures: [
        'Detailed Tax Data',
        'Hardware Integration',
        'Merchant Services',
        'Restaurant Features',
        'Multi-location Support',
        'Real-time Updates'
      ],
      authMethod: 'oauth',
      baseUrl: 'https://api.clover.com/v3',
      testEndpoints: ['/merchants/{mId}', '/merchants/{mId}/orders'],
      responseSignature: 'Clover-Api-Version',
      rateLimit: {
        requestsPerSecond: 5,
        requestsPerMinute: 1000,
        burstLimit: 10
      },
      taxDataSchema: {
        totalTaxField: 'tax',
        taxLinesField: 'lineItems[].modifications',
        taxRateField: 'percentage',
        taxAmountField: 'amount',
        locationField: 'device.merchant.id',
        transactionIdField: 'id',
        timestampField: 'createdTime',
        totalAmountField: 'total',
        lineItemsField: 'lineItems',
        statusField: 'state'
      },
      webhookEvents: [
        'orders.created',
        'orders.updated',
        'orders.deleted',
        'payments.created',
        'refunds.created'
      ],
      requiredCredentials: ['accessToken', 'merchantId'],
      oauthScopes: ['read:orders', 'read:payments', 'read:merchant'],
      customHeaders: {
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Get example integration template for Toast POS
   */
  public static getToastExample(): POSIntegrationTemplate {
    return {
      posType: 'toast',
      name: 'Toast POS',
      description: 'Restaurant-focused POS system',
      marketFocus: 'Restaurants and food service businesses',
      supportedFeatures: [
        'Restaurant-specific Tax',
        'Alcohol Tax Handling',
        'Delivery Tax',
        'Order Management',
        'Menu Management',
        'Kitchen Integration'
      ],
      authMethod: 'oauth',
      baseUrl: 'https://ws-api.toasttab.com',
      testEndpoints: ['/config/v1/restaurants/{restaurantGuid}', '/orders/v2/orders'],
      responseSignature: 'Toast-Restaurant-External-Id',
      rateLimit: {
        requestsPerSecond: 1,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 5
      },
      taxDataSchema: {
        totalTaxField: 'totalTax',
        taxLinesField: 'appliedTaxes',
        taxRateField: 'taxRate',
        taxAmountField: 'taxAmount',
        locationField: 'restaurantLocationGuid',
        transactionIdField: 'guid',
        timestampField: 'createdDate',
        totalAmountField: 'totalAmount',
        lineItemsField: 'selections',
        statusField: 'voidInfo.voidDate'
      },
      webhookEvents: [
        'orders.created',
        'orders.updated',
        'orders.sent',
        'orders.fired',
        'orders.completed'
      ],
      requiredCredentials: ['accessToken', 'restaurantGuid'],
      oauthScopes: ['orders:read', 'config:read'],
      customHeaders: {
        'Content-Type': 'application/json'
      }
    };
  }
}
