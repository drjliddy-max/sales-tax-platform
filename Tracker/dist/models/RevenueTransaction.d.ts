import mongoose, { Document } from 'mongoose';
export interface IRevenueTransaction extends Document {
    clientId: mongoose.Types.ObjectId;
    revenueStreamId: mongoose.Types.ObjectId;
    subscriptionId?: mongoose.Types.ObjectId;
    transactionDate: Date;
    amount: number;
    currency: string;
    taxAmount: number;
    netAmount: number;
    billingPeriodStart?: Date;
    billingPeriodEnd?: Date;
    paymentMethod?: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    description?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RevenueTransaction: mongoose.Model<IRevenueTransaction, {}, {}, {}, mongoose.Document<unknown, {}, IRevenueTransaction> & IRevenueTransaction & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=RevenueTransaction.d.ts.map