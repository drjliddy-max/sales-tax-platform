import mongoose, { Document, Schema } from 'mongoose';

export interface IChurnEvent extends Document {
  clientId: mongoose.Types.ObjectId;
  churnDate: Date;
  churnReason?: string;
  mrrLost: number;
  arrLost: number;
  daysAsCustomer: number;
  tierAtChurn: string;
  createdAt: Date;
}

const churnEventSchema = new Schema<IChurnEvent>({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  churnDate: {
    type: Date,
    required: true,
    index: true
  },
  churnReason: {
    type: String,
    required: false
  },
  mrrLost: {
    type: Number,
    required: true
  },
  arrLost: {
    type: Number,
    required: true
  },
  daysAsCustomer: {
    type: Number,
    required: true
  },
  tierAtChurn: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient churn analysis queries
churnEventSchema.index({ churnDate: -1 });

export const ChurnEvent = mongoose.model<IChurnEvent>('ChurnEvent', churnEventSchema);