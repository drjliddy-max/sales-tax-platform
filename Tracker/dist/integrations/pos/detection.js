"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSDetector = void 0;
const axios_1 = __importDefault(require("axios"));
const types_1 = require("./types");
class POSDetector {
    static async detectPOSSystem(credentials) {
        const detectionPromises = Object.entries(this.POS_FINGERPRINTS).map(([posType, fingerprint]) => this.testPOSSystem(posType, fingerprint, credentials));
        const results = await Promise.allSettled(detectionPromises.slice(0, this.MAX_PARALLEL_TESTS));
        const successfulDetections = results
            .filter((result) => result.status === 'fulfilled')
            .map(result => result.value)
            .filter(detection => detection.confidence > 0)
            .sort((a, b) => b.confidence - a.confidence);
        if (successfulDetections.length === 0) {
            throw new types_1.POSIntegrationError('Unable to detect POS system type from provided credentials', 'DETECTION_FAILED', 'square', undefined, false);
        }
        return successfulDetections[0];
    }
    static async testPOSSystem(posType, fingerprint, credentials) {
        try {
            const testUrl = this.buildTestUrl(posType, fingerprint, credentials);
            const headers = this.buildAuthHeaders(fingerprint, credentials);
            const response = await axios_1.default.get(testUrl, {
                headers,
                timeout: this.DETECTION_TIMEOUT,
                validateStatus: (status) => status < 500
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
        }
        catch (error) {
            return {
                posType,
                confidence: 0,
                supportedFeatures: [],
                requiredCredentials: [],
                configuration: {}
            };
        }
    }
    static buildTestUrl(posType, fingerprint, credentials) {
        let baseUrl = fingerprint.baseUrl;
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
    static buildAuthHeaders(fingerprint, credentials) {
        const headers = { ...fingerprint.headers };
        if (credentials.accessToken) {
            headers['Authorization'] = `Bearer ${credentials.accessToken}`;
        }
        else if (credentials.apiKey) {
            headers['Authorization'] = `Bearer ${credentials.apiKey}`;
        }
        return headers;
    }
    static calculateConfidence(posType, response, fingerprint) {
        let confidence = 0;
        if (response.headers[fingerprint.responseSignature.toLowerCase()]) {
            confidence += 0.6;
        }
        if (response.status === 200) {
            confidence += 0.3;
        }
        else if (response.status === 401 || response.status === 403) {
            confidence += 0.2;
        }
        if (response.data && typeof response.data === 'object') {
            confidence += 0.1;
        }
        return Math.min(confidence, 1.0);
    }
    static getSupportedFeatures(posType) {
        const featureMap = {
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
    static getRequiredCredentials(posType) {
        const credentialMap = {
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
    static validateCredentials(posType, credentials) {
        const required = this.getRequiredCredentials(posType);
        return required.every(field => {
            const value = credentials[field];
            return value !== undefined && value !== null && value !== '';
        });
    }
    static getConfigurationTemplate(posType) {
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
exports.POSDetector = POSDetector;
POSDetector.DETECTION_TIMEOUT = 10000;
POSDetector.MAX_PARALLEL_TESTS = 3;
POSDetector.POS_FINGERPRINTS = {
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
POSDetector.SCHEMA_MAPPINGS = {
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
POSDetector.RATE_LIMITS = {
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
//# sourceMappingURL=detection.js.map