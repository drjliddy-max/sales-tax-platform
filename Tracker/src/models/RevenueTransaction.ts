import mongoose, { Document, Schema } from 'mongoose';

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

const RevenueTransactionSchema: Schema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  revenueStreamId: {
    type: Schema.Types.ObjectId,
    ref: 'RevenueStream',
    required: true
  },
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'ClientSubscription'
  },
  transactionDate: {
    type: Date,
    default: Date.now
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    maxlength: 3
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },
  billingPeriodStart: {
    type: Date
  },
  billingPeriodEnd: {
    type: Date
  },
  paymentMethod: {
    type: String,
    maxlength: 50
  },
  status: {
    type: String,
    default: 'completed',
    enum: ['pending', 'completed', 'failed', 'refunded']
  },
  description: {
    type: String
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for performance
RevenueTransactionSchema.index({ clientId: 1 });
RevenueTransactionSchema.index({ transactionDate: -1 });
RevenueTransactionSchema.index({ revenueStreamId: 1 });
RevenueTransactionSchema.index({ status: 1 });
RevenueTransactionSchema.index({ subscriptionId: 1 });

export const RevenueTransaction = mongoose.model<IRevenueTransaction>('RevenueTransaction', RevenueTransactionSchema);