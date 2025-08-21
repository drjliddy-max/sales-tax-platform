/**
 * POS Detection System
 * Automatically identifies POS systems based on API endpoints and responses
 */

import axios, { AxiosResponse } from 'axios';
import {
  POSSystemType,
  POSFingerprint,
  AuthCredentials,
  POSDetectionResult,
  POSConfiguration,
  TaxDataSchema,
  RateLimit,
  POSIntegrationError
} from './types';

export class POSDetector {
  private static readonly DETECTION_TIMEOUT = 10000; // 10 seconds
  private static readonly MAX_PARALLEL_TESTS = 3;

  private static readonly POS_FINGERPRINTS: Record<POSSystemType, POSFingerprint> = {
    shopify: {
      baseUrl: 'https://{shop}.myshopify.com/admin/api/2023-10',
      testEndpoints: ['/shop.json', '/orders.json?limit=1'],
      authenticationMethod: 'oauth',
      responseSignature: 'X-Shopify-Shop-Domain',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },
    square: {
      baseUrl: 'https://connect.squareup.com/v2',
      testEndpoints: ['/locations', '/orders/search'],
      authenticationMethod: 'oauth',
      responseSignature: 'Square-Version',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    },
    clover: {
      baseUrl: 'https://api.clover.com/v3',
      testEndpoints: ['/merchants/{mId}', '/merchants/{mId}/orders'],
      authenticationMethod: 'oauth',
      responseSignature: 'Clover-Api-Version',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    toast: {
      baseUrl: 'https://ws-api.toasttab.com',
      testEndpoints: ['/config/v1/restaurants/{restaurantGuid}', '/orders/v2/orders'],
      authenticationMethod: 'oauth',
      responseSignature: 'Toast-Restaurant-External-Id',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    lightspeed: {
      baseUrl: 'https://api.lightspeedapp.com/API',
      testEndpoints: ['/Account/{accountID}/Shop.json', '/Account/{accountID}/Sale.json'],
      authenticationMethod: 'oauth',
      responseSignature: 'X-Rate-Limit-Remaining',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    paypal_here: {
      baseUrl: 'https://api.paypal.com/v1',
      testEndpoints: ['/payments/payment', '/identity/oauth2/userinfo'],
      authenticationMethod: 'oauth',
      responseSignature: 'Paypal-Debug-Id',
      headers: {
        'Content-Type': 'application/json'
      }
    },
    ncr: {
      baseUrl: 'https://api.ncr.com/v1',
      testEndpoints: ['/sites', '/transactions'],
      authenticationMethod: 'custom',
      responseSignature: 'NCR-Correlation-Id',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  };

  private static readonly SCHEMA_MAPPINGS: Record<POSSystemType, TaxDataSchema> = {
    shopify: {
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
    },
    square: {
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
    },
    clover: {
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
    toast: {
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
    lightspeed: {
      totalTaxField: 'tax',
      taxLinesField: 'SaleLines[].SaleTaxes',
      taxRateField: 'rate',
      taxAmountField: 'amount',
      locationField: 'shopID',
      transactionIdField: 'saleID',
      timestampField: 'createTime',
      totalAmountField: 'total',
      lineItemsField: 'SaleLines'
    },
    paypal_here: {
      totalTaxField: 'amount.details.tax',
      taxLinesField: 'transactions[].item_list.items[].tax',
      taxRateField: 'tax_percentage',
      taxAmountField: 'tax',
      locationField: 'experience_context.locale',
      transactionIdField: 'id',
      timestampField: 'create_time',
      totalAmountField: 'amount.total',
      lineItemsField: 'transactions[].item_list.items'
    },
    ncr: {
      totalTaxField: 'totals.tax',
      taxLinesField: 'lineItems[].taxes',
      taxRateField: 'rate',
      taxAmountField: 'amount',
      locationField: 'siteId',
      transactionIdField: 'transactionId',
      timestampField: 'dateTime',
      totalAmountField: 'totals.grandTotal',
      lineItemsField: 'lineItems'
    }
  };

  private static readonly RATE_LIMITS: Record<POSSystemType, RateLimit> = {
    shopify: {
      requestsPerSecond: 2,
      requestsPerMinute: 40,
      burstLimit: 40,
      concurrentConnections: 1
    },
    square: {
      requestsPerSecond: 10,
      requestsPerMinute: 500,
      requestsPerHour: 5000,
      burstLimit: 20
    },
    clover: {
      requestsPerSecond: 5,
      requestsPerMinute: 1000,
      burstLimit: 10
    },
    toast: {
      requestsPerSecond: 1,
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      burstLimit: 5
    },
    lightspeed: {
      requestsPerSecond: 3,
      requestsPerMinute: 180,
      burstLimit: 10
    },
    paypal_here: {
      requestsPerSecond: 5,
      requestsPerMinute: 300,
      burstLimit: 15
    },
    ncr: {
      requestsPerSecond: 10,
      requestsPerMinute: 1000,
      burstLimit: 20
    }
  };

  /**
   * Automatically detect POS system type from credentials
   */
  public static async detectPOSSystem(credentials: AuthCredentials): Promise<POSDetectionResult> {
    const detectionPromises = Object.entries(this.POS_FINGERPRINTS).map(
      ([posType, fingerprint]) => this.testPOSSystem(posType as POSSystemType, fingerprint, credentials)
    );

    // Test up to MAX_PARALLEL_TESTS systems simultaneously
    const results = await Promise.allSettled(detectionPromises.slice(0, this.MAX_PARALLEL_TESTS));
    
    const successfulDetections = results
      .filter((result): result is PromiseFulfilledResult<POSDetectionResult> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(detection => detection.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);

    if (successfulDetections.length === 0) {
      throw new POSIntegrationError(
        'Unable to detect POS system type from provided credentials',
        'DETECTION_FAILED',
        'square', // Default fallback
        undefined,
        false
      );
    }

    return successfulDetections[0];
  }

  /**
   * Test a specific POS system for compatibility
   */
  private static async testPOSSystem(
    posType: POSSystemType,
    fingerprint: POSFingerprint,
    credentials: AuthCredentials
  ): Promise<POSDetectionResult> {
    try {
      const testUrl = this.buildTestUrl(posType, fingerprint, credentials);
      const headers = this.buildAuthHeaders(fingerprint, credentials);

      const response = await axios.get(testUrl, {
        headers,
        timeout: this.DETECTION_TIMEOUT,
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses for detection
      });

      const confidence = this.calculateConfidence(posType, response, fingerprint);
      
      if (confidence === 0) {
        return {
          posType,
          confidence: 0,
          supportedFeatures: [],
          requiredCredentials: [],
          configuration: {}
        };
      }

      return {
        posType,
        confidence,
        supportedFeatures: this.getSupportedFeatures(posType),
        requiredCredentials: this.getRequiredCredentials(posType),
        configuration: {
          posType,
          credentials,
          webhookEndpoints: [],
          dataSchema: this.SCHEMA_MAPPINGS[posType],
          rateLimit: this.RATE_LIMITS[posType],
          isActive: true,
          settings: {
            autoSync: true,
            syncInterval: 30,
            enableWebhooks: true,
            taxCalculationMode: 'pos',
            multiLocationSupport: true
          }
        }
      };

    } catch (error) {
      // Return zero confidence on any error
      return {
        posType,
        confidence: 0,
        supportedFeatures: [],
        requiredCredentials: [],
        configuration: {}
      };
    }
  }

  /**
   * Build test URL for POS system
   */
  private static buildTestUrl(posType: POSSystemType, fingerprint: POSFingerprint, credentials: AuthCredentials): string {
    let baseUrl = fingerprint.baseUrl;
    
    // Replace placeholders in URL
    switch (posType) {
      case 'shopify':
        if (credentials.shopDomain) {
          baseUrl = baseUrl.replace('{shop}', credentials.shopDomain);
        }
        break;
      case 'clover':
        if (credentials.merchantId) {
          baseUrl = baseUrl.replace('{mId}', credentials.merchantId);
        }
        break;
      case 'toast':
        if (credentials.restaurantGuid) {
          baseUrl = baseUrl.replace('{restaurantGuid}', credentials.restaurantGuid);
        }
        break;
    }

    return `${baseUrl}${fingerprint.testEndpoints[0]}`;
  }

  /**
   * Build authentication headers for request
   */
  private static buildAuthHeaders(fingerprint: POSFingerprint, credentials: AuthCredentials): Record<string, string> {
    const headers = { ...fingerprint.headers };

    if (credentials.accessToken) {
      headers['Authorization'] = `Bearer ${credentials.accessToken}`;
    } else if (credentials.apiKey) {
      headers['Authorization'] = `Bearer ${credentials.apiKey}`;
    }

    return headers;
  }

  /**
   * Calculate confidence score based on response
   */
  private static calculateConfidence(
    posType: POSSystemType,
    response: AxiosResponse,
    fingerprint: POSFingerprint
  ): number {
    let confidence = 0;

    // Check for specific response signature header
    if (response.headers[fingerprint.responseSignature.toLowerCase()]) {
      confidence += 0.6;
    }

    // Check response status
    if (response.status === 200) {
      confidence += 0.3;
    } else if (response.status === 401 || response.status === 403) {
      confidence += 0.2; // Authentication error suggests correct endpoint
    }

    // Check response body structure
    if (response.data && typeof response.data === 'object') {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get supported features for POS system
   */
  private static getSupportedFeatures(posType: POSSystemType): string[] {
    const featureMap: Record<POSSystemType, string[]> = {
      shopify: ['Advanced Tax Calculation', 'Multi-jurisdiction', 'Real-time Webhooks', 'Tax Exemptions', 'Multi-location'],
      square: ['Good Tax Support', 'Simple Integration', 'Real-time Updates', 'Multi-location'],
      clover: ['Detailed Tax Data', 'Hardware Integration', 'Merchant Services', 'Restaurant Features'],
      toast: ['Restaurant-specific Tax', 'Alcohol Tax Handling', 'Delivery Tax', 'Order Management'],
      lightspeed: ['Multi-tax Support', 'Tax Groups', 'International Tax', 'Detailed Reporting'],
      paypal_here: ['Basic Tax Features', 'Mobile Support', 'PayPal Integration'],
      ncr: ['Enterprise Tax Rules', 'Complex Multi-jurisdiction', 'Audit Trails', 'Custom Tax Engine']
    };

    return featureMap[posType] || [];
  }

  /**
   * Get required credentials for POS system
   */
  private static getRequiredCredentials(posType: POSSystemType): string[] {
    const credentialMap: Record<POSSystemType, string[]> = {
      shopify: ['accessToken', 'shopDomain'],
      square: ['accessToken'],
      clover: ['accessToken', 'merchantId'],
      toast: ['accessToken', 'restaurantGuid'],
      lightspeed: ['accessToken'],
      paypal_here: ['accessToken'],
      ncr: ['apiKey', 'customCredentials']
    };

    return credentialMap[posType] || [];
  }

  /**
   * Validate credentials for a specific POS system
   */
  public static validateCredentials(posType: POSSystemType, credentials: AuthCredentials): boolean {
    const required = this.getRequiredCredentials(posType);
    
    return required.every(field => {
      const value = (credentials as any)[field];
      return value !== undefined && value !== null && value !== '';
    });
  }

  /**
   * Get configuration template for POS system
   */
  public static getConfigurationTemplate(posType: POSSystemType): Partial<POSConfiguration> {
    return {
      posType,
      webhookEndpoints: [],
      dataSchema: this.SCHEMA_MAPPINGS[posType],
      rateLimit: this.RATE_LIMITS[posType],
      isActive: false,
      settings: {
        autoSync: true,
        syncInterval: 30,
        enableWebhooks: true,
        taxCalculationMode: 'pos',
        multiLocationSupport: posType !== 'paypal_here'
      }
    };
  }
}
