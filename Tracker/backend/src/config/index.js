"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironment = exports.config = void 0;
exports.config = {
    server: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development',
        corsOrigins: process.env.CORS_ORIGINS?.split(',') || [
            'http://localhost:3000',
            'http://localhost:3001'
        ]
    },
    database: {
        url: process.env.DATABASE_URL,
        name: process.env.DATABASE_NAME || 'sales-tax-tracker',
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
        timeout: parseInt(process.env.DB_TIMEOUT || '30000')
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'development_secret_key',
        jwtExpiry: process.env.JWT_EXPIRY || '24h',
        clerkSecretKey: process.env.CLERK_SECRET_KEY,
        clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY
    },
    redis: {
        url: process.env.REDIS_URL,
        maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000')
    },
    email: {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD,
        fromAddress: process.env.FROM_EMAIL || 'noreply@salestaxtracker.com'
    },
    apis: {
        taxJarApiKey: process.env.TAXJAR_API_KEY,
        stripeSecretKey: process.env.STRIPE_SECRET_KEY,
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    },
    features: {
        enablePosRegistry: true,
        enableAdvancedAnalytics: true,
        enableReporting: true,
        enableIntegrations: true
    },
    rateLimits: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
        authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10')
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
        enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
        logFile: process.env.LOG_FILE || 'app.log'
    },
    pos: {
        pluginTimeout: parseInt(process.env.POS_PLUGIN_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.POS_MAX_RETRIES || '3'),
        webhookSecret: process.env.POS_WEBHOOK_SECRET || 'webhook_secret_key'
    }
};
const validateEnvironment = () => {
    const required = [];
    if (exports.config.server.environment === 'production') {
        if (!exports.config.database.url)
            required.push('DATABASE_URL');
        if (!exports.config.auth.jwtSecret || exports.config.auth.jwtSecret === 'development_secret_key') {
            required.push('JWT_SECRET');
        }
    }
    if (required.length > 0) {
        throw new Error(`Missing required environment variables: ${required.join(', ')}`);
    }
};
exports.validateEnvironment = validateEnvironment;
exports.default = exports.config;
//# sourceMappingURL=index.js.map