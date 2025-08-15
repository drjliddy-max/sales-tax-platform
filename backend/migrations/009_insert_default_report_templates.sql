-- Migration: Insert comprehensive default report templates
-- Date: 2024-01-17
-- Description: Add production-ready report templates for executive, operational, and financial reporting

-- Clear existing default templates to avoid duplicates
DELETE FROM report_templates WHERE is_default = true;

-- Insert default report templates
INSERT INTO report_templates (name, description, category, template_config, is_default, is_public, created_at, updated_at) VALUES

-- Executive Templates
('Executive Summary Report', 
 'High-level overview of business performance with key metrics and insights', 
 'executive', 
 '{"sections": ["summary", "key_metrics", "revenue_trends", "growth_analysis"], "charts": ["revenue_chart", "mrr_trend"], "export_formats": ["pdf", "excel"], "metrics": ["mrr_arr", "revenue_summary", "churn_metrics"], "layout": {"sections": 4, "orientation": "vertical"}}', 
 true, true, NOW(), NOW()),

('Monthly Board Report', 
 'Comprehensive monthly report for board meetings with strategic insights', 
 'executive', 
 '{"sections": ["executive_summary", "financial_performance", "operational_metrics", "strategic_initiatives"], "charts": ["revenue_waterfall", "cohort_retention"], "export_formats": ["pdf"], "metrics": ["revenue_summary", "cohort_analysis", "revenue_forecast"], "layout": {"sections": 4, "orientation": "mixed"}}', 
 true, true, NOW(), NOW()),

('Quarterly Business Review', 
 'Detailed quarterly analysis for stakeholders and investors', 
 'executive', 
 '{"sections": ["quarter_summary", "financial_analysis", "market_position", "future_outlook"], "charts": ["growth_trends", "market_analysis"], "export_formats": ["pdf", "excel"], "metrics": ["revenue_summary", "revenue_by_stream", "revenue_forecast"], "layout": {"sections": 4, "orientation": "mixed"}}', 
 true, true, NOW(), NOW()),

-- Operational Templates
('Revenue Operations Report', 
 'Detailed analysis of revenue streams, pricing, and growth opportunities', 
 'operational', 
 '{"sections": ["mrr_analysis", "arr_breakdown", "pricing_analysis", "forecasting"], "charts": ["revenue_streams", "tier_performance"], "export_formats": ["excel", "csv"], "metrics": ["mrr_arr", "revenue_by_stream", "revenue_by_tier"], "layout": {"sections": 4, "orientation": "horizontal"}}', 
 true, true, NOW(), NOW()),

('Customer Success Report', 
 'Health scores, churn analysis, and retention strategies', 
 'operational', 
 '{"sections": ["health_distribution", "churn_analysis", "expansion_opportunities", "retention_strategies"], "charts": ["health_scores", "churn_trends"], "export_formats": ["pdf", "excel"], "metrics": ["churn_metrics", "cohort_analysis"], "layout": {"sections": 4, "orientation": "mixed"}}', 
 true, true, NOW(), NOW()),

('Sales Performance Report', 
 'Sales metrics, conversion rates, and pipeline analysis', 
 'operational', 
 '{"sections": ["sales_metrics", "conversion_funnel", "pipeline_analysis", "territory_performance"], "charts": ["sales_trends", "conversion_rates"], "export_formats": ["excel"], "metrics": ["revenue_summary", "revenue_by_stream"], "layout": {"sections": 4, "orientation": "horizontal"}}', 
 true, true, NOW(), NOW()),

-- Financial Templates
('Financial Analysis Report', 
 'Detailed financial metrics and accounting analysis', 
 'financial', 
 '{"sections": ["revenue_recognition", "cash_flow", "profitability", "financial_ratios"], "charts": ["financial_trends", "profitability_analysis"], "export_formats": ["excel", "csv"], "metrics": ["revenue_summary", "mrr_arr", "revenue_by_tier"], "layout": {"sections": 4, "orientation": "vertical"}}', 
 true, true, NOW(), NOW()),

('Revenue Forecast Analysis', 
 'Predictive revenue modeling with multiple scenarios', 
 'financial', 
 '{"sections": ["forecast_summary", "model_accuracy", "scenario_analysis", "assumptions"], "charts": ["forecast_trends", "confidence_intervals"], "export_formats": ["excel"], "metrics": ["revenue_forecast"], "layout": {"sections": 4, "orientation": "vertical"}}', 
 true, true, NOW(), NOW()),

-- Advanced Analysis Templates  
('Cohort Performance Deep Dive', 
 'Comprehensive cohort analysis with retention and revenue metrics', 
 'operational', 
 '{"sections": ["cohort_overview", "retention_analysis", "revenue_cohorts", "cohort_trends"], "charts": ["cohort_heatmap", "retention_curves"], "export_formats": ["excel"], "metrics": ["cohort_analysis"], "layout": {"sections": 4, "orientation": "mixed"}}', 
 true, true, NOW(), NOW()),

('Churn Risk Assessment', 
 'Detailed analysis of churn risks and prevention strategies', 
 'operational', 
 '{"sections": ["risk_overview", "churn_predictions", "risk_factors", "prevention_strategies"], "charts": ["risk_distribution", "churn_timeline"], "export_formats": ["pdf", "excel"], "metrics": ["churn_metrics"], "layout": {"sections": 4, "orientation": "vertical"}}', 
 true, true, NOW(), NOW());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_report_templates_category_default ON report_templates(category, is_default);
CREATE INDEX IF NOT EXISTS idx_report_templates_public_default ON report_templates(is_public, is_default);

-- Update template statistics
UPDATE report_templates SET updated_at = NOW() WHERE is_default = true;

-- Verification query
SELECT 
    category,
    COUNT(*) as template_count,
    STRING_AGG(name, ', ') as template_names
FROM report_templates 
WHERE is_default = true 
GROUP BY category 
ORDER BY category;