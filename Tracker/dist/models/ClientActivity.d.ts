import mongoose, { Document } from 'mongoose';
export interface IClientActivity extends Document {
    clientId: mongoose.Types.ObjectId;
    activityType: 'login' | 'transaction' | 'support_ticket' | 'feature_usage';
    activityData: Record<string, any>;
    activityDate: Date;
    createdAt: Date;
}
export declare const ClientActivity: mongoose.Model<IClientActivity, {}, {}, {}, mongoose.Document<unknown, {}, IClientActivity> & IClientActivity & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ClientActivity.d.ts.map