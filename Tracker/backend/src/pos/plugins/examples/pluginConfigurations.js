"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginConfigurations = exports.toastPluginConfig = exports.cloverPluginConfig = exports.squarePluginConfig = exports.shopifyPluginConfig = void 0;
exports.shopifyPluginConfig = {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect to Shopify POS for automated sales tax tracking',
    marketFocus: 'E-commerce and retail',
    logo: 'https://cdn.shopify.com/assets/images/logos/shopify-bag.png',
    documentationUrl: 'https://shopify.dev/docs/apps/auth/oauth',
    supportUrl: 'https://help.shopify.com/',
    version: '1.0.0',
    lastUpdated: new Date(),
    auth: {
        type: 'oauth',
        oauthConfig: {
            authorizationUrl: 'https://{shopDomain}/admin/oauth/authorize',
            tokenUrl: 'https://{shopDomain}/admin/oauth/access_token',
            scopes: ['read_orders', 'read_locations', 'read_products'],
            clientIdField: 'clientId',
            clientSecretField: 'clientSecret',
            redirectUriRequired: true,
            additionalParams: {
                'grant_type': 'authorization_code'
            }
        }
    },
    fields: [
        {
            name: 'shopDomain',
            label: 'Shop Domain',
            type: 'text',
            required: true,
            placeholder: 'your-shop.myshopify.com',
            helpText: 'Your Shopify shop domain without https://',
            validation: '^[a-zA-Z0-9-]+\\.myshopify\\.com$'
        },
        {
            name: 'clientId',
            label: 'API Key',
            type: 'text',
            required: true,
            placeholder: 'Your Shopify App API Key',
            helpText: 'Found in your Shopify app configuration'
        },
        {
            name: 'clientSecret',
            label: 'Secret Key',
            type: 'password',
            required: true,
            placeholder: 'Your Shopify App Secret Key',
            helpText: 'Keep this secret secure'
        }
    ],
    endpoints: {
        baseUrl: 'https://{shopDomain}/admin/api/2023-10',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        endpoints: {
            test: '/shop.json',
            locations: '/locations.json',
            transactions: '/orders.json',
            webhooks: {
                list: '/webhooks.json',
                create: '/webhooks.json',
                delete: '/webhooks/{id}.json'
            }
        },
        requestFormat: {
            dateFormat: 'ISO',
            timeZone: 'UTC',
            pagination: {
                limitParam: 'limit',
                offsetParam: 'since_id',
                maxLimit: 250
            }
        }
    },
    webhooks: {
        supportedEvents: [
            'orders/create',
            'orders/updated',
            'orders/paid',
            'orders/cancelled'
        ],
        signatureHeader: 'X-Shopify-Hmac-Sha256',
        signatureAlgorithm: 'sha256',
        secretField: 'webhookSecret',
        payloadFormat: 'json'
    },
    dataMapping: {
        transaction: {
            id: 'id',
            timestamp: 'created_at',
            totalAmount: 'total_price',
            totalTax: 'total_tax',
            items: 'line_items',
            location: 'location_id',
            customer: 'customer.id'
        },
        location: {
            id: 'id',
            name: 'name',
            address: {
                street: 'address1',
                city: 'city',
                state: 'province',
                zipCode: 'zip',
                country: 'country'
            }
        }
    },
    instructions: [
        'Log in to your Shopify Partner Dashboard',
        'Create a new app or select an existing one',
        'Copy the API key and Secret key from your app settings',
        'Set up OAuth redirect URL in your app configuration',
        'Ensure your app has the required permissions: read_orders, read_locations, read_products'
    ],
    connectionTest: {
        endpoint: '/shop.json',
        method: 'GET',
        expectedStatus: 200,
        expectedFields: ['shop']
    },
    features: {
        realTimeSync: true,
        historicalSync: true,
        webhooksSupported: true,
        multiLocationSupport: true,
        taxDetailsSupported: true
    }
};
exports.squarePluginConfig = {
    id: 'square',
    name: 'Square',
    description: 'Connect to Square POS for automated sales tax tracking',
    marketFocus: 'Small to medium businesses',
    logo: 'https://squareup.com/us/en/press/square-logo.png',
    documentationUrl: 'https://developer.squareup.com/docs/oauth-api/overview',
    supportUrl: 'https://squareup.com/help/',
    version: '1.0.0',
    lastUpdated: new Date(),
    auth: {
        type: 'oauth',
        oauthConfig: {
            authorizationUrl: 'https://connect.squareup.com/oauth2/authorize',
            tokenUrl: 'https://connect.squareup.com/oauth2/token',
            scopes: ['ORDERS_READ', 'MERCHANT_PROFILE_READ', 'PAYMENTS_READ'],
            clientIdField: 'applicationId',
            clientSecretField: 'applicationSecret',
            redirectUriRequired: true,
            additionalParams: {
                'session': 'false'
            }
        }
    },
    fields: [
        {
            name: 'applicationId',
            label: 'Application ID',
            type: 'text',
            required: true,
            placeholder: 'Your Square Application ID',
            helpText: 'Found in your Square Developer Dashboard'
        },
        {
            name: 'applicationSecret',
            label: 'Application Secret',
            type: 'password',
            required: true,
            placeholder: 'Your Square Application Secret',
            helpText: 'Keep this secret secure'
        },
        {
            name: 'environment',
            label: 'Environment',
            type: 'select',
            required: true,
            placeholder: 'Select environment',
            helpText: 'Choose sandbox for testing, production for live data',
            options: [
                { value: 'sandbox', label: 'Sandbox (Testing)' },
                { value: 'production', label: 'Production (Live)' }
            ]
        }
    ],
    endpoints: {
        baseUrl: 'https://connect.squareup.com/v2',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        endpoints: {
            test: '/merchants',
            locations: '/locations',
            transactions: '/orders/search',
            webhooks: {
                list: '/webhooks/subscriptions',
                create: '/webhooks/subscriptions',
                delete: '/webhooks/subscriptions/{id}'
            }
        },
        requestFormat: {
            dateFormat: 'ISO',
            timeZone: 'UTC',
            pagination: {
                limitParam: 'limit',
                offsetParam: 'cursor',
                maxLimit: 500
            }
        }
    },
    webhooks: {
        supportedEvents: [
            'order.created',
            'order.updated',
            'payment.created',
            'payment.updated'
        ],
        signatureHeader: 'X-Square-Signature',
        signatureAlgorithm: 'sha1',
        secretField: 'webhookSignatureKey',
        payloadFormat: 'json'
    },
    dataMapping: {
        transaction: {
            id: 'id',
            timestamp: 'created_at',
            totalAmount: 'total_money.amount',
            totalTax: 'total_tax_money.amount',
            items: 'line_items',
            location: 'location_id',
            customer: 'customer_id'
        },
        location: {
            id: 'id',
            name: 'name',
            address: {
                street: 'address.address_line_1',
                city: 'address.locality',
                state: 'address.administrative_district_level_1',
                zipCode: 'address.postal_code',
                country: 'address.country'
            }
        }
    },
    instructions: [
        'Log in to your Square Developer Dashboard',
        'Create a new application or select an existing one',
        'Copy the Application ID and Application Secret',
        'Configure OAuth redirect URL in application settings',
        'Set up webhook endpoints if needed',
        'Choose the appropriate environment (sandbox/production)'
    ],
    connectionTest: {
        endpoint: '/merchants',
        method: 'GET',
        expectedStatus: 200,
        expectedFields: ['merchant']
    },
    features: {
        realTimeSync: true,
        historicalSync: true,
        webhooksSupported: true,
        multiLocationSupport: true,
        taxDetailsSupported: true
    }
};
exports.cloverPluginConfig = {
    id: 'clover',
    name: 'Clover',
    description: 'Connect to Clover POS for automated sales tax tracking',
    marketFocus: 'Restaurants and retail',
    logo: 'https://www.clover.com/assets/images/clover-logo.png',
    documentationUrl: 'https://docs.clover.com/docs/api-token-guide',
    supportUrl: 'https://help.clover.com/',
    version: '1.0.0',
    lastUpdated: new Date(),
    auth: {
        type: 'api_key'
    },
    fields: [
        {
            name: 'apiKey',
            label: 'API Token',
            type: 'password',
            required: true,
            placeholder: 'Enter your Clover API token',
            helpText: 'Found in your Clover developer dashboard under API Tokens'
        },
        {
            name: 'merchantId',
            label: 'Merchant ID',
            type: 'text',
            required: true,
            placeholder: 'Enter your Clover Merchant ID',
            helpText: '13-character merchant identifier'
        },
        {
            name: 'environment',
            label: 'Environment',
            type: 'select',
            required: true,
            placeholder: 'Select environment',
            helpText: 'Choose sandbox for testing, production for live data',
            options: [
                { value: 'sandbox', label: 'Sandbox (Testing)' },
                { value: 'production', label: 'Production (Live)' }
            ]
        }
    ],
    endpoints: {
        baseUrl: 'https://api.clover.com',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        endpoints: {
            test: '/v3/merchants/{merchantId}',
            locations: '/v3/merchants/{merchantId}/locations',
            transactions: '/v3/merchants/{merchantId}/orders',
            webhooks: {
                list: '/v3/merchants/{merchantId}/webhooks',
                create: '/v3/merchants/{merchantId}/webhooks',
                delete: '/v3/merchants/{merchantId}/webhooks/{id}'
            }
        },
        requestFormat: {
            dateFormat: 'YYYY-MM-DD',
            timeZone: 'America/New_York',
            pagination: {
                limitParam: 'limit',
                offsetParam: 'offset',
                maxLimit: 1000
            }
        }
    },
    webhooks: {
        supportedEvents: [
            'ORDER_CREATED',
            'ORDER_UPDATED',
            'PAYMENT_CREATED'
        ],
        payloadFormat: 'json'
    },
    dataMapping: {
        transaction: {
            id: 'id',
            timestamp: 'createdTime',
            totalAmount: 'total',
            totalTax: 'taxAmount',
            items: 'lineItems',
            location: 'device.id',
            customer: 'customers[0].id'
        },
        location: {
            id: 'id',
            name: 'name',
            address: {
                street: 'address.address1',
                city: 'address.city',
                state: 'address.state',
                zipCode: 'address.zip',
                country: 'address.country'
            }
        }
    },
    instructions: [
        'Log in to your Clover developer dashboard',
        'Navigate to "API Tokens" in the left sidebar',
        'Generate a new API token with required permissions',
        'Copy your Merchant ID from the merchant settings',
        'Ensure your API token has permissions for: orders, payments, inventory'
    ],
    connectionTest: {
        endpoint: '/v3/merchants/{merchantId}',
        method: 'GET',
        expectedStatus: 200,
        expectedFields: ['id', 'name']
    },
    features: {
        realTimeSync: true,
        historicalSync: true,
        webhooksSupported: true,
        multiLocationSupport: false,
        taxDetailsSupported: true
    }
};
exports.toastPluginConfig = {
    id: 'toast',
    name: 'Toast',
    description: 'Connect to Toast POS for restaurant sales tax tracking',
    marketFocus: 'Restaurants and food service',
    documentationUrl: 'https://doc.toasttab.com/doc/platformguide/apiAuth.html',
    version: '1.0.0',
    lastUpdated: new Date(),
    auth: {
        type: 'oauth',
        oauthConfig: {
            authorizationUrl: 'https://ws-api.toasttab.com/authentication/v1/authentication/login',
            tokenUrl: 'https://ws-api.toasttab.com/authentication/v1/authentication/login',
            scopes: ['pos:read', 'orders:read'],
            clientIdField: 'clientId',
            clientSecretField: 'clientSecret',
            redirectUriRequired: false
        }
    },
    fields: [
        {
            name: 'clientId',
            label: 'Client ID',
            type: 'text',
            required: true,
            placeholder: 'Enter your Toast Client ID',
            helpText: 'Found in your Toast developer portal under App Credentials'
        },
        {
            name: 'clientSecret',
            label: 'Client Secret',
            type: 'password',
            required: true,
            placeholder: 'Enter your Toast Client Secret',
            helpText: 'Keep this secret secure'
        },
        {
            name: 'restaurantGuid',
            label: 'Restaurant GUID',
            type: 'text',
            required: true,
            placeholder: 'Enter your Restaurant GUID',
            helpText: 'UUID identifying your restaurant in Toast'
        },
        {
            name: 'locationGuid',
            label: 'Location GUID',
            type: 'text',
            required: false,
            placeholder: 'Enter specific location GUID (optional)',
            helpText: 'Leave empty to connect all locations'
        }
    ],
    endpoints: {
        baseUrl: 'https://ws-api.toasttab.com',
        authHeader: 'Authorization',
        authPrefix: 'Bearer ',
        endpoints: {
            test: '/restaurants/v1/restaurants/{restaurantGuid}',
            locations: '/restaurants/v1/restaurants/{restaurantGuid}/locations',
            transactions: '/orders/v2/orders'
        },
        requestFormat: {
            dateFormat: 'ISO',
            timeZone: 'UTC',
            pagination: {
                limitParam: 'pageSize',
                offsetParam: 'page',
                maxLimit: 100
            }
        }
    },
    dataMapping: {
        transaction: {
            id: 'guid',
            timestamp: 'openedDate',
            totalAmount: 'amount',
            totalTax: 'taxAmount',
            items: 'selections',
            location: 'restaurantLocationGuid'
        },
        location: {
            id: 'guid',
            name: 'name',
            address: {
                street: 'address1',
                city: 'city',
                state: 'stateCode',
                zipCode: 'zipCode',
                country: 'countryCode'
            }
        }
    },
    instructions: [
        'Access your Toast developer portal',
        'Create or select your existing application',
        'Copy the Client ID and Client Secret from App Credentials',
        'Find your Restaurant GUID in the management console',
        'Optionally, specify a Location GUID for single-location setup'
    ],
    connectionTest: {
        endpoint: '/restaurants/v1/restaurants/{restaurantGuid}',
        method: 'GET',
        expectedStatus: 200,
        expectedFields: ['guid', 'name']
    },
    features: {
        realTimeSync: false,
        historicalSync: true,
        webhooksSupported: false,
        multiLocationSupport: true,
        taxDetailsSupported: true
    }
};
exports.pluginConfigurations = {
    shopify: exports.shopifyPluginConfig,
    square: exports.squarePluginConfig,
    clover: exports.cloverPluginConfig,
    toast: exports.toastPluginConfig
};
//# sourceMappingURL=pluginConfigurations.js.map