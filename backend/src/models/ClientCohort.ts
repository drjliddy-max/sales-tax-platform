import mongoose, { Document, Schema } from 'mongoose';

export interface IClientCohort extends Document {
  clientId: mongoose.Types.ObjectId;
  cohortMonth: Date;
  cohortSize: number;
  createdAt: Date;
}

const clientCohortSchema = new Schema<IClientCohort>({
  clientId: {
    type: Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  cohortMonth: {
    type: Date,
    required: true,
    index: true
  },
  cohortSize: {
    type: Number,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Unique constraint to prevent duplicate cohort entries
clientCohortSchema.index({ clientId: 1, cohortMonth: 1 }, { unique: true });

export const ClientCohort = mongoose.model<IClientCohort>('ClientCohort', clientCohortSchema);