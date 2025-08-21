import mongoose, { Document, Schema } from 'mongoose';

export interface IRevenueStream extends Document {
  name: string;
  category: 'subscription' | 'transaction' | 'onetime' | 'service';
  description?: string;
  isRecurring: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RevenueStreamSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  category: {
    type: String,
    required: true,
    enum: ['subscription', 'transaction', 'onetime', 'service']
  },
  description: {
    type: String
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export const RevenueStream = mongoose.model<IRevenueStream>('RevenueStream', RevenueStreamSchema);