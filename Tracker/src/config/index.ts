import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/sales-tax-tracker',
    name: process.env.DATABASE_NAME || 'sales_tax_tracker'
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  integrations: {
    square: {
      applicationId: process.env.SQUARE_APPLICATION_ID,
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment: process.env.SQUARE_ENVIRONMENT || 'sandbox'
    },
    shopify: {
      apiKey: process.env.SHOPIFY_API_KEY,
      apiSecret: process.env.SHOPIFY_API_SECRET
    },
    avalara: {
      apiKey: process.env.AVALARA_API_KEY,
      accountId: process.env.AVALARA_ACCOUNT_ID
    },
    taxjar: {
      apiKey: process.env.TAXJAR_API_KEY
    },
    quickbooks: {
      clientId: process.env.QUICKBOOKS_CLIENT_ID,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET
    }
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    sentryEnvironment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    sentryRelease: process.env.SENTRY_RELEASE || process.env.npm_package_version || '1.0.0'
  },
  auth0: {
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
    audience: process.env.AUTH0_AUDIENCE || 'https://sales-tax-tracker-api',
    issuerBaseUrl: process.env.AUTH0_ISSUER_BASE_URL || ''
  }
};