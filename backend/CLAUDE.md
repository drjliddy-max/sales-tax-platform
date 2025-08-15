# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Sales Tax Tracking Application - A comprehensive system that integrates with POS systems and accounting software to automate sales tax collection, calculation, and reporting for businesses.

## Common Development Commands

### Setup & Installation
```bash
npm install                    # Install dependencies
cp .env.example .env          # Set up environment variables
```

### Development
```bash
npm run dev                   # Start development server with hot reload
npm run dev:context7          # Start Context7 MCP server for enhanced code intelligence
npm start                     # Start production server
npm run build                 # Compile TypeScript to JavaScript
npm run typecheck             # Run TypeScript type checking
```

### Code Intelligence (Context7)
```bash
npm run context7:server       # Start Context7 MCP server for semantic analysis
```

### Testing
```bash
npm test                      # Run Jest unit/integration tests
npm run test:unit             # Run unit tests only
npm run test:integration      # Run integration tests only
npm run test:e2e              # Run Playwright end-to-end tests
npm run test:e2e:ui           # Run Playwright tests with UI mode
npm run test:e2e:debug        # Run Playwright tests in debug mode
npm run test:watch            # Run Jest tests in watch mode
npm run test:all              # Run both Jest and Playwright tests
```

### Code Quality
```bash
npm run lint                  # Check code style and quality
npm run lint:fix              # Fix auto-fixable linting issues
```

### Database Operations
```bash
npm run db:migrate            # Run database migrations
npm run db:seed               # Seed database with sample data
npm run tax-rates:update      # Update tax rates from external providers
```

## Architecture Overview

### Core Components
- **Tax Calculation Engine** (`src/services/tax-calculation/`): Handles multi-jurisdiction tax calculations with support for different product categories and customer exemptions
- **POS Integrations** (`src/integrations/pos/`): Connectors for Square, Shopify, Clover, and other POS systems
- **API Layer** (`src/api/`): RESTful API with Express.js, including routes for transactions, business management, and integrations
- **Data Models** (`src/models/`): MongoDB schemas for transactions, tax rates, and business configurations

### Key Services
- **TaxCalculator**: Core service that calculates taxes based on location, product categories, and applicable rates
- **SquareIntegration**: Handles Square POS data synchronization and transaction processing
- **Business Management**: Manages business configurations, locations, and nexus states

### Data Flow
1. POS systems push transaction data via webhooks or scheduled sync
2. Tax Calculator determines applicable rates based on business location and nexus
3. Transactions are stored with detailed tax breakdowns by jurisdiction
4. Reporting services generate compliance reports for filing

### Database Schema
- **Transaction**: Stores individual sales with tax calculations and jurisdiction breakdowns
- **TaxRate**: Maintains current and historical tax rates by jurisdiction and product category  
- **Business**: Stores business configuration, locations, integrations, and filing schedules

### Integration Architecture
- Each POS/accounting system has its own integration class in `src/integrations/`
- Shared interfaces ensure consistent data transformation
- Webhook handlers process real-time updates from external systems
- Background jobs handle scheduled data synchronization

### Tax Calculation Logic
- Multi-jurisdiction support (federal, state, county, city, special districts)
- Product category-specific rates
- Customer tax exemption handling
- Real-time rate lookups with caching
- Nexus-based tax obligation determination

### Configuration Management
- Environment-based configuration in `src/config/`
- Integration credentials stored securely
- Business-specific settings and filing schedules
- TypeScript path aliases for clean imports (`@/` prefix)

## Automated Tax Rate Collection (Firecrawl Integration)
The application uses Firecrawl to automatically collect tax rate updates from government websites:

### Key Features
- **Automated Data Collection**: Scrapes official government tax websites (TX, CA, NY, FL, CO)
- **Compliance Monitoring**: Tracks regulatory changes and filing requirement updates
- **Intelligent Validation**: Validates collected data against state-specific rules and business logic
- **Audit Logging**: Complete audit trail of all tax rate changes with impact assessment
- **Scheduled Updates**: Configurable schedules (daily, weekly, monthly, quarterly)
- **Emergency Mode**: Hourly updates during critical periods

### Services
- **FirecrawlService** (`src/services/tax-data-collection/FirecrawlService.ts`): Core data collection from government sources
- **ComplianceMonitor** (`src/services/tax-data-collection/ComplianceMonitor.ts`): Monitors regulatory changes and compliance updates
- **TaxRateValidator** (`src/services/tax-data-collection/TaxRateValidator.ts`): Validates collected data quality and accuracy
- **TaxRateScheduler** (`src/services/tax-data-collection/TaxRateScheduler.ts`): Manages automated update schedules
- **TaxRateAuditLogger** (`src/services/tax-data-collection/TaxRateAuditLogger.ts`): Comprehensive audit trail and change tracking

### API Endpoints
- `POST /api/tax-updates/manual-update` - Trigger manual tax rate updates
- `GET /api/tax-updates/compliance-alerts` - Retrieve compliance alerts and regulatory changes
- `GET /api/tax-updates/audit-trail` - Access complete audit trail of rate changes
- `GET /api/tax-updates/audit-report` - Generate comprehensive audit reports
- `POST /api/tax-updates/emergency-mode` - Enable emergency hourly updates
- `GET /api/tax-updates/scheduler-status` - Check status of all scheduled tasks

## Testing Strategy

### Playwright E2E Tests
- **Tax Calculation Accuracy**: Tests for multi-jurisdiction calculations across CA, NY, TX, and DE
- **API Endpoint Testing**: Comprehensive HTTP request/response testing with real database
- **Square Integration Flows**: Webhook processing, payment sync, and connection testing
- **Transaction Flows**: Refunds, partial refunds, high-volume processing, and error recovery
- **Jurisdiction-Specific Logic**: Product category exemptions, nexus rules, and rate combinations

### Test Data Fixtures
- `tests/e2e/fixtures/test-data.ts`: Basic test cases for tax calculations and Square webhooks
- `tests/e2e/fixtures/jurisdiction-data.ts`: Complex multi-jurisdiction scenarios and edge cases

### Running Tests
- Playwright tests use isolated test database (MongoDB Memory Server)
- Tests run against actual API server on port 3001
- Global setup seeds tax rates and business data for consistent testing
- Tests cover accuracy, performance, error handling, and compliance audit trails

## Development Notes
- All external API integrations include connection testing methods
- Database operations use Mongoose with proper indexing for performance
- Error handling includes specific validation and authentication errors
- Rate limiting applied to all API endpoints
- Comprehensive test coverage expected for tax calculation logic
- Playwright tests verify tax calculation accuracy across different jurisdictions and business scenarios

## Code Intelligence Integration
The project uses Context7 for enhanced semantic code analysis and cross-file intelligence:
- **MCP Configuration**: Context7 is configured as a Model Context Protocol server in `mcp.config.json`
- **Project Analysis**: Analyzes TypeScript/Node.js codebase for dependencies, imports, exports, and type relationships
- **Semantic Search**: Provides intelligent code completion and refactoring suggestions
- **Documentation Access**: Real-time access to up-to-date library documentation for dependencies like Mongoose, Express, and Playwright