# Revenue Tracking Database Models

This directory contains the Mongoose models for the comprehensive revenue tracking system.

## Models Overview

### RevenueStream
Defines different types of revenue sources (subscriptions, one-time fees, services, etc.)
- **Categories**: `subscription`, `transaction`, `onetime`, `service`
- **Fields**: name, category, description, isRecurring, isActive

### ClientTier
Subscription plans/tiers with pricing and feature information
- **Plans**: Starter ($29), Professional ($79), Enterprise ($149), Trial ($0)
- **Fields**: name, monthlyPrice, annualPrice, transactionLimit, features

### Client
Customer/client information
- **Fields**: name, email, currentTierId, status, signupDate
- **Status Options**: `active`, `inactive`, `suspended`

### ClientSubscription
Active subscriptions linking clients to tiers
- **Fields**: clientId, tierId, startDate, endDate, billingCycle, status, mrr, arr
- **Billing Cycles**: `monthly`, `annual`
- **Status Options**: `active`, `cancelled`, `suspended`

### RevenueTransaction
Individual revenue transactions (payments, fees, etc.)
- **Fields**: clientId, revenueStreamId, subscriptionId, amount, taxAmount, netAmount
- **Status Options**: `pending`, `completed`, `failed`, `refunded`
- **Payment Methods**: credit_card, bank_transfer, etc.

## Usage

```typescript
import { RevenueService } from '../services/RevenueService';

// Initialize sample data (development only)
await RevenueService.initializeSampleData();

// Get admin revenue transactions
const transactions = await RevenueService.getAdminRevenueTransactions();

// Get revenue metrics (MRR, ARR, client count)
const metrics = await RevenueService.getRevenueMetrics();
```

## Database Migration

Run the migration file to create the database schema:
```sql
-- Run migrations/006_create_revenue_tracking_tables.sql
```

## Integration

The system automatically detects MongoDB connection and falls back to mock data if unavailable:
- **Connected**: Uses real database with proper revenue tracking
- **Disconnected**: Falls back to mock data for development

## Indexes

Performance indexes are created on:
- `revenue_transactions.client_id`
- `revenue_transactions.transaction_date` 
- `revenue_transactions.revenue_stream_id`
- `client_subscriptions.client_id`
- `clients.email`
- `clients.current_tier_id`