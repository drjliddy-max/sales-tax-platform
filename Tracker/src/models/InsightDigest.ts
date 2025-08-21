import mongoose, { Schema, Document, Model } from 'mongoose';
import { Insight } from '../types/insights';

// Interface for instance methods
export interface IInsightDigestMethods {
  markAsSent(): Promise<this>;
  recordEmailOpened(): Promise<this>;
  recordEmailClicked(): Promise<this>;
  calculateEngagementScore(): void;
}

// Interface for static methods
export interface IInsightDigestModel extends Model<IInsightDigest, {}, IInsightDigestMethods> {
  findPendingDigests(sendDate?: Date): Promise<IInsightDigest[]>;
  getEngagementMetrics(businessId?: string, days?: number): Promise<any[]>;
}

export interface IInsightDigest extends Document, IInsightDigestMethods {
  business_id: mongoose.Types.ObjectId;
  digest_type: 'weekly' | 'monthly';
  insights: Insight[];
  generated_at: Date;
  scheduled_send_date: Date;
  sent: boolean;
  sent_at?: Date;
  email_opened?: boolean;
  email_clicked?: boolean;
  user_engagement_score?: number;
}

const InsightDigestSchema: Schema = new Schema({
  business_id: { 
    type: Schema.Types.ObjectId, 
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

// Indexes
InsightDigestSchema.index({ business_id: 1, digest_type: 1, generated_at: -1 });
InsightDigestSchema.index({ scheduled_send_date: 1, sent: 1 }); // For finding unsent digests
InsightDigestSchema.index({ generated_at: -1 });

// Methods
InsightDigestSchema.methods.markAsSent = function() {
  this.sent = true;
  this.sent_at = new Date();
  return this.save();
};

InsightDigestSchema.methods.recordEmailOpened = function() {
  this.email_opened = true;
  this.calculateEngagementScore();
  return this.save();
};

InsightDigestSchema.methods.recordEmailClicked = function() {
  this.email_clicked = true;
  this.calculateEngagementScore();
  return this.save();
};

InsightDigestSchema.methods.calculateEngagementScore = function() {
  let score = 0;
  
  if (this.email_opened) score += 0.5;
  if (this.email_clicked) score += 0.5;
  
  // Bonus for high-impact insights
  const highImpactCount = this.insights.filter((insight: any) => insight.impact === 'high').length;
  if (highImpactCount > 0) {
    score += (highImpactCount / this.insights.length) * 0.2;
  }
  
  this.user_engagement_score = Math.min(score, 1.0);
};

// Static methods
InsightDigestSchema.statics.findPendingDigests = function(sendDate?: Date) {
  const query: any = { sent: false };
  
  if (sendDate) {
    query.scheduled_send_date = { $lte: sendDate };
  }
  
  return this.find(query).populate('business_id', 'name');
};

InsightDigestSchema.statics.getEngagementMetrics = function(businessId?: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const matchStage: any = {
    generated_at: { $gte: startDate },
    sent: true
  };
  
  if (businessId) {
    matchStage.business_id = new mongoose.Types.ObjectId(businessId);
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

export default mongoose.model<IInsightDigest, IInsightDigestModel>('InsightDigest', InsightDigestSchema);