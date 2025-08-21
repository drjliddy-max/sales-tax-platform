"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopifyAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const types_1 = require("../types");
const transformer_1 = require("../transformer");
const rate_limiter_1 = require("../rate-limiter");
class ShopifyAdapter {
    constructor() {
        this.posType = 'shopify';
        this.name = 'Shopify POS';
        this.supportedFeatures = [
            'Advanced Tax Calculation',
            'Multi-jurisdiction',
            'Real-time Webhooks',
            'Tax Exemptions',
            'Multi-location',
            'Order Management',
            'Customer Data',
            'Product Catalog'
        ];
        this.transformer = new transformer_1.TaxDataTransformer('shopify', {
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
        this.rateLimiter = rate_limiter_1.RateLimitManager.getInstance();
    }
    async testConnection(credentials) {
        try {
            if (!credentials.accessToken || !credentials.shopDomain) {
                throw new types_1.POSIntegrationError('Missing required credentials: accessToken and shopDomain', 'INVALID_CREDENTIALS', 'shopify');
            }
            const response = await this.rateLimiter.executeRequest('shopify', () => this.makeRequest('/shop.json', 'GET', credentials));
            return response.status === 200 && response.data?.shop;
        }
        catch (error) {
            console.error('Shopify connection test failed:', error);
            return false;
        }
    }
    async authenticate(credentials) {
        try {
            const isValid = await this.testConnection(credentials);
            if (!isValid) {
                throw new types_1.POSIntegrationError('Invalid Shopify credentials', 'AUTH_FAILED', 'shopify');
            }
            const shopResponse = await this.rateLimiter.executeRequest('shopify', () => this.makeRequest('/shop.json', 'GET', credentials));
            const shop = shopResponse.data.shop;
            return {
                ...credentials,
                shopDomain: shop.domain,
                customCredentials: {
                    shopId: shop.id,
                    shopName: shop.name,
                    email: shop.email,
                    currency: shop.currency,
                    timezone: shop.iana_timezone,
                    taxesIncluded: shop.taxes_included
                }
            };
        }
        catch (error) {
            if (error instanceof types_1.POSIntegrationError) {
                throw error;
            }
            throw new types_1.POSIntegrationError(`Shopify authentication failed: ${error.message}`, 'AUTH_FAILED', 'shopify', error.response?.status, false);
        }
    }
    async getLocations(credentials) {
        try {
            const response = await this.rateLimiter.executeRequest('shopify', () => this.makeRequest('/locations.json', 'GET', credentials));
            return response.data.locations.map((location) => ({
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
        }
        catch (error) {
            throw this.wrapError(error, 'Failed to get Shopify locations');
        }
    }
    async getTransactions(credentials, locationId, startDate, endDate) {
        try {
            const params = {
                location_id: locationId,
                created_at_min: startDate.toISOString(),
                created_at_max: endDate.toISOString(),
                status: 'any',
                limit: 250
            };
            let allOrders = [];
            let hasNextPage = true;
            let pageInfo = null;
            while (hasNextPage) {
                const queryParams = pageInfo
                    ? { ...params, page_info: pageInfo }
                    : params;
                const response = await this.rateLimiter.executeRequest('shopify', () => this.makeRequest('/orders.json', 'GET', credentials, { params: queryParams }));
                const orders = response.data.orders;
                allOrders = allOrders.concat(orders);
                const linkHeader = response.headers.link;
                if (linkHeader && linkHeader.includes('rel=\"next\"')) {
                    const nextMatch = linkHeader.match(/<([^>]+)>.*rel="next"/);
                    if (nextMatch) {
                        const url = new URL(nextMatch[1]);
                        pageInfo = url.searchParams.get('page_info');
                    }
                    else {
                        hasNextPage = false;
                    }
                }
                else {
                    hasNextPage = false;
                }
                if (allOrders.length > 10000) {
                    console.warn('Shopify: Reached maximum order limit (10,000), stopping pagination');
                    break;
                }
            }
            const transformedData = await Promise.all(allOrders.map(async (order) => {
                try {
                    const enrichedOrder = await this.enrichOrderData(order, credentials);
                    return this.transformer.transform(enrichedOrder);
                }
                catch (error) {
                    console.error(`Failed to transform Shopify order ${order.id}:`, error);
                    return null;
                }
            }));
            return transformedData.filter(Boolean);
        }
        catch (error) {
            throw this.wrapError(error, 'Failed to get Shopify transactions');
        }
    }
    async setupWebhooks(credentials, webhookUrl) {
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
                    const response = await this.rateLimiter.executeRequest('shopify', () => this.makeRequest('/webhooks.json', 'POST', credentials, { data: webhookData }));
                    createdWebhooks.push(response.data.webhook);
                }
                catch (error) {
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
        }
        catch (error) {
            throw this.wrapError(error, 'Failed to setup Shopify webhooks');
        }
    }
    validateWebhook(payload, signature, secret) {
        try {
            const hmac = crypto_1.default.createHmac('sha256', secret);
            hmac.update(JSON.stringify(payload));
            const calculatedSignature = hmac.digest('base64');
            return crypto_1.default.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(calculatedSignature, 'base64'));
        }
        catch (error) {
            console.error('Shopify webhook validation error:', error);
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
            const response = await this.rateLimiter.executeRequest('shopify', () => this.makeRequest('/shop.json', 'GET', credentials));
            const shop = response.data.shop;
            const taxRates = [];
            if (shop.tax_shipping) {
                taxRates.push({
                    name: 'Shipping Tax',
                    rate: 0,
                    amount: 0,
                    jurisdiction: shop.primary_location_id?.toString() || locationId,
                    type: 'percentage'
                });
            }
            return taxRates;
        }
        catch (error) {
            console.error('Failed to get Shopify tax rates:', error);
            return [];
        }
    }
    async makeRequest(endpoint, method, credentials, options) {
        const url = `https://${credentials.shopDomain}/admin/api/2023-10${endpoint}`;
        const config = {
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
            const response = await (0, axios_1.default)(config);
            return response;
        }
        catch (error) {
            throw this.wrapError(error, `Shopify API request failed: ${method} ${endpoint}`);
        }
    }
    async enrichOrderData(order, credentials) {
        try {
            if (order.location_id && !order.location) {
                const locations = await this.getLocations(credentials);
                order.location = locations.find(loc => loc.id === order.location_id?.toString());
            }
            if (order.transactions && order.transactions.length === 0) {
                try {
                    const transactionResponse = await this.rateLimiter.executeRequest('shopify', () => this.makeRequest(`/orders/${order.id}/transactions.json`, 'GET', credentials));
                    order.transactions = transactionResponse.data.transactions;
                }
                catch (error) {
                    console.debug(`Could not fetch transactions for order ${order.id}`);
                }
            }
            return order;
        }
        catch (error) {
            console.error('Failed to enrich Shopify order data:', error);
            return order;
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
        }
        else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            code = 'CONNECTION_ERROR';
            retryable = true;
        }
        return new types_1.POSIntegrationError(`${message}: ${error.message}`, code, 'shopify', statusCode, retryable, { originalError: error, endpoint: error.config?.url });
    }
    static generateOAuthUrl(clientId, shopDomain, redirectUri, scopes = ['read_orders', 'read_products', 'read_locations']) {
        const params = new URLSearchParams({
            client_id: clientId,
            scope: scopes.join(','),
            redirect_uri: redirectUri,
            state: crypto_1.default.randomBytes(16).toString('hex')
        });
        return `https://${shopDomain}/admin/oauth/authorize?${params}`;
    }
    static async exchangeCodeForToken(clientId, clientSecret, shopDomain, code) {
        try {
            const response = await axios_1.default.post(`https://${shopDomain}/admin/oauth/access_token`, {
                client_id: clientId,
                client_secret: clientSecret,
                code
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return {
                accessToken: response.data.access_token,
                scope: response.data.scope
            };
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to exchange authorization code: ${error.message}`, 'AUTH_FAILED', 'shopify', error.response?.status, false);
        }
    }
}
exports.ShopifyAdapter = ShopifyAdapter;
//# sourceMappingURL=ShopifyAdapter.js.map