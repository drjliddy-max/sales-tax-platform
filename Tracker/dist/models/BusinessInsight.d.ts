import mongoose, { Document, Model } from 'mongoose';
import { InsightType } from '../types/insights';
export interface IBusinessInsightMethods {
    markAsViewed(): Promise<this>;
    recordClick(): Promise<this>;
    checkIsExpired(): boolean;
}
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
declare const _default: IBusinessInsightModel;
export default _default;
//# sourceMappingURL=BusinessInsight.d.ts.map