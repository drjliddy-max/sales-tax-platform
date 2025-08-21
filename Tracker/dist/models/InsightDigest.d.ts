import mongoose, { Document, Model } from 'mongoose';
import { Insight } from '../types/insights';
export interface IInsightDigestMethods {
    markAsSent(): Promise<this>;
    recordEmailOpened(): Promise<this>;
    recordEmailClicked(): Promise<this>;
    calculateEngagementScore(): void;
}
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
declare const _default: IInsightDigestModel;
export default _default;
//# sourceMappingURL=InsightDigest.d.ts.map