-- Migration: Create revenue tracking tables
-- Date: 2024-01-16
-- Description: Add comprehensive revenue tracking system for SaaS business model

-- Create the essential tables for revenue tracking
CREATE TABLE revenue_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('subscription', 'transaction', 'onetime', 'service')),
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE client_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    monthly_price DECIMAL(10,2),
    annual_price DECIMAL(10,2),
    transaction_limit INTEGER,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    current_tier_id UUID REFERENCES client_tiers(id),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    signup_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE client_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    tier_id UUID REFERENCES client_tiers(id),
    start_date DATE NOT NULL,
    end_date DATE,
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'suspended')),
    mrr DECIMAL(10,2), -- Monthly Recurring Revenue
    arr DECIMAL(10,2), -- Annual Recurring Revenue
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE revenue_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    revenue_stream_id UUID REFERENCES revenue_streams(id),
    subscription_id UUID REFERENCES client_subscriptions(id),
    transaction_date TIMESTAMP DEFAULT NOW(),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    tax_amount DECIMAL(10,2) DEFAULT 0,
    net_amount DECIMAL(10,2) NOT NULL,
    billing_period_start DATE,
    billing_period_end DATE,
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_revenue_transactions_client_id ON revenue_transactions(client_id);
CREATE INDEX idx_revenue_transactions_date ON revenue_transactions(transaction_date);
CREATE INDEX idx_revenue_transactions_stream ON revenue_transactions(revenue_stream_id);
CREATE INDEX idx_client_subscriptions_client_id ON client_subscriptions(client_id);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_tier ON clients(current_tier_id);

-- Insert default revenue streams
INSERT INTO revenue_streams (name, category, description, is_recurring, is_active) VALUES
('Monthly Subscription', 'subscription', 'Recurring monthly subscription fees', true, true),
('Annual Subscription', 'subscription', 'Recurring annual subscription fees', true, true),
('Setup Fee', 'onetime', 'One-time setup and onboarding fee', false, true),
('Transaction Fee', 'transaction', 'Per-transaction processing fee', false, true),
('Professional Services', 'service', 'Consulting and custom integration services', false, true);

-- Insert default client tiers
INSERT INTO client_tiers (name, monthly_price, annual_price, transaction_limit, features, is_active) VALUES
('Starter', 29.00, 290.00, 100, '{"integrations": 2, "reports": "basic", "support": "email"}', true),
('Professional', 79.00, 790.00, 500, '{"integrations": 5, "reports": "advanced", "support": "email+chat"}', true),
('Enterprise', 199.00, 1990.00, 2000, '{"integrations": "unlimited", "reports": "custom", "support": "priority"}', true);

-- Insert sample clients
INSERT INTO clients (name, email, current_tier_id, status, signup_date) VALUES 
('Demo Restaurant LLC', 'demo@restaurant.com', (SELECT id FROM client_tiers WHERE name = 'Professional'), 'active', '2023-12-15'),
('Sample Retail Store', 'owner@retailstore.com', (SELECT id FROM client_tiers WHERE name = 'Starter'), 'active', '2024-01-10'),
('Tech Startup Inc', 'admin@techstartup.com', (SELECT id FROM client_tiers WHERE name = 'Enterprise'), 'active', '2023-11-20'),
('Local Coffee Shop', 'manager@coffeeshop.com', (SELECT id FROM client_tiers WHERE name = 'Professional'), 'active', '2024-01-08');

-- Create active subscriptions for clients
INSERT INTO client_subscriptions (client_id, tier_id, start_date, billing_cycle, status, mrr, arr)
SELECT 
    c.id,
    c.current_tier_id,
    c.signup_date,
    'monthly',
    'active',
    t.monthly_price,
    t.annual_price
FROM clients c 
JOIN client_tiers t ON c.current_tier_id = t.id;

-- Insert sample revenue transactions
INSERT INTO revenue_transactions (client_id, revenue_stream_id, subscription_id, transaction_date, amount, tax_amount, net_amount, billing_period_start, billing_period_end, payment_method, status, description)
SELECT 
    cs.client_id,
    (SELECT id FROM revenue_streams WHERE name = 'Monthly Subscription'),
    cs.id,
    NOW() - INTERVAL '1 day',
    cs.mrr,
    0.00,
    cs.mrr,
    DATE_TRUNC('month', NOW() - INTERVAL '1 month'),
    DATE_TRUNC('month', NOW()) - INTERVAL '1 day',
    'credit_card',
    'completed',
    'Monthly subscription payment'
FROM client_subscriptions cs
WHERE cs.status = 'active';

-- Add setup fees for some clients
INSERT INTO revenue_transactions (client_id, revenue_stream_id, transaction_date, amount, tax_amount, net_amount, payment_method, status, description)
VALUES 
((SELECT id FROM clients WHERE email = 'manager@coffeeshop.com'), (SELECT id FROM revenue_streams WHERE name = 'Setup Fee'), '2024-01-10', 199.00, 0.00, 199.00, 'credit_card', 'completed', 'Setup and onboarding fee'),
((SELECT id FROM clients WHERE email = 'demo@restaurant.com'), (SELECT id FROM revenue_streams WHERE name = 'Transaction Overage'), '2024-01-12', 89.00, 0.00, 89.00, 'credit_card', 'completed', 'Additional transaction processing charges');