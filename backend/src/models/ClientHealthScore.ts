import mongoose, { Document, Schema } from 'mongoose';

export interface IClientHealthScore extends Document {
  clientId: mongoose.Types.ObjectId;
  scoreDate: Date;
  healthScore: number; // 0 to 100
  churnRiskScore: number; // 0.00 to 1.00
  upsellScore: number; // 0.00 to 1.00
  factors: Record<string, any>;
  createdAt: Date;
}

const clientHealthScoreSchema = new Schema<IClientHealthScore>({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  scoreDate: {
    type: Date,
    required: true,
    index: true
  },
  healthScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  churnRiskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  upsellScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  factors: {
    type: Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient client health tracking
clientHealthScoreSchema.index({ clientId: 1, scoreDate: -1 });

export const ClientHealthScore = mongoose.model<IClientHealthScore>('ClientHealthScore', clientHealthScoreSchema);