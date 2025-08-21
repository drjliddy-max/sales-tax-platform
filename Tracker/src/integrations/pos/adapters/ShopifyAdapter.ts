/**
 * Shopify POS Integration Adapter
 * Handles Shopify-specific API interactions, OAuth, and tax data extraction
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

export class ShopifyAdapter implements POSAdapter {
  public readonly posType: POSSystemType = 'shopify';
  public readonly name = 'Shopify POS';
  public readonly supportedFeatures = [
    'Advanced Tax Calculation',
    'Multi-jurisdiction',
    'Real-time Webhooks',
    'Tax Exemptions',
    'Multi-location',
    'Order Management',
    'Customer Data',
    'Product Catalog'
  ];

  private transformer: TaxDataTransformer;
  private rateLimiter: RateLimitManager;

  constructor() {
    this.transformer = new TaxDataTransformer('shopify', {
      totalTaxField: 'total_tax',
      taxLinesField: 'tax_lines',
      taxRateField: 'rate',
      taxAmountField: 'price',
      jurisdictionField: 'source',
      locationField: 'location_id',
      transactionIdField: 'id',
      timestampField: 'created_at',
      totalAmountField: 'total_price',
      lineItemsField: 'line_items',
      statusField: 'financial_status'
    });
    this.rateLimiter = RateLimitManager.getInstance();
  }

  /**
   * Test connection to Shopify API
   */
  public async testConnection(credentials: AuthCredentials): Promise<boolean> {
    try {
      if (!credentials.accessToken || !credentials.shopDomain) {
        throw new POSIntegrationError(
          'Missing required credentials: accessToken and shopDomain',
          'INVALID_CREDENTIALS',
          'shopify'
        );
      }

      const response = await this.rateLimiter.executeRequest(
        'shopify',
        () => this.makeRequest('/shop.json', 'GET', credentials)
      );

      return response.status === 200 && response.data?.shop;
    } catch (error) {
      console.error('Shopify connection test failed:', error);
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
          'Invalid Shopify credentials',
          'AUTH_FAILED',
          'shopify'
        );
      }

      // Get shop information to enrich credentials
      const shopResponse = await this.rateLimiter.executeRequest(
        'shopify',
        () => this.makeRequest('/shop.json', 'GET', credentials)
      );

      const shop = shopResponse.data.shop;

      return {
        ...credentials,
        shopDomain: shop.domain,
        // Store additional shop info in customCredentials
        customCredentials: {
          shopId: shop.id,
          shopName: shop.name,
          email: shop.email,
          currency: shop.currency,
          timezone: shop.iana_timezone,
          taxesIncluded: shop.taxes_included
        }
      };
    } catch (error) {
      if (error instanceof POSIntegrationError) {
        throw error;
      }
      throw new POSIntegrationError(
        `Shopify authentication failed: ${error.message}`,
        'AUTH_FAILED',
        'shopify',
        error.response?.status,
        false
      );
    }
  }

  /**
   * Get all locations for the shop
   */
  public async getLocations(credentials: AuthCredentials): Promise<LocationInfo[]> {
    try {
      const response = await this.rateLimiter.executeRequest(
        'shopify',
        () => this.makeRequest('/locations.json', 'GET', credentials)
      );

      return response.data.locations.map((location: any) => ({
        id: String(location.id),
        name: location.name,
        address: {
          street: [location.address1, location.address2].filter(Boolean).join(', '),
          city: location.city || '',
          state: location.province || '',
          zipCode: location.zip || '',
          country: location.country_code || location.country || 'US'
        },
        timezone: credentials.customCredentials?.timezone,
        taxSettings: {
          taxIncluded: credentials.customCredentials?.taxesIncluded || false,
          exemptions: []
        }
      }));
    } catch (error) {
      throw this.wrapError(error, 'Failed to get Shopify locations');
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
      const params = {
        location_id: locationId,
        created_at_min: startDate.toISOString(),
        created_at_max: endDate.toISOString(),
        status: 'any',
        limit: 250 // Shopify max limit
      };

      let allOrders: any[] = [];
      let hasNextPage = true;
      let pageInfo: string | null = null;

      // Handle pagination
      while (hasNextPage) {
        const queryParams = pageInfo 
          ? { ...params, page_info: pageInfo }
          : params;

        const response = await this.rateLimiter.executeRequest(
          'shopify',
          () => this.makeRequest('/orders.json', 'GET', credentials, { params: queryParams })
        );

        const orders = response.data.orders;
        allOrders = allOrders.concat(orders);

        // Check for pagination
        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel=\"next\"')) {
          const nextMatch = linkHeader.match(/<([^>]+)>.*rel="next"/);
          if (nextMatch) {
            const url = new URL(nextMatch[1]);
            pageInfo = url.searchParams.get('page_info');
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }

        // Prevent infinite loops
        if (allOrders.length > 10000) {
          console.warn('Shopify: Reached maximum order limit (10,000), stopping pagination');
          break;
        }
      }

      // Transform orders to standardized format
      const transformedData = await Promise.all(
        allOrders.map(async (order) => {
          try {
            // Enrich order with additional details if needed
            const enrichedOrder = await this.enrichOrderData(order, credentials);
            return this.transformer.transform(enrichedOrder);
          } catch (error) {
            console.error(`Failed to transform Shopify order ${order.id}:`, error);
            return null;
          }
        })
      );

      return transformedData.filter(Boolean) as StandardizedTaxData[];
    } catch (error) {
      throw this.wrapError(error, 'Failed to get Shopify transactions');
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
      const webhookEvents = [
        'orders/create',
        'orders/updated',
        'orders/paid',
        'orders/cancelled',
        'orders/refunded'
      ];

      const createdWebhooks = [];

      for (const event of webhookEvents) {
        try {
          const webhookData = {
            webhook: {
              topic: event,
              address: `${webhookUrl}/shopify`,
              format: 'json'
            }
          };

          const response = await this.rateLimiter.executeRequest(
            'shopify',
            () => this.makeRequest('/webhooks.json', 'POST', credentials, { data: webhookData })
          );

          createdWebhooks.push(response.data.webhook);
        } catch (error) {
          console.error(`Failed to create Shopify webhook for ${event}:`, error);
        }
      }

      return {
        endpoint: `${webhookUrl}/shopify`,
        events: webhookEvents,
        signatureValidation: true,
        retryLogic: {
          maxAttempts: 3,
          backoff: 'exponential',
          baseDelayMs: 1000,
          maxDelayMs: 30000
        },
        secretKey: process.env.SHOPIFY_WEBHOOK_SECRET
      };
    } catch (error) {
      throw this.wrapError(error, 'Failed to setup Shopify webhooks');
    }
  }

  /**
   * Validate webhook signature
   */
  public validateWebhook(payload: any, signature: string, secret: string): boolean {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(payload));
      const calculatedSignature = hmac.digest('base64');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(calculatedSignature, 'base64')
      );
    } catch (error) {
      console.error('Shopify webhook validation error:', error);
      return false;
    }
  }

  /**
   * Transform raw Shopify data to standardized format
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
      // Get shop's tax settings
      const response = await this.rateLimiter.executeRequest(
        'shopify',
        () => this.makeRequest('/shop.json', 'GET', credentials)
      );

      const shop = response.data.shop;
      const taxRates: TaxLine[] = [];

      // Extract tax information from shop settings
      if (shop.tax_shipping) {
        taxRates.push({
          name: 'Shipping Tax',
          rate: 0, // Rate varies by location
          amount: 0,
          jurisdiction: shop.primary_location_id?.toString() || locationId,
          type: 'percentage'
        });
      }

      // Note: Shopify tax rates are dynamic and location-dependent
      // They're calculated at order time based on shipping address
      return taxRates;
    } catch (error) {
      console.error('Failed to get Shopify tax rates:', error);
      return [];
    }
  }

  /**
   * Make authenticated request to Shopify API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    credentials: AuthCredentials,
    options?: AxiosRequestConfig
  ): Promise<any> {
    const url = `https://${credentials.shopDomain}/admin/api/2023-10${endpoint}`;
    
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        'X-Shopify-Access-Token': credentials.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000,
      ...options
    };

    try {
      const response = await axios(config);
      return response;
    } catch (error) {
      throw this.wrapError(error, `Shopify API request failed: ${method} ${endpoint}`);
    }
  }

  /**
   * Enrich order data with additional details
   */
  private async enrichOrderData(order: any, credentials: AuthCredentials): Promise<any> {
    try {
      // Add location information if not present
      if (order.location_id && !order.location) {
        const locations = await this.getLocations(credentials);
        order.location = locations.find(loc => loc.id === order.location_id?.toString());
      }

      // Add transaction data if available
      if (order.transactions && order.transactions.length === 0) {
        try {
          const transactionResponse = await this.rateLimiter.executeRequest(
            'shopify',
            () => this.makeRequest(`/orders/${order.id}/transactions.json`, 'GET', credentials)
          );
          order.transactions = transactionResponse.data.transactions;
        } catch (error) {
          // Transactions might not be available, continue without them
          console.debug(`Could not fetch transactions for order ${order.id}`);
        }
      }

      return order;
    } catch (error) {
      console.error('Failed to enrich Shopify order data:', error);
      return order; // Return original order if enrichment fails
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
        case 422:
          code = 'VALIDATION_ERROR';
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
      'shopify',
      statusCode,
      retryable,
      { originalError: error, endpoint: error.config?.url }
    );
  }

  /**
   * Handle OAuth flow initiation (for public apps)
   */
  public static generateOAuthUrl(
    clientId: string,
    shopDomain: string,
    redirectUri: string,
    scopes: string[] = ['read_orders', 'read_products', 'read_locations']
  ): string {
    const params = new URLSearchParams({
      client_id: clientId,
      scope: scopes.join(','),
      redirect_uri: redirectUri,
      state: crypto.randomBytes(16).toString('hex') // CSRF protection
    });

    return `https://${shopDomain}/admin/oauth/authorize?${params}`;
  }

  /**
   * Exchange authorization code for access token
   */
  public static async exchangeCodeForToken(
    clientId: string,
    clientSecret: string,
    shopDomain: string,
    code: string
  ): Promise<{ accessToken: string; scope: string }> {
    try {
      const response = await axios.post(
        `https://${shopDomain}/admin/oauth/access_token`,
        {
          client_id: clientId,
          client_secret: clientSecret,
          code
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        scope: response.data.scope
      };
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to exchange authorization code: ${error.message}`,
        'AUTH_FAILED',
        'shopify',
        error.response?.status,
        false
      );
    }
  }
}
