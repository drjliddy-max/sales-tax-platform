import mongoose, { Document } from 'mongoose';
export interface IClientHealthScore extends Document {
    clientId: mongoose.Types.ObjectId;
    scoreDate: Date;
    healthScore: number;
    churnRiskScore: number;
    upsellScore: number;
    factors: Record<string, any>;
    createdAt: Date;
}
export declare const ClientHealthScore: mongoose.Model<IClientHealthScore, {}, {}, {}, mongoose.Document<unknown, {}, IClientHealthScore> & IClientHealthScore & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ClientHealthScore.d.ts.map