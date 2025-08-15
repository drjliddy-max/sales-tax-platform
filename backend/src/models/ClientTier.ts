import mongoose, { Document, Schema } from 'mongoose';

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

const ClientTierSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 50
  },
  monthlyPrice: {
    type: Number,
    min: 0
  },
  annualPrice: {
    type: Number,
    min: 0
  },
  transactionLimit: {
    type: Number,
    min: 0
  },
  features: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export const ClientTier = mongoose.model<IClientTier>('ClientTier', ClientTierSchema);