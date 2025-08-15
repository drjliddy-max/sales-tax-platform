# Sales Tax Tracker

A comprehensive sales tax tracking application that integrates with POS systems and accounting software to automate tax collection, calculation, and reporting.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database connection
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

## API Endpoints

- `POST /api/tax/calculate` - Calculate taxes for a transaction
- `GET /api/transactions` - Get transaction history
- `POST /api/integrations/pos/sync` - Sync POS data
- `GET /health` - Health check

## Features

- Multi-jurisdiction tax calculation
- POS system integrations (Square, Shopify, Clover)
- Automated tax rate updates
- Compliance reporting
- Real-time transaction processing