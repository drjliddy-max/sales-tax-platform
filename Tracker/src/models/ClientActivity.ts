import mongoose, { Document, Schema } from 'mongoose';

export interface IClientActivity extends Document {
  clientId: mongoose.Types.ObjectId;
  activityType: 'login' | 'transaction' | 'support_ticket' | 'feature_usage';
  activityData: Record<string, any>;
  activityDate: Date;
  createdAt: Date;
}

const clientActivitySchema = new Schema<IClientActivity>({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  activityType: {
    type: String,
    required: true,
    enum: ['login', 'transaction', 'support_ticket', 'feature_usage']
  },
  activityData: {
    type: Schema.Types.Mixed,
    default: {}
  },
  activityDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
clientActivitySchema.index({ clientId: 1, activityDate: -1 });

export const ClientActivity = mongoose.model<IClientActivity>('ClientActivity', clientActivitySchema);