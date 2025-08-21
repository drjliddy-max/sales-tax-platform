-- Migration: Create reporting system tables
-- Date: 2024-01-16
-- Description: Add comprehensive reporting and dashboard system with templates, scheduling, and permissions

-- Report templates and configurations
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'executive', 'operational', 'financial', 'custom'
    template_config JSONB NOT NULL, -- Chart types, metrics, filters
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_by UUID, -- References users table
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled reports
CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    frequency VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
    delivery_method VARCHAR(20) NOT NULL, -- 'email', 'slack', 'webhook'
    recipients JSONB NOT NULL, -- Array of email addresses or webhook URLs
    filters JSONB, -- Dynamic filters applied to the report
    next_run_date TIMESTAMP,
    last_run_date TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Generated report history
CREATE TABLE report_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id),
    scheduled_report_id UUID REFERENCES scheduled_reports(id),
    report_name VARCHAR(255),
    report_data JSONB,
    file_path VARCHAR(500), -- Path to generated PDF/Excel file
    generation_time_ms INTEGER,
    status VARCHAR(20) DEFAULT 'completed', -- 'generating', 'completed', 'failed'
    error_message TEXT,
    generated_at TIMESTAMP DEFAULT NOW()
);

-- Custom dashboard configurations
CREATE TABLE custom_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout_config JSONB NOT NULL, -- Widget positions, sizes, types
    filters JSONB, -- Default filters
    is_default BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Report sharing and permissions
CREATE TABLE report_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID, -- Can reference report_templates or custom_dashboards
    report_type VARCHAR(20), -- 'template', 'dashboard'
    user_id UUID,
    permission_level VARCHAR(20), -- 'view', 'edit', 'admin'
    granted_by UUID,
    granted_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_report_templates_category ON report_templates(category);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_date) WHERE is_active = true;
CREATE INDEX idx_report_history_generated_at ON report_history(generated_at DESC);
CREATE INDEX idx_custom_dashboards_created_by ON custom_dashboards(created_by);
CREATE INDEX idx_report_permissions_user ON report_permissions(user_id, permission_level);
CREATE UNIQUE INDEX idx_report_permissions_unique ON report_permissions(report_id, report_type, user_id);

-- Insert default report templates
INSERT INTO report_templates (name, description, category, template_config, is_default, is_public) VALUES
(
    'Executive Summary',
    'High-level revenue and business metrics for executive decision making',
    'executive',
    '{
        "chartTypes": ["line", "bar", "kpi"],
        "metrics": ["mrr_arr", "revenue_summary", "churn_metrics"],
        "filters": {"period": "monthly"},
        "layout": {"sections": 3, "orientation": "vertical"}
    }'::jsonb,
    true,
    true
),
(
    'Revenue Analysis',
    'Detailed revenue breakdown and forecasting for financial planning',
    'financial',
    '{
        "chartTypes": ["line", "pie", "table"],
        "metrics": ["revenue_by_stream", "revenue_forecast", "cohort_analysis"],
        "filters": {"period": "quarterly"},
        "layout": {"sections": 4, "orientation": "mixed"}
    }'::jsonb,
    true,
    true
),
(
    'Customer Health Report',
    'Client health scores and churn analysis for customer success',
    'operational',
    '{
        "chartTypes": ["bar", "scatter", "table"],
        "metrics": ["churn_metrics", "cohort_analysis"],
        "filters": {"period": "monthly"},
        "layout": {"sections": 2, "orientation": "horizontal"}
    }'::jsonb,
    true,
    true
),
(
    'Financial Dashboard',
    'Comprehensive financial metrics and KPI tracking',
    'financial',
    '{
        "chartTypes": ["kpi", "line", "bar"],
        "metrics": ["mrr_arr", "revenue_by_tier", "revenue_forecast"],
        "filters": {"period": "monthly"},
        "layout": {"sections": 6, "orientation": "grid"}
    }'::jsonb,
    true,
    true
);

-- Insert sample custom dashboard
INSERT INTO custom_dashboards (name, description, layout_config, is_default, is_shared) VALUES
(
    'Revenue Operations Dashboard',
    'Comprehensive view of revenue metrics and operational KPIs',
    '{
        "widgets": [
            {
                "id": "mrr-kpi",
                "type": "kpi",
                "position": {"x": 0, "y": 0},
                "size": {"width": 3, "height": 2},
                "config": {"title": "Monthly Recurring Revenue", "metric": "total_mrr"}
            },
            {
                "id": "active-clients-kpi",
                "type": "kpi", 
                "position": {"x": 3, "y": 0},
                "size": {"width": 3, "height": 2},
                "config": {"title": "Active Clients", "metric": "active_clients"}
            },
            {
                "id": "revenue-chart",
                "type": "chart",
                "position": {"x": 0, "y": 2},
                "size": {"width": 6, "height": 4},
                "config": {"title": "Revenue by Stream", "chartType": "bar", "metric": "revenue_by_stream"}
            },
            {
                "id": "top-clients-table",
                "type": "table",
                "position": {"x": 6, "y": 0},
                "size": {"width": 6, "height": 6},
                "config": {"title": "Top Clients by Health Score", "dataSource": "top_clients"}
            }
        ],
        "layout": {"columns": 12, "rows": 8}
    }'::jsonb,
    true,
    true
);

-- Insert sample scheduled reports
INSERT INTO scheduled_reports (template_id, name, frequency, delivery_method, recipients, filters, next_run_date, is_active) VALUES
(
    (SELECT id FROM report_templates WHERE name = 'Executive Summary'),
    'Weekly Executive Summary',
    'weekly',
    'email',
    '["exec@company.com", "cfo@company.com"]'::jsonb,
    '{"period": "weekly"}'::jsonb,
    NOW() + INTERVAL '7 days',
    true
),
(
    (SELECT id FROM report_templates WHERE name = 'Revenue Analysis'),
    'Monthly Revenue Report',
    'monthly',
    'email',
    '["finance@company.com", "revenue@company.com"]'::jsonb,
    '{"period": "monthly"}'::jsonb,
    NOW() + INTERVAL '1 month',
    true
);