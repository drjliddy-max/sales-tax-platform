/**
 * Square POS Integration Adapter
 * Handles Square-specific API interactions, OAuth, and tax data extraction
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

export class SquareAdapter implements POSAdapter {
  public readonly posType: POSSystemType = 'square';
  public readonly name = 'Square POS';
  public readonly supportedFeatures = [
    'Good Tax Support',
    'Simple Integration',
    'Real-time Updates',
    'Multi-location',
    'Payment Processing',
    'Inventory Management',
    'Customer Management',
    'Order Management'
  ];

  private transformer: TaxDataTransformer;
  private rateLimiter: RateLimitManager;
  private baseUrl: string;

  constructor(environment: 'production' | 'sandbox' = 'production') {
    this.baseUrl = environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    this.transformer = new TaxDataTransformer('square', {
      totalTaxField: 'total_tax_money.amount',
      taxLinesField: 'line_items[].taxes',
      taxRateField: 'percentage',
      taxAmountField: 'applied_money.amount',
      locationField: 'location_id',
      transactionIdField: 'id',
      timestampField: 'created_at',
      totalAmountField: 'total_money.amount',
      lineItemsField: 'line_items',
      statusField: 'state'
    });
    
    this.rateLimiter = RateLimitManager.getInstance();
  }

  /**
   * Test connection to Square API
   */
  public async testConnection(credentials: AuthCredentials): Promise<boolean> {
    try {
      if (!credentials.accessToken) {
        throw new POSIntegrationError(
          'Missing required credentials: accessToken',
          'INVALID_CREDENTIALS',
          'square'
        );
      }

      const response = await this.rateLimiter.executeRequest(
        'square',
        () => this.makeRequest('/v2/locations', 'GET', credentials)
      );

      return response.status === 200 && response.data?.locations;
    } catch (error) {
      console.error('Square connection test failed:', error);
      return false;
    }
  }

  /**
   * Authenticate and validate credentials
   */
  public async authenticate(credentials: AuthCredentials): Promise<AuthCredentials> {
    try {
      // Test the provided credentials
      const isValid = await this.testConnection(credentials);
      if (!isValid) {
        throw new POSIntegrationError(
          'Invalid Square credentials',
          'AUTH_FAILED',
          'square'
        );
      }

      // Get merchant information to enrich credentials
      const locationsResponse = await this.rateLimiter.executeRequest(
        'square',
        () => this.makeRequest('/v2/locations', 'GET', credentials)
      );

      const locations = locationsResponse.data.locations;
      const mainLocation = locations.find((loc: any) => loc.type === 'PHYSICAL') || locations[0];

      return {
        ...credentials,
        customCredentials: {
          merchantId: mainLocation?.merchant_id,
          businessName: mainLocation?.business_name,
          locationCount: locations.length,
          currency: mainLocation?.currency || 'USD',
          country: mainLocation?.country || 'US',
          timezone: mainLocation?.timezone
        }
      };
    } catch (error) {
      if (error instanceof POSIntegrationError) {
        throw error;
      }
      throw new POSIntegrationError(
        `Square authentication failed: ${error.message}`,
        'AUTH_FAILED',
        'square',
        error.response?.status,
        false
      );
    }
  }

  /**
   * Get all locations for the merchant
   */
  public async getLocations(credentials: AuthCredentials): Promise<LocationInfo[]> {
    try {
      const response = await this.rateLimiter.executeRequest(
        'square',
        () => this.makeRequest('/v2/locations', 'GET', credentials)
      );

      return response.data.locations.map((location: any) => ({
        id: location.id,
        name: location.name,
        address: {
          street: location.address?.address_line_1 || '',
          city: location.address?.locality || '',
          state: location.address?.administrative_district_level_1 || '',
          zipCode: location.address?.postal_code || '',
          country: location.address?.country || location.country || 'US'
        },
        timezone: location.timezone,
        taxSettings: {
          taxIncluded: false, // Square typically doesn't include tax in prices
          exemptions: []
        }
      }));
    } catch (error) {
      throw this.wrapError(error, 'Failed to get Square locations');
    }
  }

  /**
   * Get transactions (orders) for a specific date range
   */
  public async getTransactions(
    credentials: AuthCredentials,
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StandardizedTaxData[]> {
    try {
      // First get orders
      const orders = await this.getOrders(credentials, locationId, startDate, endDate);
      
      // Then get payments for additional context
      const payments = await this.getPayments(credentials, locationId, startDate, endDate);

      // Combine orders and payments data
      const combinedData = orders.map(order => {
        const relatedPayments = payments.filter(payment => 
          payment.order_id === order.id
        );
        return {
          ...order,
          payments: relatedPayments
        };
      });

      // Transform to standardized format
      const transformedData = combinedData.map(data => {
        try {
          return this.transformer.transform(data);
        } catch (error) {
          console.error(`Failed to transform Square order ${data.id}:`, error);
          return null;
        }
      });

      return transformedData.filter(Boolean) as StandardizedTaxData[];
    } catch (error) {
      throw this.wrapError(error, 'Failed to get Square transactions');
    }
  }

  /**
   * Get orders from Square
   */
  private async getOrders(
    credentials: AuthCredentials,
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const searchRequest = {
      location_ids: [locationId],
      query: {
        filter: {
          date_time_filter: {
            created_at: {
              start_at: startDate.toISOString(),
              end_at: endDate.toISOString()
            }
          }
        },
        sort: {
          sort_field: 'CREATED_AT',
          sort_order: 'DESC'
        }
      },
      limit: 500 // Square max limit
    };

    let allOrders: any[] = [];
    let cursor: string | undefined;

    do {
      if (cursor) {
        searchRequest.cursor = cursor;
      }

      const response = await this.rateLimiter.executeRequest(
        'square',
        () => this.makeRequest('/v2/orders/search', 'POST', credentials, { data: searchRequest })
      );

      const orders = response.data.orders || [];
      allOrders = allOrders.concat(orders);
      
      cursor = response.data.cursor;
    } while (cursor && allOrders.length < 10000); // Prevent infinite loops

    return allOrders;
  }

  /**
   * Get payments from Square
   */
  private async getPayments(
    credentials: AuthCredentials,
    locationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const params = {
      location_id: locationId,
      begin_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      sort_order: 'DESC',
      limit: 100 // Square payment limit
    };

    let allPayments: any[] = [];
    let cursor: string | undefined;

    do {
      const queryParams = cursor ? { ...params, cursor } : params;

      const response = await this.rateLimiter.executeRequest(
        'square',
        () => this.makeRequest('/v2/payments', 'GET', credentials, { params: queryParams })
      );

      const payments = response.data.payments || [];
      allPayments = allPayments.concat(payments);
      
      cursor = response.data.cursor;
    } while (cursor && allPayments.length < 10000); // Prevent infinite loops

    return allPayments;
  }

  /**
   * Setup webhooks for real-time notifications
   */
  public async setupWebhooks(
    credentials: AuthCredentials,
    webhookUrl: string
  ): Promise<WebhookConfiguration> {
    try {
      const webhookEvents = [
        'order.created',
        'order.updated',
        'payment.created',
        'payment.updated',
        'refund.created',
        'refund.updated'
      ];

      const subscriptionData = {
        subscription: {
          name: 'Sales Tax Tracker Webhook',
          notification_url: `${webhookUrl}/square`,
          event_types: webhookEvents
        }
      };

      const response = await this.rateLimiter.executeRequest(
        'square',
        () => this.makeRequest('/v2/webhooks/subscriptions', 'POST', credentials, { data: subscriptionData })
      );

      return {
        endpoint: `${webhookUrl}/square`,
        events: webhookEvents,
        signatureValidation: true,
        retryLogic: {
          maxAttempts: 5,
          backoff: 'exponential',
          baseDelayMs: 1000,
          maxDelayMs: 60000
        },
        secretKey: response.data.subscription?.signature_key
      };
    } catch (error) {
      throw this.wrapError(error, 'Failed to setup Square webhooks');
    }
  }

  /**
   * Validate webhook signature
   */
  public validateWebhook(payload: any, signature: string, secret: string): boolean {
    try {
      const timestamp = payload.created_at;
      const body = JSON.stringify(payload);
      const stringToSign = `${webhookUrl}/square${body}${timestamp}`;
      
      const hmac = crypto.createHmac('sha1', secret);
      hmac.update(stringToSign);
      const calculatedSignature = hmac.digest('base64');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(calculatedSignature, 'base64')
      );
    } catch (error) {
      console.error('Square webhook validation error:', error);
      return false;
    }
  }

  /**
   * Transform raw Square data to standardized format
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
   * Get tax rates for a location (optional method)
   */
  public async getTaxRates(
    credentials: AuthCredentials,
    locationId: string
  ): Promise<TaxLine[]> {
    try {
      // Square doesn't have a direct tax rates endpoint
      // Tax rates are configured per item or calculated at checkout
      // Return empty array as rates are dynamic
      return [];
    } catch (error) {
      console.error('Failed to get Square tax rates:', error);
      return [];
    }
  }

  /**
   * Make authenticated request to Square API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    credentials: AuthCredentials,
    options?: AxiosRequestConfig
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Square-Version': '2023-10-18' // Use latest Square API version
      },
      timeout: 30000,
      ...options
    };

    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      throw this.wrapError(error, `Square API request failed: ${method} ${endpoint}`);
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
          code = 'AUTH_ERROR';
          retryable = false;
          break;
        case 403:
          code = 'FORBIDDEN';
          retryable = false;
          break;
        case 404:
          code = 'NOT_FOUND';
          retryable = false;
          break;
        case 400:
          code = 'BAD_REQUEST';
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
      `${message}: ${error.message}`,
      code,
      'square',
      statusCode,
      retryable,
      { originalError: error, endpoint: error.config?.url }
    );
  }

  /**
   * Generate OAuth URL for Square
   */
  public static generateOAuthUrl(
    clientId: string,
    redirectUri: string,
    scopes: string[] = ['ORDERS_READ', 'PAYMENTS_READ', 'MERCHANT_PROFILE_READ'],
    state?: string
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes.join(' '),
      session: 'false',
      state: state || crypto.randomBytes(16).toString('hex')
    });

    return `https://connect.squareup.com/oauth2/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  public static async exchangeCodeForToken(
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    try {
      const response = await axios.post(
        'https://connect.squareup.com/oauth2/token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      const data = response.data;
      const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt
      };
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to exchange authorization code: ${error.message}`,
        'AUTH_FAILED',
        'square',
        error.response?.status,
        false
      );
    }
  }

  /**
   * Refresh access token
   */
  public static async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    try {
      const response = await axios.post(
        'https://connect.squareup.com/oauth2/token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      const data = response.data;
      const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt
      };
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to refresh access token: ${error.message}`,
        'AUTH_FAILED',
        'square',
        error.response?.status,
        false
      );
    }
  }
}
