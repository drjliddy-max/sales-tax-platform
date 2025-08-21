import mongoose, { Document } from 'mongoose';
export interface IRevenueForecast extends Document {
    forecastDate: Date;
    forecastType: 'monthly' | 'quarterly' | 'annual';
    predictedMrr: number;
    predictedArr: number;
    confidenceScore: number;
    modelVersion: string;
    actualMrr?: number;
    actualArr?: number;
    createdAt: Date;
}
export declare const RevenueForecast: mongoose.Model<IRevenueForecast, {}, {}, {}, mongoose.Document<unknown, {}, IRevenueForecast> & IRevenueForecast & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=RevenueForecast.d.ts.map