"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportTemplateInitializer = exports.DEFAULT_REPORT_TEMPLATES = void 0;
const ReportTemplate_1 = require("../../models/ReportTemplate");
exports.DEFAULT_REPORT_TEMPLATES = [
    {
        name: 'Executive Summary Report',
        description: 'High-level overview of business performance with key metrics and insights',
        category: 'executive',
        templateConfig: {
            chartTypes: ['revenue_chart', 'mrr_trend'],
            metrics: ['mrr_arr', 'revenue_summary', 'churn_metrics'],
            filters: {
                sections: ['summary', 'key_metrics', 'revenue_trends', 'growth_analysis'],
                export_formats: ['pdf', 'excel']
            },
            layout: {
                sections: 4,
                orientation: 'vertical'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Monthly Board Report',
        description: 'Comprehensive monthly report for board meetings with strategic insights',
        category: 'executive',
        templateConfig: {
            chartTypes: ['revenue_waterfall', 'cohort_retention'],
            metrics: ['revenue_summary', 'cohort_analysis', 'revenue_forecast'],
            filters: {
                sections: ['executive_summary', 'financial_performance', 'operational_metrics', 'strategic_initiatives'],
                export_formats: ['pdf']
            },
            layout: {
                sections: 4,
                orientation: 'mixed'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Quarterly Business Review',
        description: 'Detailed quarterly analysis for stakeholders and investors',
        category: 'executive',
        templateConfig: {
            chartTypes: ['growth_trends', 'market_analysis'],
            metrics: ['revenue_summary', 'revenue_by_stream', 'revenue_forecast'],
            filters: {
                sections: ['quarter_summary', 'financial_analysis', 'market_position', 'future_outlook'],
                export_formats: ['pdf', 'excel']
            },
            layout: {
                sections: 4,
                orientation: 'mixed'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Revenue Operations Report',
        description: 'Detailed analysis of revenue streams, pricing, and growth opportunities',
        category: 'operational',
        templateConfig: {
            chartTypes: ['revenue_streams', 'tier_performance'],
            metrics: ['mrr_arr', 'revenue_by_stream', 'revenue_by_tier'],
            filters: {
                sections: ['mrr_analysis', 'arr_breakdown', 'pricing_analysis', 'forecasting'],
                export_formats: ['excel', 'csv']
            },
            layout: {
                sections: 4,
                orientation: 'horizontal'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Customer Success Report',
        description: 'Health scores, churn analysis, and retention strategies',
        category: 'operational',
        templateConfig: {
            chartTypes: ['health_scores', 'churn_trends'],
            metrics: ['churn_metrics', 'cohort_analysis'],
            filters: {
                sections: ['health_distribution', 'churn_analysis', 'expansion_opportunities', 'retention_strategies'],
                export_formats: ['pdf', 'excel']
            },
            layout: {
                sections: 4,
                orientation: 'mixed'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Sales Performance Report',
        description: 'Sales metrics, conversion rates, and pipeline analysis',
        category: 'operational',
        templateConfig: {
            chartTypes: ['sales_trends', 'conversion_rates'],
            metrics: ['revenue_summary', 'revenue_by_stream'],
            filters: {
                sections: ['sales_metrics', 'conversion_funnel', 'pipeline_analysis', 'territory_performance'],
                export_formats: ['excel']
            },
            layout: {
                sections: 4,
                orientation: 'horizontal'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Financial Analysis Report',
        description: 'Detailed financial metrics and accounting analysis',
        category: 'financial',
        templateConfig: {
            chartTypes: ['financial_trends', 'profitability_analysis'],
            metrics: ['revenue_summary', 'mrr_arr', 'revenue_by_tier'],
            filters: {
                sections: ['revenue_recognition', 'cash_flow', 'profitability', 'financial_ratios'],
                export_formats: ['excel', 'csv']
            },
            layout: {
                sections: 4,
                orientation: 'vertical'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Revenue Forecast Analysis',
        description: 'Predictive revenue modeling with multiple scenarios',
        category: 'financial',
        templateConfig: {
            chartTypes: ['forecast_trends', 'confidence_intervals'],
            metrics: ['revenue_forecast'],
            filters: {
                sections: ['forecast_summary', 'model_accuracy', 'scenario_analysis', 'assumptions'],
                export_formats: ['excel']
            },
            layout: {
                sections: 4,
                orientation: 'vertical'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Cohort Performance Deep Dive',
        description: 'Comprehensive cohort analysis with retention and revenue metrics',
        category: 'operational',
        templateConfig: {
            chartTypes: ['cohort_heatmap', 'retention_curves'],
            metrics: ['cohort_analysis'],
            filters: {
                sections: ['cohort_overview', 'retention_analysis', 'revenue_cohorts', 'cohort_trends'],
                export_formats: ['excel']
            },
            layout: {
                sections: 4,
                orientation: 'mixed'
            }
        },
        isDefault: true,
        isPublic: true
    },
    {
        name: 'Churn Risk Assessment',
        description: 'Detailed analysis of churn risks and prevention strategies',
        category: 'operational',
        templateConfig: {
            chartTypes: ['risk_distribution', 'churn_timeline'],
            metrics: ['churn_metrics'],
            filters: {
                sections: ['risk_overview', 'churn_predictions', 'risk_factors', 'prevention_strategies'],
                export_formats: ['pdf', 'excel']
            },
            layout: {
                sections: 4,
                orientation: 'vertical'
            }
        },
        isDefault: true,
        isPublic: true
    }
];
class ReportTemplateInitializer {
    static async initializeDefaultTemplates() {
        try {
            console.log('🔄 Initializing default report templates...');
            const existingCount = await ReportTemplate_1.ReportTemplate.countDocuments({ isDefault: true });
            if (existingCount > 0) {
                console.log(`ℹ️ Found ${existingCount} existing default templates`);
                await this.updateExistingTemplates();
                return;
            }
            const insertedTemplates = await ReportTemplate_1.ReportTemplate.insertMany(exports.DEFAULT_REPORT_TEMPLATES);
            console.log(`✅ Successfully initialized ${insertedTemplates.length} default report templates`);
            const summary = await this.getTemplatesSummary();
            console.log('📊 Template Summary:', summary);
        }
        catch (error) {
            console.error('❌ Error initializing default report templates:', error);
            throw error;
        }
    }
    static async updateExistingTemplates() {
        try {
            console.log('🔄 Updating existing default templates...');
            let updatedCount = 0;
            for (const template of exports.DEFAULT_REPORT_TEMPLATES) {
                const existingTemplate = await ReportTemplate_1.ReportTemplate.findOne({
                    name: template.name,
                    isDefault: true
                });
                if (existingTemplate) {
                    existingTemplate.description = template.description;
                    existingTemplate.templateConfig = template.templateConfig;
                    existingTemplate.updatedAt = new Date();
                    await existingTemplate.save();
                    updatedCount++;
                }
                else {
                    await ReportTemplate_1.ReportTemplate.create(template);
                    updatedCount++;
                }
            }
            console.log(`✅ Updated/inserted ${updatedCount} default templates`);
        }
        catch (error) {
            console.error('❌ Error updating existing templates:', error);
            throw error;
        }
    }
    static async getTemplatesSummary() {
        try {
            const summary = await ReportTemplate_1.ReportTemplate.aggregate([
                { $match: { isDefault: true } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        templates: { $push: '$name' }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            const result = {};
            summary.forEach(item => {
                result[item._id] = {
                    count: item.count,
                    templates: item.templates
                };
            });
            return result;
        }
        catch (error) {
            console.error('Error getting templates summary:', error);
            return {};
        }
    }
    static async resetDefaultTemplates() {
        try {
            console.log('⚠️ Resetting all default templates...');
            const deleteResult = await ReportTemplate_1.ReportTemplate.deleteMany({ isDefault: true });
            console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing default templates`);
            await this.initializeDefaultTemplates();
        }
        catch (error) {
            console.error('❌ Error resetting default templates:', error);
            throw error;
        }
    }
    static getAvailableCategories() {
        const categories = new Set(exports.DEFAULT_REPORT_TEMPLATES.map(t => t.category));
        return Array.from(categories).sort();
    }
    static getTemplatesByCategory(category) {
        return exports.DEFAULT_REPORT_TEMPLATES.filter(t => t.category === category);
    }
    static getTotalTemplateCount() {
        return exports.DEFAULT_REPORT_TEMPLATES.length;
    }
    static validateTemplate(template) {
        const errors = [];
        if (!template.name || template.name.trim().length === 0) {
            errors.push('Template name is required');
        }
        if (!template.description || template.description.trim().length === 0) {
            errors.push('Template description is required');
        }
        if (!['executive', 'operational', 'financial', 'custom'].includes(template.category)) {
            errors.push('Invalid template category');
        }
        if (!template.templateConfig || typeof template.templateConfig !== 'object') {
            errors.push('Template configuration is required');
        }
        else {
            const config = template.templateConfig;
            if (!Array.isArray(config.chartTypes)) {
                errors.push('Template chartTypes must be an array');
            }
            if (!Array.isArray(config.metrics) || config.metrics.length === 0) {
                errors.push('Template must include at least one metric');
            }
            if (!config.filters || typeof config.filters !== 'object') {
                errors.push('Template must have filters configuration');
            }
            if (!config.layout || typeof config.layout !== 'object') {
                errors.push('Template must have layout configuration');
            }
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
}
exports.ReportTemplateInitializer = ReportTemplateInitializer;
//# sourceMappingURL=ReportTemplateInitializer.js.map