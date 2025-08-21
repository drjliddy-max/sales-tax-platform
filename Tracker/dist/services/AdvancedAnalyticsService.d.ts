import mongoose from 'mongoose';
export interface CohortAnalysis {
    cohortMonth: string;
    cohortSize: number;
    retentionRates: number[];
    currentRetention: number;
}
export interface HealthScoreDistribution {
    healthy: number;
    warning: number;
    critical: number;
}
export interface ChurnAnalysis {
    totalChurned: number;
    churnRate: number;
    avgDaysToChurn: number;
    topChurnReasons: Array<{
        reason: string;
        count: number;
    }>;
    mrrLost: number;
}
export interface ForecastAccuracy {
    forecastType: string;
    accuracy: number;
    avgError: number;
}
export declare class AdvancedAnalyticsService {
    static logActivity(clientId: mongoose.Types.ObjectId, activityType: 'login' | 'transaction' | 'support_ticket' | 'feature_usage', activityData?: Record<string, any>): Promise<void>;
    static calculateClientHealthScore(clientId: mongoose.Types.ObjectId): Promise<number>;
    static getHealthScoreDistribution(): Promise<HealthScoreDistribution>;
    static getCohortAnalysis(): Promise<CohortAnalysis[]>;
    static getChurnAnalysis(startDate: Date, endDate: Date): Promise<ChurnAnalysis>;
    static createForecast(forecastType: 'monthly' | 'quarterly' | 'annual', predictedMrr: number, predictedArr: number, confidenceScore: number, modelVersion?: string): Promise<void>;
    static getForecastAccuracy(): Promise<ForecastAccuracy[]>;
    static initializeSampleData(): Promise<void>;
}
//# sourceMappingURL=AdvancedAnalyticsService.d.ts.map