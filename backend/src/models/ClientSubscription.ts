import mongoose, { Document, Schema } from 'mongoose';

export interface IClientSubscription extends Document {
  clientId: mongoose.Types.ObjectId;
  tierId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  billingCycle: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'suspended';
  mrr?: number; // Monthly Recurring Revenue
  arr?: number; // Annual Recurring Revenue
  createdAt: Date;
  updatedAt: Date;
}

const ClientSubscriptionSchema: Schema = new Schema({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  tierId: {
    type: Schema.Types.ObjectId,
    ref: 'ClientTier',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual']
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'cancelled', 'suspended']
  },
  mrr: {
    type: Number,
    min: 0
  },
  arr: {
    type: Number,
    min: 0
  }
}, {
  timestamps: true
});

// Index for performance
ClientSubscriptionSchema.index({ clientId: 1 });
ClientSubscriptionSchema.index({ tierId: 1 });
ClientSubscriptionSchema.index({ status: 1 });

export const ClientSubscription = mongoose.model<IClientSubscription>('ClientSubscription', ClientSubscriptionSchema);