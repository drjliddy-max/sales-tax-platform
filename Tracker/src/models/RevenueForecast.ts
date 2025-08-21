import mongoose, { Document, Schema } from 'mongoose';

export interface IRevenueForecast extends Document {
  forecastDate: Date;
  forecastType: 'monthly' | 'quarterly' | 'annual';
  predictedMrr: number;
  predictedArr: number;
  confidenceScore: number; // 0.00 to 1.00
  modelVersion: string;
  actualMrr?: number;
  actualArr?: number;
  createdAt: Date;
}

const revenueForecastSchema = new Schema<IRevenueForecast>({
  forecastDate: {
    type: Date,
    required: true,
    index: true
  },
  forecastType: {
    type: String,
    required: true,
    enum: ['monthly', 'quarterly', 'annual'],
    index: true
  },
  predictedMrr: {
    type: Number,
    required: true
  },
  predictedArr: {
    type: Number,
    required: true
  },
  confidenceScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  modelVersion: {
    type: String,
    required: true
  },
  actualMrr: {
    type: Number,
    required: false
  },
  actualArr: {
    type: Number,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient forecast queries
revenueForecastSchema.index({ forecastDate: 1, forecastType: 1 });

export const RevenueForecast = mongoose.model<IRevenueForecast>('RevenueForecast', revenueForecastSchema);