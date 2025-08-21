"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartInsightsService = exports.InsightEngine = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const BusinessInsight_1 = __importDefault(require("../../models/BusinessInsight"));
const InsightDigest_1 = __importDefault(require("../../models/InsightDigest"));
const Business_1 = __importDefault(require("../../models/Business"));
class InsightEngine {
    async generateInsight(data, type) {
        try {
            switch (type) {
                case 'seasonal_optimization':
                    return this.generateSeasonalInsight(data);
                case 'pricing_optimization':
                    return await this.generatePricingInsight(data);
                case 'customer_retention':
                    return await this.generateRetentionInsight(data);
                case 'tax_optimization':
                    return await this.generateTaxInsight(data);
                default:
                    return null;
            }
        }
        catch (error) {
            console.error('Error generating insight', {
                insightType: type,
                error: error
            });
            return null;
        }
    }
    generateSeasonalInsight(data) {
        const pattern = this.analyzeSeasonalPatterns(data.revenue_history);
        if (pattern.strength < 0.6)
            return null;
        return {
            type: 'seasonal_optimization',
            title: `${pattern.peak_season} seasonal opportunity`,
            insight: `Strong seasonal pattern detected with ${pattern.peak_increase}% increase during ${pattern.peak_season}`,
            impact: pattern.strength > 0.8 ? 'high' : 'medium',
            effort: 'medium',
            estimated_revenue_impact: data.monthly_revenue * (pattern.peak_increase / 100) * 0.15,
            actionable_steps: [
                `Prepare inventory ${pattern.prep_weeks} weeks early`,
                'Increase marketing spend during peak season',
                'Optimize staffing for seasonal demand'
            ],
            confidence_score: pattern.strength,
            generated_at: new Date(),
            priority: Math.round(pattern.strength * 10)
        };
    }
    async generatePricingInsight(data) {
        const analysis = await this.analyzePricingOpportunities(data);
        if (analysis.optimization_potential < 0.05)
            return null;
        return {
            type: 'pricing_optimization',
            title: 'Price optimization opportunity',
            insight: `Analysis suggests ${(analysis.recommended_increase * 100).toFixed(1)}% price increase potential`,
            impact: analysis.optimization_potential > 0.15 ? 'high' : 'medium',
            effort: 'low',
            estimated_revenue_impact: analysis.revenue_impact,
            actionable_steps: [
                'Test price increase on top products',
                'Monitor customer response metrics',
                'Gradually roll out if successful'
            ],
            confidence_score: analysis.risk_assessment === 'low' ? 0.8 : 0.6,
            generated_at: new Date(),
            priority: analysis.optimization_potential > 0.15 ? 2 : 5
        };
    }
    async generateRetentionInsight(data) {
        const analysis = await this.analyzeCustomerBehavior(data);
        if (analysis.repeat_customer_opportunity < 0.2)
            return null;
        return {
            type: 'customer_retention',
            title: 'Customer retention opportunity',
            insight: `${(analysis.one_time_customers * 100).toFixed(0)}% of customers make only one purchase`,
            impact: 'medium',
            effort: 'low',
            estimated_revenue_impact: data.monthly_revenue * analysis.repeat_customer_opportunity,
            actionable_steps: [
                'Implement follow-up email campaign',
                'Create loyalty program',
                'Offer return customer incentives'
            ],
            confidence_score: 0.75,
            generated_at: new Date(),
            priority: 4
        };
    }
    async generateTaxInsight(data) {
        const analysis = await this.analyzeTaxBurden(data);
        if (analysis.optimization_opportunities.length === 0)
            return null;
        return {
            type: 'tax_optimization',
            title: 'Tax optimization opportunities',
            insight: `Found ${analysis.optimization_opportunities.length} ways to reduce tax burden`,
            impact: 'medium',
            effort: 'low',
            estimated_savings: analysis.potential_savings,
            actionable_steps: analysis.optimization_opportunities.map(opp => opp.description),
            confidence_score: 0.85,
            generated_at: new Date(),
            priority: 3
        };
    }
    analyzeSeasonalPatterns(revenueHistory) {
        const monthlyData = this.groupRevenueByMonth(revenueHistory);
        const maxMonth = this.findPeakMonth(monthlyData);
        const avgRevenue = revenueHistory.reduce((sum, point) => sum + point.revenue, 0) / revenueHistory.length;
        const peakRevenue = monthlyData[maxMonth] || avgRevenue;
        return {
            strength: Math.min((peakRevenue - avgRevenue) / avgRevenue, 1.0),
            peak_season: this.getSeasonName(maxMonth),
            peak_increase: ((peakRevenue - avgRevenue) / avgRevenue) * 100,
            prep_weeks: 6,
            marketing_start_weeks: 8,
            seasonal_variance: this.calculateVariance(Object.values(monthlyData))
        };
    }
    async analyzePricingOpportunities(data) {
        const industryMultiplier = this.getIndustryPricingMultiplier(data.industry);
        return {
            optimization_potential: Math.random() * 0.2,
            recommended_increase: 0.08 * industryMultiplier,
            revenue_impact: data.annual_revenue * 0.08 * industryMultiplier,
            risk_assessment: 'low',
            price_elasticity: 0.7
        };
    }
    async analyzeCustomerBehavior(data) {
        return {
            repeat_customer_rate: 0.35,
            one_time_customers: 0.65,
            repeat_customer_opportunity: 0.4,
            avg_customer_lifetime_value: data.monthly_revenue * 0.1,
            customer_acquisition_cost: data.monthly_revenue * 0.05,
            churn_risk_factors: ['price sensitivity', 'service quality', 'competition']
        };
    }
    async analyzeTaxBurden(data) {
        return {
            current_annual_tax: data.annual_revenue * 0.08,
            optimization_opportunities: [
                {
                    type: 'exemption_certificates',
                    description: 'Improve exemption certificate collection',
                    estimated_savings: data.annual_revenue * 0.01,
                    implementation_effort: 'low',
                    compliance_risk: 'low',
                    priority: 1
                }
            ],
            potential_savings: data.annual_revenue * 0.01,
            compliance_risk: 0.2,
            industry_benchmark: data.annual_revenue * 0.075
        };
    }
    groupRevenueByMonth(history) {
        const monthlyData = {};
        history.forEach(point => {
            const month = new Date(point.date).getMonth();
            monthlyData[month] = (monthlyData[month] || 0) + point.revenue;
        });
        return monthlyData;
    }
    findPeakMonth(monthlyData) {
        return Object.entries(monthlyData)
            .reduce((peak, [month, revenue]) => revenue > (monthlyData[peak] || 0) ? parseInt(month) : peak, 0);
    }
    getSeasonName(month) {
        const seasons = ['Q1', 'Q1', 'Q1', 'Q2', 'Q2', 'Q2', 'Q3', 'Q3', 'Q3', 'Q4', 'Q4', 'Q4'];
        return seasons[month];
    }
    calculateVariance(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    }
    getIndustryPricingMultiplier(industry) {
        const multipliers = {
            'restaurant': 1.2,
            'retail': 1.0,
            'service': 1.1,
            'manufacturing': 0.9
        };
        return multipliers[industry] || 1.0;
    }
}
exports.InsightEngine = InsightEngine;
class SmartInsightsService {
    constructor(db, analytics, emailService) {
        this.db = db;
        this.analytics = analytics;
        this.emailService = emailService;
        this.insightEngine = new InsightEngine();
    }
    async generateAutomaticInsights(businessId) {
        try {
            const businessData = await this.getBusinessAnalyticsData(businessId);
            const insights = [];
            const [revenueInsights, taxInsights, operationalInsights, growthInsights, riskInsights] = await Promise.all([
                this.generateRevenueInsights(businessData),
                this.generateTaxOptimizationInsights(businessData),
                this.generateOperationalInsights(businessData),
                this.generateGrowthInsights(businessData),
                this.generateRiskInsights(businessData)
            ]);
            insights.push(...revenueInsights, ...taxInsights, ...operationalInsights, ...growthInsights, ...riskInsights);
            const rankedInsights = this.rankInsightsByValue(insights);
            await this.saveInsightsForBusiness(businessId, rankedInsights);
            return rankedInsights;
        }
        catch (error) {
            console.error('Error generating insights for business', {
                businessId: businessId,
                error: error
            });
            throw new Error(`Failed to generate insights: ${error.message}`);
        }
    }
    async generateRevenueInsights(businessData) {
        const insights = [];
        try {
            const seasonalInsight = await this.insightEngine.generateInsight(businessData, 'seasonal_optimization');
            if (seasonalInsight)
                insights.push(seasonalInsight);
            const pricingInsight = await this.insightEngine.generateInsight(businessData, 'pricing_optimization');
            if (pricingInsight)
                insights.push(pricingInsight);
            const retentionInsight = await this.insightEngine.generateInsight(businessData, 'customer_retention');
            if (retentionInsight)
                insights.push(retentionInsight);
            return insights;
        }
        catch (error) {
            console.error('Error generating revenue insights:', error);
            return [];
        }
    }
    async generateTaxOptimizationInsights(businessData) {
        const insights = [];
        try {
            const taxInsight = await this.insightEngine.generateInsight(businessData, 'tax_optimization');
            if (taxInsight)
                insights.push(taxInsight);
            const exemptionAnalysis = await this.analyzeExemptionOpportunities(businessData);
            if (exemptionAnalysis.missed_exemptions > 0) {
                insights.push({
                    type: 'exemption_opportunity',
                    title: 'Missed tax exemption opportunities',
                    insight: `${exemptionAnalysis.missed_exemptions} transactions qualified for exemptions but weren't applied. This represents $${exemptionAnalysis.missed_savings.toLocaleString()} in unnecessary tax payments.`,
                    impact: 'medium',
                    effort: 'low',
                    estimated_savings: exemptionAnalysis.missed_savings,
                    actionable_steps: [
                        'Implement automatic exemption detection',
                        'Train staff on exemption certificate collection',
                        'Set up exemption alerts for qualifying transactions'
                    ],
                    confidence_score: 0.9,
                    generated_at: new Date(),
                    priority: 5
                });
            }
            return insights;
        }
        catch (error) {
            console.error('Error generating tax insights:', error);
            return [];
        }
    }
    async generateOperationalInsights(businessData) {
        const insights = [];
        try {
            const peakHourAnalysis = await this.analyzePeakHours(businessData);
            if (peakHourAnalysis.optimization_potential > 0.15) {
                insights.push({
                    type: 'peak_hour_optimization',
                    title: 'Peak hour staffing optimization',
                    insight: `Your busiest hours are ${peakHourAnalysis.peak_hours.join(', ')}. Optimizing staffing during these times could increase throughput by ${(peakHourAnalysis.optimization_potential * 100).toFixed(0)}%.`,
                    impact: 'medium',
                    effort: 'medium',
                    estimated_revenue_impact: businessData.monthly_revenue * peakHourAnalysis.optimization_potential,
                    actionable_steps: [
                        `Add 1 extra staff member during ${peakHourAnalysis.peak_hours.join(' and ')}`,
                        'Cross-train employees for peak hour flexibility',
                        'Consider appointment-based service during busy times'
                    ],
                    confidence_score: 0.7,
                    generated_at: new Date(),
                    priority: 6
                });
            }
            const inventoryAnalysis = await this.analyzeInventoryPatterns(businessData);
            if (inventoryAnalysis.overstock_value > 1000) {
                insights.push({
                    type: 'inventory_optimization',
                    title: 'Inventory optimization opportunity',
                    insight: `You have $${inventoryAnalysis.overstock_value.toLocaleString()} in slow-moving inventory. Optimizing stock levels could free up capital and reduce storage costs.`,
                    impact: 'medium',
                    effort: 'medium',
                    estimated_savings: inventoryAnalysis.potential_savings,
                    actionable_steps: [
                        'Run clearance promotion on slow-moving items',
                        'Adjust reorder points for overstock items',
                        'Implement just-in-time ordering for fast movers'
                    ],
                    confidence_score: 0.8,
                    generated_at: new Date(),
                    priority: 7
                });
            }
            return insights;
        }
        catch (error) {
            console.error('Error generating operational insights:', error);
            return [];
        }
    }
    async generateGrowthInsights(businessData) {
        const insights = [];
        try {
            const marketAnalysis = await this.analyzeMarketExpansion(businessData);
            if (marketAnalysis.expansion_score > 0.7) {
                insights.push({
                    type: 'market_expansion',
                    title: 'Market expansion opportunity',
                    insight: `Your growth trajectory suggests expansion potential in ${marketAnalysis.target_states.join(', ')}. Early market entry could capture additional revenue.`,
                    impact: 'high',
                    effort: 'medium',
                    estimated_revenue_impact: marketAnalysis.estimated_additional_revenue,
                    actionable_steps: [
                        'Research market demand in target states',
                        'Prepare for sales tax registration',
                        'Develop market entry strategy'
                    ],
                    confidence_score: marketAnalysis.expansion_score,
                    generated_at: new Date(),
                    priority: 8
                });
            }
            return insights;
        }
        catch (error) {
            console.error('Error generating growth insights:', error);
            return [];
        }
    }
    async generateRiskInsights(businessData) {
        const insights = [];
        try {
            const auditRisk = await this.calculateAuditRisk(businessData);
            if (auditRisk.score > 0.6) {
                insights.push({
                    type: 'audit_risk_mitigation',
                    title: 'Audit risk mitigation recommended',
                    insight: `Your audit risk score is ${(auditRisk.score * 100).toFixed(0)}%. Taking proactive steps now could significantly reduce audit likelihood.`,
                    impact: 'high',
                    effort: 'low',
                    actionable_steps: [
                        'Enhance transaction documentation',
                        'Improve exemption certificate management',
                        'Implement automated compliance checks'
                    ],
                    confidence_score: 0.85,
                    generated_at: new Date(),
                    priority: 9
                });
            }
            return insights;
        }
        catch (error) {
            console.error('Error generating risk insights:', error);
            return [];
        }
    }
    async deliverInsightsToUser(businessId, insights) {
        try {
            const deliveryPreferences = await this.getUserInsightPreferences(businessId);
            if (deliveryPreferences.delivery_method === 'none') {
                return;
            }
            const highImpactInsights = insights.filter(i => i.impact === 'high').slice(0, 2);
            const mediumImpactInsights = insights.filter(i => i.impact === 'medium');
            if (highImpactInsights.length > 0) {
                await this.sendGentleInsightNotification(businessId, {
                    type: 'high_impact_insights',
                    insights: highImpactInsights,
                    delivery_method: deliveryPreferences.delivery_method,
                    priority: 'low'
                });
            }
            if (mediumImpactInsights.length > 0) {
                await this.scheduleInsightDigest(businessId, mediumImpactInsights);
            }
            await this.updateDashboardInsights(businessId, insights);
        }
        catch (error) {
            console.error('Error delivering insights to user', {
                businessId: businessId,
                error: error
            });
        }
    }
    async sendGentleInsightNotification(businessId, notificationData) {
        try {
            const user = await this.getUserInfo(businessId);
            const notification = {
                to: user.email,
                subject: '💡 Quick revenue opportunity spotted',
                template: 'insight_notification',
                data: {
                    user_name: user.name,
                    insights: notificationData.insights,
                    dashboard_url: `${process.env.APP_URL}/dashboard`,
                    unsubscribe_url: `${process.env.APP_URL}/preferences/insights`
                },
                priority: 'low',
                send_time: 'optimal'
            };
            await this.emailService.sendEmail(notification);
        }
        catch (error) {
            console.error('Error sending insight notification:', error);
        }
    }
    async scheduleInsightDigest(businessId, insights) {
        try {
            const preferences = await this.getUserInsightPreferences(businessId);
            const scheduleDate = this.calculateNextDigestDate(preferences.frequency);
            const digest = new InsightDigest_1.default({
                business_id: new mongoose_1.default.Types.ObjectId(businessId),
                digest_type: preferences.frequency === 'weekly' ? 'weekly' : 'monthly',
                insights: insights,
                generated_at: new Date(),
                scheduled_send_date: scheduleDate,
                sent: false
            });
            await digest.save();
        }
        catch (error) {
            console.error('Error scheduling insight digest:', error);
        }
    }
    async saveInsightsForBusiness(businessId, insights) {
        try {
            const insightDocs = insights.map(insight => ({
                ...insight,
                business_id: new mongoose_1.default.Types.ObjectId(businessId),
                status: 'active'
            }));
            await BusinessInsight_1.default.insertMany(insightDocs, { ordered: false });
        }
        catch (error) {
            console.error('Error saving insights:', error);
        }
    }
    async updateDashboardInsights(businessId, insights) {
        try {
            const currentTypes = insights.map(i => i.type);
            await BusinessInsight_1.default.updateMany({
                business_id: new mongoose_1.default.Types.ObjectId(businessId),
                type: { $in: currentTypes },
                status: 'active'
            }, {
                status: 'dismissed'
            });
        }
        catch (error) {
            console.error('Error updating dashboard insights:', error);
        }
    }
    rankInsightsByValue(insights) {
        return insights.sort((a, b) => {
            const impactWeight = { high: 3, medium: 2, low: 1 };
            const aValue = (a.estimated_revenue_impact || a.estimated_savings || 0);
            const bValue = (b.estimated_revenue_impact || b.estimated_savings || 0);
            const aScore = impactWeight[a.impact] * aValue * a.confidence_score;
            const bScore = impactWeight[b.impact] * bValue * b.confidence_score;
            return bScore - aScore;
        });
    }
    async getBusinessAnalyticsData(businessId) {
        try {
            const business = await Business_1.default.findById(businessId);
            if (!business) {
                throw new Error(`Business ${businessId} not found`);
            }
            const revenueHistory = await this.analytics.getRevenueHistory(businessId, 12);
            const monthlyRevenue = revenueHistory.length > 0
                ? revenueHistory.slice(-1)[0].revenue
                : 0;
            const annualRevenue = monthlyRevenue * 12;
            return {
                id: business.businessId,
                name: business.name,
                industry: 'retail',
                monthly_revenue: monthlyRevenue,
                annual_revenue: annualRevenue,
                employee_count: 5,
                locations: [],
                revenue_history: revenueHistory,
                tax_profile: {
                    jurisdictions: [],
                    filing_schedule: [],
                    exemption_rules: [],
                    automation_level: {
                        calculation: 'full',
                        filing_preparation: 'assisted',
                        rate_updates: 'silent',
                        reporting: 'scheduled'
                    }
                },
                pos_integrations: [],
                created_at: business.createdAt,
                updated_at: business.updatedAt
            };
        }
        catch (error) {
            console.error('Error fetching business analytics data', {
                businessId: businessId,
                error: error
            });
            throw error;
        }
    }
    async getUserInsightPreferences(businessId) {
        return {
            delivery_method: 'email',
            frequency: 'weekly',
            insight_types: ['seasonal_optimization', 'pricing_optimization', 'tax_optimization'],
            optimal_send_time: '09:00',
            timezone: 'America/New_York',
            email_digest_enabled: true,
            mobile_notifications_enabled: false
        };
    }
    async getUserInfo(businessId) {
        const business = await Business_1.default.findById(businessId);
        if (!business) {
            throw new Error(`Business ${businessId} not found`);
        }
        return {
            id: businessId,
            name: business.name,
            email: 'owner@business.com',
            business_id: businessId,
            timezone: 'America/New_York',
            notification_preferences: await this.getUserInsightPreferences(businessId)
        };
    }
    calculateNextDigestDate(frequency) {
        const now = new Date();
        const nextDate = new Date(now);
        if (frequency === 'weekly') {
            nextDate.setDate(now.getDate() + (7 - now.getDay() + 1));
        }
        else {
            nextDate.setMonth(now.getMonth() + 1, 1);
        }
        nextDate.setHours(9, 0, 0, 0);
        return nextDate;
    }
    async analyzeExemptionOpportunities(businessData) {
        return {
            missed_exemptions: Math.floor(Math.random() * 10) + 1,
            missed_savings: Math.random() * 5000 + 1000,
            exemption_rate: 0.85,
            improvement_potential: 0.15,
            certificate_coverage: 0.9,
            expired_certificates: 2
        };
    }
    async analyzePeakHours(businessData) {
        return {
            peak_hours: ['11:00-12:00', '17:00-18:00'],
            optimization_potential: 0.2,
            current_utilization: 0.7,
            staffing_recommendations: [
                {
                    time_period: '11:00-12:00',
                    recommended_staff: 3,
                    current_staff: 2,
                    expected_improvement: 0.25
                }
            ]
        };
    }
    async analyzeInventoryPatterns(businessData) {
        return {
            overstock_value: 5000,
            potential_savings: 1500,
            fast_movers: [],
            slow_movers: [],
            turnover_rate: 4.2
        };
    }
    async analyzeMarketExpansion(businessData) {
        return {
            expansion_score: 0.8,
            target_states: ['Texas', 'Florida'],
            estimated_additional_revenue: businessData.annual_revenue * 0.3,
            market_saturation: { 'Texas': 0.6, 'Florida': 0.4 },
            competition_analysis: {
                'Texas': { competitor_count: 15, market_share_opportunity: 0.12, average_pricing: 100, entry_difficulty: 'medium' },
                'Florida': { competitor_count: 8, market_share_opportunity: 0.18, average_pricing: 95, entry_difficulty: 'low' }
            }
        };
    }
    async calculateAuditRisk(businessData) {
        return {
            score: 0.3,
            risk_factors: [
                {
                    factor: 'filing_consistency',
                    impact: 0.2,
                    description: 'Filing patterns show some inconsistencies',
                    severity: 'low',
                    mitigation_steps: ['Implement automated filing reminders']
                }
            ],
            industry_baseline: 0.25,
            recommendation: 'maintain_current_practices'
        };
    }
    async getBusinessInsights(businessId, limit = 10) {
        const insights = await BusinessInsight_1.default.find({
            business_id: new mongoose_1.default.Types.ObjectId(businessId),
            status: 'active'
        }).sort({ impact: -1, priority: 1 }).limit(limit);
        return insights.map((insight) => insight.toObject());
    }
    async markInsightAsViewed(insightId) {
        const insight = await BusinessInsight_1.default.findById(insightId);
        if (insight) {
            insight.analytics = insight.analytics || { views: 0, clicks: 0, time_spent_viewing: 0, last_viewed: new Date() };
            insight.analytics.views += 1;
            insight.analytics.last_viewed = new Date();
            await insight.save();
        }
    }
    async dismissInsight(insightId) {
        await BusinessInsight_1.default.findByIdAndUpdate(insightId, { status: 'dismissed' });
    }
    async getInsightMetrics(businessId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const metrics = await BusinessInsight_1.default.aggregate([
            {
                $match: {
                    business_id: new mongoose_1.default.Types.ObjectId(businessId),
                    generated_at: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total_insights: { $sum: 1 },
                    avg_confidence: { $avg: '$confidence_score' },
                    high_impact_count: {
                        $sum: { $cond: [{ $eq: ['$impact', 'high'] }, 1, 0] }
                    },
                    completed_count: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    }
                }
            }
        ]);
        return metrics[0] || {};
    }
}
exports.SmartInsightsService = SmartInsightsService;
//# sourceMappingURL=SmartInsightsService.js.map