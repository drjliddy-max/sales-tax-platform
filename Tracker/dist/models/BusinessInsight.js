"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const BusinessInsightSchema = new mongoose_1.Schema({
    business_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'seasonal_optimization',
            'pricing_optimization',
            'customer_retention',
            'tax_optimization',
            'exemption_opportunity',
            'peak_hour_optimization',
            'inventory_optimization',
            'nexus_threshold_warning',
            'audit_risk_mitigation',
            'compliance_improvement',
            'market_expansion',
            'cost_reduction',
            'automation_opportunity'
        ],
        index: true
    },
    title: { type: String, required: true },
    insight: { type: String, required: true },
    impact: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high'],
        index: true
    },
    effort: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high']
    },
    estimated_revenue_impact: { type: Number },
    estimated_savings: { type: Number },
    actionable_steps: [{ type: String, required: true }],
    confidence_score: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    generated_at: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    expires_at: { type: Date },
    priority: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    },
    status: {
        type: String,
        required: true,
        enum: ['active', 'completed', 'dismissed'],
        default: 'active',
        index: true
    },
    user_feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        implemented: { type: Boolean, default: false },
        implementation_date: Date
    },
    analytics: {
        views: { type: Number, default: 0 },
        clicks: { type: Number, default: 0 },
        time_spent_viewing: { type: Number, default: 0 },
        last_viewed: Date
    }
}, {
    timestamps: true
});
BusinessInsightSchema.index({ business_id: 1, status: 1 });
BusinessInsightSchema.index({ business_id: 1, type: 1 });
BusinessInsightSchema.index({ business_id: 1, impact: 1, generated_at: -1 });
BusinessInsightSchema.index({ generated_at: -1 });
BusinessInsightSchema.index({ expires_at: 1 });
BusinessInsightSchema.methods.markAsViewed = function () {
    this.analytics.views += 1;
    this.analytics.last_viewed = new Date();
    return this.save();
};
BusinessInsightSchema.methods.recordClick = function () {
    this.analytics.clicks += 1;
    return this.save();
};
BusinessInsightSchema.methods.checkIsExpired = function () {
    return this.expires_at && this.expires_at < new Date();
};
BusinessInsightSchema.statics.findActiveInsights = function (businessId, limit = 10) {
    return this.find({
        business_id: businessId,
        status: 'active',
        $or: [
            { expires_at: { $exists: false } },
            { expires_at: { $gt: new Date() } }
        ]
    })
        .sort({ impact: -1, priority: 1, generated_at: -1 })
        .limit(limit);
};
BusinessInsightSchema.statics.findHighImpactInsights = function (businessId) {
    return this.find({
        business_id: businessId,
        status: 'active',
        impact: 'high',
        $or: [
            { expires_at: { $exists: false } },
            { expires_at: { $gt: new Date() } }
        ]
    })
        .sort({ confidence_score: -1, priority: 1 });
};
BusinessInsightSchema.statics.getInsightMetrics = function (businessId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return this.aggregate([
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
                },
                total_estimated_value: {
                    $sum: {
                        $add: [
                            { $ifNull: ['$estimated_revenue_impact', 0] },
                            { $ifNull: ['$estimated_savings', 0] }
                        ]
                    }
                },
                total_views: { $sum: '$analytics.views' },
                total_clicks: { $sum: '$analytics.clicks' }
            }
        }
    ]);
};
BusinessInsightSchema.pre('save', function (next) {
    if (!this.expires_at && ['seasonal_optimization', 'pricing_optimization'].includes(this.type)) {
        const expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + 3);
        this.expires_at = expirationDate;
    }
    next();
});
exports.default = mongoose_1.default.model('BusinessInsight', BusinessInsightSchema);
//# sourceMappingURL=BusinessInsight.js.map