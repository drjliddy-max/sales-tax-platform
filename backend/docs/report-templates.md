# Report Templates Documentation

This document describes the comprehensive report template system integrated into the Sales Tax Tracker application.

## Overview

The report template system provides 10 professional, production-ready templates across three main categories: Executive, Operational, and Financial reporting. These templates offer sophisticated analytics and customizable report generation capabilities.

## Template Categories

### Executive Templates (3 templates)
- **Executive Summary Report**: High-level business performance overview
- **Monthly Board Report**: Comprehensive monthly insights for board meetings  
- **Quarterly Business Review**: Detailed quarterly analysis for stakeholders

### Operational Templates (4 templates)
- **Revenue Operations Report**: Revenue streams and growth opportunities analysis
- **Customer Success Report**: Health scores, churn analysis, and retention strategies
- **Sales Performance Report**: Sales metrics, conversion rates, and pipeline analysis
- **Cohort Performance Deep Dive**: Comprehensive cohort retention and revenue metrics
- **Churn Risk Assessment**: Detailed churn risk analysis and prevention strategies

### Financial Templates (3 templates)
- **Financial Analysis Report**: Detailed financial metrics and accounting analysis
- **Revenue Forecast Analysis**: Predictive revenue modeling with multiple scenarios

## Template Configuration

Each template includes the following configuration:

```typescript
interface TemplateConfig {
  sections: string[];        // Report sections to include
  charts: string[];         // Chart types and visualizations  
  export_formats: string[]; // Supported export formats (PDF, Excel, CSV)
  metrics: string[];        // Analytics metrics to calculate
  layout: {
    sections: number;       // Number of sections in layout
    orientation: string;    // Layout orientation (vertical, horizontal, mixed)
  };
}
```

## Available Metrics

### Revenue Analytics
- `mrr_arr`: Monthly and Annual Recurring Revenue calculations
- `revenue_summary`: Total revenue, growth rates, and trends
- `revenue_by_stream`: Revenue breakdown by business streams
- `revenue_by_tier`: Revenue analysis by customer tiers
- `revenue_forecast`: Predictive revenue modeling

### Customer Analytics  
- `churn_metrics`: Churn rates, patterns, and analysis
- `cohort_analysis`: Customer retention by signup cohorts
- `health_scores`: Customer health scoring and distribution

## API Endpoints

### Template Management
- `GET /api/reports/templates` - Get all available templates
- `GET /api/reports/templates/summary` - Get template statistics
- `POST /api/reports/initialize-templates` - Initialize default templates
- `POST /api/reports/templates/reset-defaults` - Reset to default templates

### Report Generation
- `POST /api/reports/executive` - Generate executive report
- `POST /api/reports/board` - Generate board report  
- `POST /api/reports/operational/:type` - Generate operational report
- `POST /api/reports/custom` - Generate custom report

### Processing Control
- `GET /api/report-processor/status` - Get processor status
- `POST /api/report-processor/process-now` - Manual processing trigger
- `GET /api/report-processor/metrics` - Detailed processing metrics

## Usage Examples

### Generate Executive Summary
```typescript
const report = await fetch('/api/reports/executive', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    start_date: '2024-01-01',
    end_date: '2024-01-31', 
    format: 'pdf'
  })
});
```

### Schedule Monthly Board Report
```typescript
const schedule = await fetch('/api/reports/schedule', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: 'board-report-template-id',
    name: 'Monthly Board Report',
    frequency: 'monthly',
    delivery_method: 'email',
    recipients: ['board@company.com']
  })
});
```

## Template Sections

### Executive Templates
- **Summary**: Key performance indicators and highlights
- **Key Metrics**: Core business metrics and KPIs
- **Revenue Trends**: Revenue analysis and growth patterns
- **Growth Analysis**: Business growth metrics and projections

### Operational Templates
- **MRR Analysis**: Monthly recurring revenue breakdown
- **Health Distribution**: Customer health score analysis  
- **Churn Analysis**: Customer churn patterns and risks
- **Forecasting**: Revenue and growth predictions

### Financial Templates
- **Revenue Recognition**: Financial accounting analysis
- **Cash Flow**: Cash flow analysis and trends
- **Profitability**: Profit margins and financial ratios
- **Financial Ratios**: Key financial performance ratios

## Automated Processing

The ReportProcessor service automatically:
- Checks for scheduled reports every 15 minutes
- Processes due reports using the configured templates
- Delivers reports via email, Slack, or webhooks
- Tracks processing metrics and performance
- Handles errors and retry logic

## Customization

Templates can be customized by modifying:
- **Sections**: Add/remove report sections
- **Metrics**: Include different analytics calculations  
- **Charts**: Change visualization types
- **Layout**: Modify section arrangement
- **Export Formats**: Support different output formats

## Frontend Integration

The React reporting dashboard provides:
- Visual template selection with category filters
- Real-time report generation with progress indicators
- Template configuration with date ranges and formats
- Scheduled report management interface
- Report history with download capabilities

## Database Schema

Templates are stored in MongoDB with the following structure:
- Template metadata (name, description, category)
- Configuration object with sections and metrics
- Default/public flags for system templates
- Creation and modification timestamps

## Performance

The system is optimized for:
- Fast template loading and selection
- Efficient report generation with caching
- Parallel processing of multiple reports
- Minimal database queries through aggregation
- Scalable processing with queue management

## Security

Template access includes:
- Admin-level permissions for template management
- Business-level isolation for multi-tenant usage
- Audit logging for all report generation
- Secure file storage and download URLs
- Rate limiting on API endpoints