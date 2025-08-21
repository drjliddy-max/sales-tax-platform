import mongoose, { Document } from 'mongoose';
export interface IRevenueStream extends Document {
    name: string;
    category: 'subscription' | 'transaction' | 'onetime' | 'service';
    description?: string;
    isRecurring: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RevenueStream: mongoose.Model<IRevenueStream, {}, {}, {}, mongoose.Document<unknown, {}, IRevenueStream> & IRevenueStream & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=RevenueStream.d.ts.map