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
const InsightDigestSchema = new mongoose_1.Schema({
    business_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        index: true
    },
    digest_type: {
        type: String,
        required: true,
        enum: ['weekly', 'monthly'],
        index: true
    },
    insights: [{
            type: { type: String, required: true },
            title: { type: String, required: true },
            insight: { type: String, required: true },
            impact: { type: String, enum: ['low', 'medium', 'high'], required: true },
            effort: { type: String, enum: ['low', 'medium', 'high'], required: true },
            estimated_revenue_impact: Number,
            estimated_savings: Number,
            actionable_steps: [String],
            confidence_score: { type: Number, min: 0, max: 1, required: true },
            priority: { type: Number, min: 1, max: 10, required: true }
        }],
    generated_at: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    scheduled_send_date: {
        type: Date,
        required: true,
        index: true
    },
    sent: {
        type: Boolean,
        required: true,
        default: false,
        index: true
    },
    sent_at: Date,
    email_opened: { type: Boolean, default: false },
    email_clicked: { type: Boolean, default: false },
    user_engagement_score: {
        type: Number,
        min: 0,
        max: 1
    }
}, {
    timestamps: true
});
InsightDigestSchema.index({ business_id: 1, digest_type: 1, generated_at: -1 });
InsightDigestSchema.index({ scheduled_send_date: 1, sent: 1 });
InsightDigestSchema.index({ generated_at: -1 });
InsightDigestSchema.methods.markAsSent = function () {
    this.sent = true;
    this.sent_at = new Date();
    return this.save();
};
InsightDigestSchema.methods.recordEmailOpened = function () {
    this.email_opened = true;
    this.calculateEngagementScore();
    return this.save();
};
InsightDigestSchema.methods.recordEmailClicked = function () {
    this.email_clicked = true;
    this.calculateEngagementScore();
    return this.save();
};
InsightDigestSchema.methods.calculateEngagementScore = function () {
    let score = 0;
    if (this.email_opened)
        score += 0.5;
    if (this.email_clicked)
        score += 0.5;
    const highImpactCount = this.insights.filter((insight) => insight.impact === 'high').length;
    if (highImpactCount > 0) {
        score += (highImpactCount / this.insights.length) * 0.2;
    }
    this.user_engagement_score = Math.min(score, 1.0);
};
InsightDigestSchema.statics.findPendingDigests = function (sendDate) {
    const query = { sent: false };
    if (sendDate) {
        query.scheduled_send_date = { $lte: sendDate };
    }
    return this.find(query).populate('business_id', 'name');
};
InsightDigestSchema.statics.getEngagementMetrics = function (businessId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const matchStage = {
        generated_at: { $gte: startDate },
        sent: true
    };
    if (businessId) {
        matchStage.business_id = new mongoose_1.default.Types.ObjectId(businessId);
    }
    return this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: businessId ? null : '$business_id',
                total_sent: { $sum: 1 },
                total_opened: { $sum: { $cond: ['$email_opened', 1, 0] } },
                total_clicked: { $sum: { $cond: ['$email_clicked', 1, 0] } },
                avg_engagement_score: { $avg: '$user_engagement_score' },
                insights_delivered: { $sum: { $size: '$insights' } }
            }
        },
        {
            $addFields: {
                open_rate: {
                    $cond: [
                        { $gt: ['$total_sent', 0] },
                        { $divide: ['$total_opened', '$total_sent'] },
                        0
                    ]
                },
                click_rate: {
                    $cond: [
                        { $gt: ['$total_sent', 0] },
                        { $divide: ['$total_clicked', '$total_sent'] },
                        0
                    ]
                }
            }
        }
    ]);
};
exports.default = mongoose_1.default.model('InsightDigest', InsightDigestSchema);
//# sourceMappingURL=InsightDigest.js.map