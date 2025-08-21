import mongoose, { Document } from 'mongoose';
export interface ITransaction extends Document {
    transactionId: string;
    source: 'square' | 'shopify' | 'clover' | 'toast' | 'manual';
    sourceTransactionId: string;
    businessId: string;
    locationId: string;
    timestamp: Date;
    subtotal: number;
    totalTax: number;
    grandTotal: number;
    currency: string;
    customer?: {
        id?: string;
        email?: string;
        taxExempt: boolean;
        exemptionCertificate?: string;
    };
    items: Array<{
        id: string;
        name: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        taxCategory: string;
        taxable: boolean;
    }>;
    taxBreakdown: Array<{
        jurisdiction: string;
        jurisdictionType: 'federal' | 'state' | 'county' | 'city' | 'special';
        rate: number;
        taxableAmount: number;
        taxAmount: number;
    }>;
    address: {
        street: string;
        city: string;
        state: string;
        zipCode: string;
        country: string;
    };
    refundedAmount?: number;
    status: 'completed' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<ITransaction, {}, {}, {}, mongoose.Document<unknown, {}, ITransaction> & ITransaction & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
//# sourceMappingURL=Transaction.d.ts.map