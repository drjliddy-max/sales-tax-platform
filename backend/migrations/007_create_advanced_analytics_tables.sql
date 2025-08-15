-- Migration: Create advanced analytics tables
-- Date: 2024-01-16
-- Description: Add comprehensive analytics tracking for client health, cohorts, forecasting, and churn analysis

-- Client activity tracking for health scoring
CREATE TABLE client_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'transaction', 'support_ticket', 'feature_usage'
    activity_data JSONB,
    activity_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Cohort tracking table
CREATE TABLE client_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    cohort_month DATE NOT NULL, -- First month of subscription
    cohort_size INTEGER, -- Total clients in this cohort
    created_at TIMESTAMP DEFAULT NOW()
);

-- Revenue predictions and forecasts
CREATE TABLE revenue_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_date DATE NOT NULL,
    forecast_type VARCHAR(50) NOT NULL, -- 'monthly', 'quarterly', 'annual'
    predicted_mrr DECIMAL(12,2),
    predicted_arr DECIMAL(12,2),
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    model_version VARCHAR(20),
    actual_mrr DECIMAL(12,2), -- Filled in after the fact
    actual_arr DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Client health scores
CREATE TABLE client_health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    score_date DATE NOT NULL,
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
    churn_risk_score DECIMAL(3,2) CHECK (churn_risk_score >= 0 AND churn_risk_score <= 1),
    upsell_score DECIMAL(3,2) CHECK (upsell_score >= 0 AND upsell_score <= 1),
    factors JSONB, -- JSON object with contributing factors
    created_at TIMESTAMP DEFAULT NOW()
);

-- Churn events tracking
CREATE TABLE churn_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    churn_date DATE NOT NULL,
    churn_reason VARCHAR(255),
    mrr_lost DECIMAL(10,2),
    arr_lost DECIMAL(10,2),
    days_as_customer INTEGER,
    tier_at_churn VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_client_activities_client_date ON client_activities(client_id, activity_date DESC);
CREATE INDEX idx_client_cohorts_month ON client_cohorts(cohort_month);
CREATE INDEX idx_revenue_forecasts_date_type ON revenue_forecasts(forecast_date, forecast_type);
CREATE INDEX idx_client_health_scores_client_date ON client_health_scores(client_id, score_date DESC);
CREATE INDEX idx_churn_events_date ON churn_events(churn_date);

-- Insert sample client activities for existing clients
INSERT INTO client_activities (client_id, activity_type, activity_data, activity_date)
SELECT 
    c.id,
    (ARRAY['login', 'transaction', 'feature_usage'])[1 + (random() * 2)::int] as activity_type,
    '{"source": "migration_sample"}'::jsonb,
    NOW() - (random() * interval '30 days')
FROM clients c
CROSS JOIN generate_series(1, 10); -- 10 activities per client

-- Insert cohort data for existing clients
INSERT INTO client_cohorts (client_id, cohort_month, cohort_size)
SELECT 
    c.id,
    DATE_TRUNC('month', c.signup_date) as cohort_month,
    (SELECT COUNT(*) FROM clients WHERE DATE_TRUNC('month', signup_date) = DATE_TRUNC('month', c.signup_date)) as cohort_size
FROM clients c;

-- Insert sample revenue forecasts
INSERT INTO revenue_forecasts (forecast_date, forecast_type, predicted_mrr, predicted_arr, confidence_score, model_version)
VALUES 
(CURRENT_DATE, 'monthly', 350.00, 4200.00, 0.85, '1.0'),
(CURRENT_DATE, 'quarterly', 400.00, 4800.00, 0.80, '1.0'),
(CURRENT_DATE, 'annual', 450.00, 5400.00, 0.75, '1.0');

-- Insert sample health scores for existing clients
INSERT INTO client_health_scores (client_id, score_date, health_score, churn_risk_score, upsell_score, factors)
SELECT 
    c.id,
    CURRENT_DATE,
    60 + (random() * 40)::int as health_score, -- Random score between 60-100
    random()::numeric(3,2) as churn_risk_score,
    random()::numeric(3,2) as upsell_score,
    '{"login_count": 15, "transaction_count": 8, "feature_usage": 5}'::jsonb as factors
FROM clients c;