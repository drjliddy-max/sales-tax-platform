"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const types_1 = require("../types");
const transformer_1 = require("../transformer");
const rate_limiter_1 = require("../rate-limiter");
class SquareAdapter {
    constructor(environment = 'production') {
        this.posType = 'square';
        this.name = 'Square POS';
        this.supportedFeatures = [
            'Good Tax Support',
            'Simple Integration',
            'Real-time Updates',
            'Multi-location',
            'Payment Processing',
            'Inventory Management',
            'Customer Management',
            'Order Management'
        ];
        this.baseUrl = environment === 'production'
            ? 'https://connect.squareup.com'
            : 'https://connect.squareupsandbox.com';
        this.transformer = new transformer_1.TaxDataTransformer('square', {
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
        this.rateLimiter = rate_limiter_1.RateLimitManager.getInstance();
    }
    async testConnection(credentials) {
        try {
            if (!credentials.accessToken) {
                throw new types_1.POSIntegrationError('Missing required credentials: accessToken', 'INVALID_CREDENTIALS', 'square');
            }
            const response = await this.rateLimiter.executeRequest('square', () => this.makeRequest('/v2/locations', 'GET', credentials));
            return response.status === 200 && response.data?.locations;
        }
        catch (error) {
            console.error('Square connection test failed:', error);
            return false;
        }
    }
    async authenticate(credentials) {
        try {
            const isValid = await this.testConnection(credentials);
            if (!isValid) {
                throw new types_1.POSIntegrationError('Invalid Square credentials', 'AUTH_FAILED', 'square');
            }
            const locationsResponse = await this.rateLimiter.executeRequest('square', () => this.makeRequest('/v2/locations', 'GET', credentials));
            const locations = locationsResponse.data.locations;
            const mainLocation = locations.find((loc) => loc.type === 'PHYSICAL') || locations[0];
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
        }
        catch (error) {
            if (error instanceof types_1.POSIntegrationError) {
                throw error;
            }
            throw new types_1.POSIntegrationError(`Square authentication failed: ${error.message}`, 'AUTH_FAILED', 'square', error.response?.status, false);
        }
    }
    async getLocations(credentials) {
        try {
            const response = await this.rateLimiter.executeRequest('square', () => this.makeRequest('/v2/locations', 'GET', credentials));
            return response.data.locations.map((location) => ({
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
                    taxIncluded: false,
                    exemptions: []
                }
            }));
        }
        catch (error) {
            throw this.wrapError(error, 'Failed to get Square locations');
        }
    }
    async getTransactions(credentials, locationId, startDate, endDate) {
        try {
            const orders = await this.getOrders(credentials, locationId, startDate, endDate);
            const payments = await this.getPayments(credentials, locationId, startDate, endDate);
            const combinedData = orders.map(order => {
                const relatedPayments = payments.filter(payment => payment.order_id === order.id);
                return {
                    ...order,
                    payments: relatedPayments
                };
            });
            const transformedData = combinedData.map(data => {
                try {
                    return this.transformer.transform(data);
                }
                catch (error) {
                    console.error(`Failed to transform Square order ${data.id}:`, error);
                    return null;
                }
            });
            return transformedData.filter(Boolean);
        }
        catch (error) {
            throw this.wrapError(error, 'Failed to get Square transactions');
        }
    }
    async getOrders(credentials, locationId, startDate, endDate) {
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
            limit: 500
        };
        let allOrders = [];
        let cursor;
        do {
            if (cursor) {
                searchRequest.cursor = cursor;
            }
            const response = await this.rateLimiter.executeRequest('square', () => this.makeRequest('/v2/orders/search', 'POST', credentials, { data: searchRequest }));
            const orders = response.data.orders || [];
            allOrders = allOrders.concat(orders);
            cursor = response.data.cursor;
        } while (cursor && allOrders.length < 10000);
        return allOrders;
    }
    async getPayments(credentials, locationId, startDate, endDate) {
        const params = {
            location_id: locationId,
            begin_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            sort_order: 'DESC',
            limit: 100
        };
        let allPayments = [];
        let cursor;
        do {
            const queryParams = cursor ? { ...params, cursor } : params;
            const response = await this.rateLimiter.executeRequest('square', () => this.makeRequest('/v2/payments', 'GET', credentials, { params: queryParams }));
            const payments = response.data.payments || [];
            allPayments = allPayments.concat(payments);
            cursor = response.data.cursor;
        } while (cursor && allPayments.length < 10000);
        return allPayments;
    }
    async setupWebhooks(credentials, webhookUrl) {
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
            const response = await this.rateLimiter.executeRequest('square', () => this.makeRequest('/v2/webhooks/subscriptions', 'POST', credentials, { data: subscriptionData }));
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
        }
        catch (error) {
            throw this.wrapError(error, 'Failed to setup Square webhooks');
        }
    }
    validateWebhook(payload, signature, secret) {
        try {
            const timestamp = payload.created_at;
            const body = JSON.stringify(payload);
            const stringToSign = `${webhookUrl}/square${body}${timestamp}`;
            const hmac = crypto_1.default.createHmac('sha1', secret);
            hmac.update(stringToSign);
            const calculatedSignature = hmac.digest('base64');
            return crypto_1.default.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(calculatedSignature, 'base64'));
        }
        catch (error) {
            console.error('Square webhook validation error:', error);
            return false;
        }
    }
    transformRawData(rawData) {
        return this.transformer.transform(rawData);
    }
    async getHistoricalData(credentials, locationId, days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        return this.getTransactions(credentials, locationId, startDate, endDate);
    }
    async getTaxRates(credentials, locationId) {
        try {
            return [];
        }
        catch (error) {
            console.error('Failed to get Square tax rates:', error);
            return [];
        }
    }
    async makeRequest(endpoint, method, credentials, options) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            method,
            url,
            headers: {
                'Authorization': `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Square-Version': '2023-10-18'
            },
            timeout: 30000,
            ...options
        };
        try {
            const response = await (0, axios_1.default)(config);
            return response;
        }
        catch (error) {
            throw this.wrapError(error, `Square API request failed: ${method} ${endpoint}`);
        }
    }
    wrapError(error, message) {
        let code = 'UNKNOWN_ERROR';
        let retryable = false;
        let statusCode;
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
        }
        else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            code = 'CONNECTION_ERROR';
            retryable = true;
        }
        return new types_1.POSIntegrationError(`${message}: ${error.message}`, code, 'square', statusCode, retryable, { originalError: error, endpoint: error.config?.url });
    }
    static generateOAuthUrl(clientId, redirectUri, scopes = ['ORDERS_READ', 'PAYMENTS_READ', 'MERCHANT_PROFILE_READ'], state) {
        const params = new URLSearchParams({
            client_id: clientId,
            scope: scopes.join(' '),
            session: 'false',
            state: state || crypto_1.default.randomBytes(16).toString('hex')
        });
        return `https://connect.squareup.com/oauth2/authorize?${params}`;
    }
    static async exchangeCodeForToken(clientId, clientSecret, code, redirectUri) {
        try {
            const response = await axios_1.default.post('https://connect.squareup.com/oauth2/token', {
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code'
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            const data = response.data;
            const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;
            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt
            };
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to exchange authorization code: ${error.message}`, 'AUTH_FAILED', 'square', error.response?.status, false);
        }
    }
    static async refreshAccessToken(clientId, clientSecret, refreshToken) {
        try {
            const response = await axios_1.default.post('https://connect.squareup.com/oauth2/token', {
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            const data = response.data;
            const expiresAt = data.expires_at ? new Date(data.expires_at) : undefined;
            return {
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt
            };
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to refresh access token: ${error.message}`, 'AUTH_FAILED', 'square', error.response?.status, false);
        }
    }
}
exports.SquareAdapter = SquareAdapter;
//# sourceMappingURL=SquareAdapter.js.map