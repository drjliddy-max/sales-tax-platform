import mongoose, { Document } from 'mongoose';
export interface IClientSubscription extends Document {
    clientId: mongoose.Types.ObjectId;
    tierId: mongoose.Types.ObjectId;
    startDate: Date;
    endDate?: Date;
    billingCycle: 'monthly' | 'annual';
    status: 'active' | 'cancelled' | 'suspended';
    mrr?: number;
    arr?: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ClientSubscription: mongoose.Model<IClientSubscription, {}, {}, {}, mongoose.Document<unknown, {}, IClientSubscription> & IClientSubscription & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ClientSubscription.d.ts.map