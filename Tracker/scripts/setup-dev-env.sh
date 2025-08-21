#!/bin/bash

# Sales Tax Tracker - Development Environment Setup
echo "🚀 Setting up development environment for Sales Tax Tracker..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

# Create environment files if they don't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOL
# Development Environment Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3002

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/sales_tax_dev
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=dev-jwt-secret-key-change-in-production
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret

# Integration API Keys (use sandbox/test keys)
SHOPIFY_CLIENT_ID=test-shopify-client-id
SHOPIFY_CLIENT_SECRET=test-shopify-client-secret
PAYPAL_CLIENT_ID=test-paypal-client-id
PAYPAL_CLIENT_SECRET=test-paypal-client-secret
SQUARE_APPLICATION_ID=test-square-app-id
SQUARE_ACCESS_TOKEN=test-square-access-token

# Tax Calculation
AVALARA_API_KEY=test-avalara-key
TAXJAR_API_KEY=test-taxjar-key

# Monitoring and Logging
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=debug

# Testing
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/sales_tax_test
WEBHOOK_SECRET=test-webhook-secret-for-development
EOL
    echo "✅ Created .env file with development configuration"
else
    echo "ℹ️ .env file already exists"
fi

# Create test environment file
if [ ! -f .env.test ]; then
    echo "📝 Creating .env.test file..."
    cat > .env.test << EOL
# Test Environment Configuration
NODE_ENV=test
PORT=3003
DATABASE_URL=postgresql://test:test@localhost:5432/sales_tax_test
REDIS_URL=redis://localhost:6379/1
JWT_SECRET=test-jwt-secret-key
WEBHOOK_SECRET=test-webhook-secret
LOG_LEVEL=error
EOL
    echo "✅ Created .env.test file"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Create test database if using PostgreSQL
echo "🗄️ Setting up test database..."
# Note: This assumes PostgreSQL is running locally
# createdb sales_tax_test 2>/dev/null || echo "ℹ️ Test database may already exist"

# Run initial tests to verify setup
echo "🧪 Running initial tests..."
npm run test:unit 2>&1 | head -20

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Start PostgreSQL and Redis services"
echo "2. Update .env file with your actual API keys"
echo "3. Run 'npm run dev' to start the development server"
echo "4. Run 'npm run test' to run the test suite"
echo ""
echo "🔗 Useful commands:"
echo "- npm run dev          # Start development server"
echo "- npm run test         # Run all tests"
echo "- npm run test:watch   # Run tests in watch mode"
echo "- npm run test:e2e     # Run end-to-end tests"
echo "- npm run lint         # Check code quality"
echo ""
