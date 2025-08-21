import mongoose, { Document } from 'mongoose';
export interface IClientTier extends Document {
    name: string;
    monthlyPrice?: number;
    annualPrice?: number;
    transactionLimit?: number;
    features: Record<string, any>;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ClientTier: mongoose.Model<IClientTier, {}, {}, {}, mongoose.Document<unknown, {}, IClientTier> & IClientTier & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ClientTier.d.ts.map