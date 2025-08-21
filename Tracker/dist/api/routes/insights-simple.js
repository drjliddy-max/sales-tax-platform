"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const SmartInsightsService_1 = require("../../services/insights/SmartInsightsService");
const BusinessInsight_1 = __importDefault(require("../../models/BusinessInsight"));
const router = express_1.default.Router();
const mockDatabaseService = {
    query: async (sql, params) => ({ rows: [] })
};
const mockEmailService = {
    sendEmail: async (notification) => {
        console.log('Email sent:', notification.subject);
    }
};
const mockAnalyticsService = {
    getBusinessAnalytics: async (businessId) => ({}),
    getRevenueHistory: async (businessId, months = 12) => [
        {
            date: new Date(),
            revenue: 50000,
            transactions: 200,
            avg_transaction: 250
        }
    ],
    calculateMetrics: async (businessId) => ({})
};
const smartInsightsService = new SmartInsightsService_1.SmartInsightsService(mockDatabaseService, mockAnalyticsService, mockEmailService);
const auth = (req, res, next) => {
    req.user = {
        sub: 'admin-user',
        app_metadata: {
            businessId: 'demo-business',
            permissions: ['admin', 'read:insights', 'write:insights']
        }
    };
    next();
};
router.post('/generate/:businessId', auth, async (req, res) => {
    try {
        const { businessId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(businessId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid business ID format'
            });
        }
        console.log(`Generating insights for business: ${businessId}`);
        const insights = await smartInsightsService.generateAutomaticInsights(businessId);
        res.json({
            success: true,
            message: 'Insights generated successfully',
            data: {
                business_id: businessId,
                insights_generated: insights.length,
                insights: insights,
                high_impact_count: insights.filter(i => i.impact === 'high').length,
                total_estimated_value: insights.reduce((sum, insight) => sum + (insight.estimated_revenue_impact || insight.estimated_savings || 0), 0),
                generated_at: new Date()
            }
        });
    }
    catch (error) {
        console.error('Error generating insights:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate insights'
        });
    }
});
router.get('/business/:businessId', auth, async (req, res) => {
    try {
        const { businessId } = req.params;
        const { limit = 10, impact, type, status = 'active' } = req.query;
        if (!mongoose_1.default.Types.ObjectId.isValid(businessId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid business ID format'
            });
        }
        const filter = {
            business_id: new mongoose_1.default.Types.ObjectId(businessId),
            status: status
        };
        if (impact)
            filter.impact = impact;
        if (type)
            filter.type = type;
        const insights = await BusinessInsight_1.default.find(filter)
            .sort({ impact: -1, priority: 1, generated_at: -1 })
            .limit(parseInt(limit));
        res.json({
            success: true,
            data: {
                insights: insights,
                summary: {
                    total_insights: insights.length,
                    high_impact_insights: insights.filter(i => i.impact === 'high').length,
                    total_estimated_value: insights.reduce((sum, insight) => sum + (insight.estimated_revenue_impact || insight.estimated_savings || 0), 0)
                }
            }
        });
    }
    catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch insights'
        });
    }
});
router.post('/:insightId/dismiss', auth, async (req, res) => {
    try {
        const { insightId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(insightId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid insight ID format'
            });
        }
        const insight = await BusinessInsight_1.default.findByIdAndUpdate(insightId, {
            status: 'dismissed',
            updatedAt: new Date()
        }, { new: true });
        if (!insight) {
            return res.status(404).json({
                success: false,
                error: 'Insight not found'
            });
        }
        res.json({
            success: true,
            message: 'Insight dismissed successfully',
            data: {
                insight_id: insightId,
                status: insight.status
            }
        });
    }
    catch (error) {
        console.error('Error dismissing insight:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to dismiss insight'
        });
    }
});
router.get('/dashboard/:businessId', auth, async (req, res) => {
    try {
        const { businessId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(businessId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid business ID format'
            });
        }
        const highImpactInsights = await BusinessInsight_1.default.find({
            business_id: new mongoose_1.default.Types.ObjectId(businessId),
            status: 'active',
            impact: 'high'
        }).sort({ confidence_score: -1, priority: 1 }).limit(3);
        const recentInsights = await BusinessInsight_1.default.find({
            business_id: new mongoose_1.default.Types.ObjectId(businessId),
            status: 'active'
        }).sort({ generated_at: -1 }).limit(5);
        const totalInsights = await BusinessInsight_1.default.countDocuments({
            business_id: new mongoose_1.default.Types.ObjectId(businessId)
        });
        const totalValue = recentInsights.reduce((sum, insight) => sum + (insight.estimated_revenue_impact || insight.estimated_savings || 0), 0);
        res.json({
            success: true,
            data: {
                high_impact_insights: highImpactInsights,
                recent_insights: recentInsights,
                summary: {
                    total_active_insights: recentInsights.length,
                    total_potential_value: totalValue,
                    high_impact_count: highImpactInsights.length
                },
                generated_at: new Date()
            }
        });
    }
    catch (error) {
        console.error('Error generating insight dashboard:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate insight dashboard'
        });
    }
});
exports.default = router;
//# sourceMappingURL=insights-simple.js.map