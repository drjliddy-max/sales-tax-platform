import mongoose from 'mongoose';
export interface MRRResult {
    totalMrr: number;
    activeSubscriptions: number;
}
export interface ARRResult {
    totalArr: number;
    activeSubscriptions: number;
}
export interface RevenueStreamAnalytics {
    name: string;
    category: string;
    transactionCount: number;
    totalRevenue: number;
    netRevenue: number;
}
export interface TierAnalytics {
    tierName: string;
    uniqueClients: number;
    transactionCount: number;
    totalRevenue: number;
    avgTransactionAmount: number;
}
export interface RevenueSummary {
    totalTransactions: number;
    totalRevenue: number;
    netRevenue: number;
    totalTax: number;
    avgTransactionAmount: number;
}
export interface RevenueGrowthRate {
    currentRevenue: number;
    previousRevenue: number;
    growthRate: number;
    growthAmount: number;
}
export declare class RevenueAnalyticsService {
    static calculateMRR(startDate?: Date, endDate?: Date, tierFilter?: mongoose.Types.ObjectId): Promise<MRRResult>;
    static calculateARR(startDate?: Date, endDate?: Date, tierFilter?: mongoose.Types.ObjectId): Promise<ARRResult>;
    static getRevenueByStream(startDate: Date, endDate: Date): Promise<RevenueStreamAnalytics[]>;
    static getRevenueByTier(startDate: Date, endDate: Date): Promise<TierAnalytics[]>;
    static getRevenueSummary(startDate: Date, endDate: Date): Promise<RevenueSummary>;
    static getRevenueGrowthRate(currentPeriodStart: Date, currentPeriodEnd: Date, previousPeriodStart: Date, previousPeriodEnd: Date): Promise<RevenueGrowthRate>;
    static getCustomerLifetimeValueByTier(): Promise<any[]>;
    static getChurnAnalysis(startDate: Date, endDate: Date): Promise<any>;
}
//# sourceMappingURL=RevenueAnalyticsService.d.ts.map