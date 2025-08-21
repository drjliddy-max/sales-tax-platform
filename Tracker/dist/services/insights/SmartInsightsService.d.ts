import { Insight, BusinessData, InsightType, RevenueDataPoint } from '../../types/insights';
interface DatabaseService {
    query(sql: string, params: any[]): Promise<{
        rows: any[];
    }>;
}
interface EmailService {
    sendEmail(notification: any): Promise<void>;
}
interface AnalyticsService {
    getBusinessAnalytics(businessId: string): Promise<any>;
    getRevenueHistory(businessId: string, months?: number): Promise<RevenueDataPoint[]>;
    calculateMetrics(businessId: string): Promise<any>;
}
export declare class InsightEngine {
    generateInsight(data: BusinessData, type: InsightType): Promise<Insight | null>;
    private generateSeasonalInsight;
    private generatePricingInsight;
    private generateRetentionInsight;
    private generateTaxInsight;
    private analyzeSeasonalPatterns;
    private analyzePricingOpportunities;
    private analyzeCustomerBehavior;
    private analyzeTaxBurden;
    private groupRevenueByMonth;
    private findPeakMonth;
    private getSeasonName;
    private calculateVariance;
    private getIndustryPricingMultiplier;
}
export declare class SmartInsightsService {
    private db;
    private analytics;
    private emailService;
    private insightEngine;
    constructor(db: DatabaseService, analytics: AnalyticsService, emailService: EmailService);
    generateAutomaticInsights(businessId: string): Promise<Insight[]>;
    private generateRevenueInsights;
    private generateTaxOptimizationInsights;
    private generateOperationalInsights;
    private generateGrowthInsights;
    private generateRiskInsights;
    deliverInsightsToUser(businessId: string, insights: Insight[]): Promise<void>;
    private sendGentleInsightNotification;
    private scheduleInsightDigest;
    private saveInsightsForBusiness;
    private updateDashboardInsights;
    private rankInsightsByValue;
    private getBusinessAnalyticsData;
    private getUserInsightPreferences;
    private getUserInfo;
    private calculateNextDigestDate;
    private analyzeExemptionOpportunities;
    private analyzePeakHours;
    private analyzeInventoryPatterns;
    private analyzeMarketExpansion;
    private calculateAuditRisk;
    getBusinessInsights(businessId: string, limit?: number): Promise<Insight[]>;
    markInsightAsViewed(insightId: string): Promise<void>;
    dismissInsight(insightId: string): Promise<void>;
    getInsightMetrics(businessId: string, days?: number): Promise<any>;
}
export {};
//# sourceMappingURL=SmartInsightsService.d.ts.map