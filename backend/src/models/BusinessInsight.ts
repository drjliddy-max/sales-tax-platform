import mongoose, { Schema, Document, Model } from 'mongoose';
import { Insight, InsightType } from '../types/insights';

// Interface for instance methods
export interface IBusinessInsightMethods {
  markAsViewed(): Promise<this>;
  recordClick(): Promise<this>;
  checkIsExpired(): boolean;
}

// Interface for static methods
export interface IBusinessInsightModel extends Model<IBusinessInsight, {}, IBusinessInsightMethods> {
  findActiveInsights(businessId: string, limit?: number): Promise<IBusinessInsight[]>;
  findHighImpactInsights(businessId: string): Promise<IBusinessInsight[]>;
  getInsightMetrics(businessId: string, days?: number): Promise<any[]>;
}

export interface IBusinessInsight extends Document, IBusinessInsightMethods {
  business_id: mongoose.Types.ObjectId;
  type: InsightType;
  title: string;
  insight: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  estimated_revenue_impact?: number;
  estimated_savings?: number;
  actionable_steps: string[];
  confidence_score: number;
  generated_at: Date;
  expires_at?: Date;
  priority: number;
  status: 'active' | 'completed' | 'dismissed';
  user_feedback?: {
    rating: number;
    comment?: string;
    implemented: boolean;
    implementation_date?: Date;
  };
  analytics?: {
    views: number;
    clicks: number;
    time_spent_viewing: number;
    last_viewed: Date;
  };
}

const BusinessInsightSchema: Schema = new Schema({
  business_id: { 
    type: Schema.Types.ObjectId, 
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

// Indexes for performance
BusinessInsightSchema.index({ business_id: 1, status: 1 });
BusinessInsightSchema.index({ business_id: 1, type: 1 });
BusinessInsightSchema.index({ business_id: 1, impact: 1, generated_at: -1 });
BusinessInsightSchema.index({ generated_at: -1 });
BusinessInsightSchema.index({ expires_at: 1 }); // For cleanup of expired insights

// Methods
BusinessInsightSchema.methods.markAsViewed = function() {
  this.analytics.views += 1;
  this.analytics.last_viewed = new Date();
  return this.save();
};

BusinessInsightSchema.methods.recordClick = function() {
  this.analytics.clicks += 1;
  return this.save();
};

BusinessInsightSchema.methods.checkIsExpired = function(): boolean {
  return this.expires_at && this.expires_at < new Date();
};

// Static methods
BusinessInsightSchema.statics.findActiveInsights = function(businessId: string, limit = 10) {
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

BusinessInsightSchema.statics.findHighImpactInsights = function(businessId: string) {
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

BusinessInsightSchema.statics.getInsightMetrics = function(businessId: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        business_id: new mongoose.Types.ObjectId(businessId),
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

// Pre-save middleware
BusinessInsightSchema.pre('save', function(next) {
  // Set expires_at for certain insight types if not already set
  if (!this.expires_at && ['seasonal_optimization', 'pricing_optimization'].includes(this.type)) {
    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 3); // 3 months for seasonal insights
    this.expires_at = expirationDate;
  }
  
  next();
});

export default mongoose.model<IBusinessInsight, IBusinessInsightModel>('BusinessInsight', BusinessInsightSchema);