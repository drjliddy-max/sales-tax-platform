import mongoose from 'mongoose';
import { RevenueAnalyticsService } from './RevenueAnalyticsService';
export interface CohortData {
    cohort_month: string;
    cohort_size: number;
    initial_mrr: number;
    months: {
        [monthNumber: number]: {
            active_clients: number;
            period_mrr: number;
            retention_rate: number;
            revenue_retention_rate: number;
        };
    };
}
export interface ChurnMetrics {
    churn_by_month: Array<{
        churn_month: Date;
        churned_customers: number;
        mrr_lost: number;
        avg_customer_lifetime: number;
    }>;
    active_by_month: Array<{
        month: Date;
        active_customers: number;
    }>;
    overall_churn_rate: number;
}
export interface HealthScoreResult {
    health_score: number;
    churn_risk_score: number;
    upsell_score: number;
    factors: {
        payment_reliability: number;
        activity_level: number;
        tenure_months: number;
        pricing_fit: number;
        support_tickets: number;
    };
}
export interface ForecastResult {
    historical_data: Array<{
        month: Date;
        monthly_subscription_revenue: number;
        active_clients: number;
    }>;
    forecasts: Array<{
        month: string;
        predicted_mrr: number;
        predicted_arr: number;
        confidence_score: number;
    }>;
    trend: {
        slope: number;
        growth_rate: number;
    };
}
export interface TopClientHealth {
    client_name: string;
    email: string;
    tier_name: string;
    mrr: number;
    health_score: number;
    churn_risk_score: number;
    upsell_score: number;
    score_date: Date;
}
export declare class EnhancedAnalyticsService extends RevenueAnalyticsService {
    static getCohortAnalysis(months?: number): Promise<CohortData[]>;
    private static formatCohortData;
    private static getMonthDifference;
    static calculateChurnMetrics(startDate: Date, endDate: Date): Promise<ChurnMetrics>;
    private static calculateOverallChurnRate;
    static calculateClientHealthScore(clientId: mongoose.Types.ObjectId): Promise<HealthScoreResult>;
    private static computeHealthScore;
    private static calculateUpsellPotential;
    static generateRevenueForecast(months?: number): Promise<ForecastResult>;
    private static computeForecast;
    static getTopClientsHealthScores(limit?: number): Promise<TopClientHealth[]>;
    static getAdvancedDashboardData(startDate: Date, endDate: Date): Promise<{
        cohort_analysis: CohortData[];
        churn_metrics: ChurnMetrics;
        top_clients_health: TopClientHealth[];
        revenue_forecast: ForecastResult;
        generated_at: string;
    }>;
}
//# sourceMappingURL=EnhancedAnalyticsService.d.ts.map