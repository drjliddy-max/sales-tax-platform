"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const SmartInsightsService_1 = require("../../services/insights/SmartInsightsService");
const BusinessInsight_1 = __importDefault(require("../../models/BusinessInsight"));
const InsightDigest_1 = __importDefault(require("../../models/InsightDigest"));
const Business_1 = __importDefault(require("../../models/Business"));
const router = express_1.default.Router();
class MockDatabaseService {
    async query(sql, params) {
        return { rows: [] };
    }
}
class MockAnalyticsService {
    async getBusinessAnalytics(businessId) {
        return {};
    }
    async getRevenueHistory(businessId, months) {
        const history = [];
        const now = new Date();
        for (let i = 0; i < (months || 12); i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            history.push({
                date,
                revenue: Math.random() * 50000 + 25000,
                transactions: Math.floor(Math.random() * 500) + 100,
                avg_transaction: Math.random() * 100 + 50
            });
        }
        return history.reverse();
    }
    async calculateMetrics(businessId) {
        return {};
    }
}
class MockEmailService {
    async sendEmail(notification) {
        console.log('Mock email sent:', notification.subject);
    }
}
const auth = (req, res, next) => {
    req.user = {
        sub: 'admin-user',
        app_metadata: {
            role: 'admin',
            businessId: 'demo-business',
            permissions: ['admin', 'read:insights', 'write:insights', 'manage:insights']
        }
    };
    next();
};
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (permission === 'read:insights' || permission === 'write:insights' || permission === 'manage:insights') {
            next();
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
        }
    };
};
const db = new MockDatabaseService();
const analytics = new MockAnalyticsService();
const emailService = new MockEmailService();
const smartInsightsService = new SmartInsightsService_1.SmartInsightsService(db, analytics, emailService);
router.post('/generate/:businessId', auth, requirePermission('write:insights'), async (req, res) => {
    try {
        const { businessId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(businessId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid business ID format'
            });
        }
        const business = await Business_1.default.findById(businessId);
        if (!business) {
            return res.status(404).json({
                success: false,
                error: 'Business not found'
            });
        }
        console.log(`Generating insights for business: ${business.name}`);
        const insights = await smartInsightsService.generateAutomaticInsights(businessId);
        const { deliver = false } = req.body;
        if (deliver) {
            await smartInsightsService.deliverInsightsToUser(businessId, insights);
        }
        res.json({
            success: true,
            message: `Generated ${insights.length} insights for business`,
            data: {
                business_id: businessId,
                business_name: business.name,
                insights_generated: insights.length,
                insights: insights,
                delivered_to_user: deliver,
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
router.get('/business/:businessId', auth, requirePermission('read:insights'), async (req, res) => {
    try {
        const { businessId } = req.params;
        const { status = 'active', type, impact, limit = 20, offset = 0, sort_by = 'priority' } = req.query;
        if (!mongoose_1.default.Types.ObjectId.isValid(businessId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid business ID format'
            });
        }
        const filter = {
            business_id: new mongoose_1.default.Types.ObjectId(businessId)
        };
        if (status)
            filter.status = status;
        if (type)
            filter.type = type;
        if (impact)
            filter.impact = impact;
        let sortOptions = {};
        switch (sort_by) {
            case 'priority':
                sortOptions = { priority: 1, generated_at: -1 };
                break;
            case 'impact':
                sortOptions = { impact: -1, priority: 1 };
                break;
            case 'date':
                sortOptions = { generated_at: -1 };
                break;
            case 'confidence':
                sortOptions = { confidence_score: -1, priority: 1 };
                break;
            default:
                sortOptions = { priority: 1, generated_at: -1 };
        }
        const [insights, totalCount] = await Promise.all([
            BusinessInsight_1.default.find(filter)
                .sort(sortOptions)
                .limit(parseInt(limit))
                .skip(parseInt(offset))
                .lean(),
            BusinessInsight_1.default.countDocuments(filter)
        ]);
        const stats = await BusinessInsight_1.default.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    total_insights: { $sum: 1 },
                    high_impact_count: { $sum: { $cond: [{ $eq: ['$impact', 'high'] }, 1, 0] } },
                    medium_impact_count: { $sum: { $cond: [{ $eq: ['$impact', 'medium'] }, 1, 0] } },
                    low_impact_count: { $sum: { $cond: [{ $eq: ['$impact', 'low'] }, 1, 0] } },
                    avg_confidence: { $avg: '$confidence_score' },
                    total_potential_value: {
                        $sum: {
                            $add: [
                                { $ifNull: ['$estimated_revenue_impact', 0] },
                                { $ifNull: ['$estimated_savings', 0] }
                            ]
                        }
                    }
                }
            }
        ]);
        res.json({
            success: true,
            data: {
                insights: insights,
                pagination: {
                    total: totalCount,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: totalCount > parseInt(offset) + parseInt(limit)
                },
                summary: stats[0] || {
                    total_insights: 0,
                    high_impact_count: 0,
                    medium_impact_count: 0,
                    low_impact_count: 0,
                    avg_confidence: 0,
                    total_potential_value: 0
                }
            }
        });
    }
    catch (error) {
        console.error('Error fetching business insights:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch insights'
        });
    }
});
router.get('/:insightId', auth, requirePermission('read:insights'), async (req, res) => {
    try {
        const { insightId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(insightId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid insight ID format'
            });
        }
        const insight = await BusinessInsight_1.default.findById(insightId);
        if (!insight) {
            return res.status(404).json({
                success: false,
                error: 'Insight not found'
            });
        }
        await insight.markAsViewed();
        res.json({
            success: true,
            data: {
                insight: insight.toObject()
            }
        });
    }
    catch (error) {
        console.error('Error fetching insight:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch insight'
        });
    }
});
router.put('/:insightId/status', auth, requirePermission('write:insights'), async (req, res) => {
    try {
        const { insightId } = req.params;
        const { status, feedback } = req.body;
        if (!mongoose_1.default.Types.ObjectId.isValid(insightId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid insight ID format'
            });
        }
        if (!['active', 'completed', 'dismissed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be one of: active, completed, dismissed'
            });
        }
        const updateData = { status };
        if (feedback) {
            updateData.user_feedback = {
                rating: feedback.rating,
                comment: feedback.comment,
                implemented: status === 'completed',
                implementation_date: status === 'completed' ? new Date() : undefined
            };
        }
        const insight = await BusinessInsight_1.default.findByIdAndUpdate(insightId, updateData, { new: true });
        if (!insight) {
            return res.status(404).json({
                success: false,
                error: 'Insight not found'
            });
        }
        res.json({
            success: true,
            message: `Insight status updated to ${status}`,
            data: {
                insight: insight.toObject()
            }
        });
    }
    catch (error) {
        console.error('Error updating insight status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update insight status'
        });
    }
});
router.post('/:insightId/click', auth, requirePermission('read:insights'), async (req, res) => {
    try {
        const { insightId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(insightId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid insight ID format'
            });
        }
        const insight = await BusinessInsight_1.default.findById(insightId);
        if (!insight) {
            return res.status(404).json({
                success: false,
                error: 'Insight not found'
            });
        }
        await insight.recordClick();
        res.json({
            success: true,
            message: 'Click recorded successfully'
        });
    }
    catch (error) {
        console.error('Error recording insight click:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to record click'
        });
    }
});
router.get('/business/:businessId/metrics', auth, requirePermission('read:insights'), async (req, res) => {
    try {
        const { businessId } = req.params;
        const { days = 30 } = req.query;
        if (!mongoose_1.default.Types.ObjectId.isValid(businessId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid business ID format'
            });
        }
        const metrics = await smartInsightsService.getInsightMetrics(businessId, parseInt(days));
        const digestMetrics = await InsightDigest_1.default.getEngagementMetrics(businessId, parseInt(days));
        const insightsByType = await BusinessInsight_1.default.aggregate([
            {
                $match: {
                    business_id: new mongoose_1.default.Types.ObjectId(businessId),
                    generated_at: { $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    avg_confidence: { $avg: '$confidence_score' },
                    completed_count: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
                }
            }
        ]);
        res.json({
            success: true,
            data: {
                period_days: parseInt(days),
                insight_metrics: metrics[0] || {
                    total_events: 0,
                    avg_confidence: 0,
                    total_estimated_value: 0,
                    insights_acted_upon: 0
                },
                engagement_metrics: digestMetrics[0] || {
                    total_sent: 0,
                    open_rate: 0,
                    click_rate: 0,
                    avg_engagement_score: 0
                },
                insights_by_type: insightsByType,
                generated_at: new Date()
            }
        });
    }
    catch (error) {
        console.error('Error fetching insight metrics:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch insight metrics'
        });
    }
});
router.get('/dashboard', auth, requirePermission('manage:insights'), async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
        const overallStats = await BusinessInsight_1.default.aggregate([
            { $match: { generated_at: { $gte: startDate } } },
            {
                $group: {
                    _id: null,
                    total_insights: { $sum: 1 },
                    high_impact_insights: { $sum: { $cond: [{ $eq: ['$impact', 'high'] }, 1, 0] } },
                    completed_insights: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    avg_confidence: { $avg: '$confidence_score' },
                    total_potential_value: {
                        $sum: {
                            $add: [
                                { $ifNull: ['$estimated_revenue_impact', 0] },
                                { $ifNull: ['$estimated_savings', 0] }
                            ]
                        }
                    },
                    unique_businesses: { $addToSet: '$business_id' }
                }
            }
        ]);
        const insightsByType = await BusinessInsight_1.default.aggregate([
            { $match: { generated_at: { $gte: startDate } } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    high_impact_count: { $sum: { $cond: [{ $eq: ['$impact', 'high'] }, 1, 0] } },
                    completed_count: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    avg_confidence: { $avg: '$confidence_score' }
                }
            },
            { $sort: { count: -1 } }
        ]);
        const dailyTrend = await BusinessInsight_1.default.aggregate([
            { $match: { generated_at: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$generated_at' } },
                    insights_generated: { $sum: 1 },
                    high_impact_count: { $sum: { $cond: [{ $eq: ['$impact', 'high'] }, 1, 0] } }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        const topBusinesses = await BusinessInsight_1.default.aggregate([
            { $match: { generated_at: { $gte: startDate } } },
            {
                $group: {
                    _id: '$business_id',
                    total_insights: { $sum: 1 },
                    completed_insights: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    total_potential_value: {
                        $sum: {
                            $add: [
                                { $ifNull: ['$estimated_revenue_impact', 0] },
                                { $ifNull: ['$estimated_savings', 0] }
                            ]
                        }
                    }
                }
            },
            {
                $addFields: {
                    completion_rate: { $divide: ['$completed_insights', '$total_insights'] }
                }
            },
            { $sort: { completion_rate: -1 } },
            { $limit: 10 }
        ]);
        const populatedTopBusinesses = await Business_1.default.populate(topBusinesses, {
            path: '_id',
            select: 'name industry'
        });
        res.json({
            success: true,
            data: {
                period_days: parseInt(days),
                overview: {
                    total_insights: overallStats[0]?.total_insights || 0,
                    high_impact_insights: overallStats[0]?.high_impact_insights || 0,
                    completed_insights: overallStats[0]?.completed_insights || 0,
                    completion_rate: overallStats[0] ?
                        (overallStats[0].completed_insights / overallStats[0].total_insights) : 0,
                    avg_confidence: overallStats[0]?.avg_confidence || 0,
                    total_potential_value: overallStats[0]?.total_potential_value || 0,
                    businesses_with_insights: overallStats[0]?.unique_businesses?.length || 0
                },
                insights_by_type: insightsByType,
                daily_trend: dailyTrend,
                top_performing_businesses: populatedTopBusinesses,
                generated_at: new Date()
            }
        });
    }
    catch (error) {
        console.error('Error generating insights dashboard:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate insights dashboard'
        });
    }
});
router.get('/digests/pending', auth, requirePermission('manage:insights'), async (req, res) => {
    try {
        const pendingDigests = await InsightDigest_1.default.findPendingDigests(new Date());
        await InsightDigest_1.default.populate(pendingDigests, { path: 'business_id', select: 'name' });
        res.json({
            success: true,
            data: {
                pending_digests: pendingDigests,
                count: pendingDigests.length
            }
        });
    }
    catch (error) {
        console.error('Error fetching pending digests:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch pending digests'
        });
    }
});
router.post('/digests/:digestId/send', auth, requirePermission('manage:insights'), async (req, res) => {
    try {
        const { digestId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(digestId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid digest ID format'
            });
        }
        const digest = await InsightDigest_1.default.findById(digestId).populate('business_id', 'name');
        if (!digest) {
            return res.status(404).json({
                success: false,
                error: 'Digest not found'
            });
        }
        if (digest.sent) {
            return res.status(400).json({
                success: false,
                error: 'Digest has already been sent'
            });
        }
        await emailService.sendEmail({
            to: 'business@example.com',
            subject: `Your ${digest.digest_type} insights digest`,
            template: 'insight_digest',
            data: {
                business_name: digest.business_id.name,
                insights: digest.insights,
                digest_type: digest.digest_type
            }
        });
        await digest.markAsSent();
        res.json({
            success: true,
            message: 'Digest sent successfully',
            data: {
                digest_id: digestId,
                business_name: digest.business_id.name,
                insights_count: digest.insights.length,
                sent_at: digest.sent_at
            }
        });
    }
    catch (error) {
        console.error('Error sending digest:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send digest'
        });
    }
});
exports.default = router;
//# sourceMappingURL=insights.js.map