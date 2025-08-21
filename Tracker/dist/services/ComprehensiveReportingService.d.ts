export interface ExecutiveSummary {
    total_revenue: number;
    revenue_growth: number;
    current_mrr: any;
    mrr_growth: number;
    active_clients: number;
    client_growth: number;
    avg_deal_size: number;
    churn_rate: number;
    key_highlights: string[];
}
export interface KeyMetrics {
    revenue: any;
    subscriptions: any;
    customers: any;
    financial: any;
}
export interface ReportGenerationOptions {
    format?: 'json' | 'pdf' | 'excel';
    includeCharts?: boolean;
    template?: string;
    brandingEnabled?: boolean;
    compression?: boolean;
}
export interface FileResult {
    filePath: string;
    fileName: string;
}
export interface ScheduleConfig {
    name: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    delivery_method: 'email' | 'slack' | 'webhook';
    recipients: string[];
    filters?: Record<string, any>;
    start_date?: Date;
    created_by?: string;
}
export declare class ComprehensiveReportingService {
    private emailTransporter;
    private reportsDirectory;
    private advancedExportService;
    constructor();
    private ensureReportsDirectory;
    generateExecutiveReport(startDate: Date, endDate: Date, options?: ReportGenerationOptions): Promise<FileResult | {
        period: {
            startDate: string;
            endDate: string;
        };
        generated_at: string;
        executive_summary: ExecutiveSummary;
        key_metrics: KeyMetrics;
        revenue_analysis: {
            by_stream: import("./RevenueAnalyticsService").RevenueStreamAnalytics[];
            by_tier: import("./RevenueAnalyticsService").TierAnalytics[];
            growth_trends: {};
            seasonal_patterns: {};
        };
        client_analysis: {
            health_scores: import("./EnhancedAnalyticsService").TopClientHealth[];
            cohort_analysis: import("./EnhancedAnalyticsService").CohortData[];
            churn_analysis: import("./EnhancedAnalyticsService").ChurnMetrics;
        };
        forecasts: {
            revenue_forecast: import("./EnhancedAnalyticsService").ForecastResult;
            mrr_projection: {};
            customer_growth_forecast: {};
        };
        risks_opportunities: {
            risks: never[];
            opportunities: never[];
            recommendations: never[];
        };
    }>;
    getExecutiveSummary(startDate: Date, endDate: Date): Promise<ExecutiveSummary>;
    private getPreviousPeriodSummary;
    private calculateGrowthMetrics;
    private generateKeyHighlights;
    getKeyMetrics(startDate: Date, endDate: Date): Promise<KeyMetrics>;
    private getRevenueMetrics;
    private getSubscriptionMetrics;
    private getCustomerMetrics;
    private getFinancialMetrics;
    private getRevenueAnalysis;
    private getClientAnalysis;
    private getForecasts;
    private getRisksAndOpportunities;
    generateBoardReport(quarter: number, year: number): Promise<{
        quarter: number;
        year: number;
        period: {
            startDate: string;
            endDate: string;
        };
        executive_summary: {};
        financial_performance: {};
        operational_metrics: {};
        strategic_initiatives: {};
        market_analysis: {};
        future_outlook: {};
        appendices: {};
    }>;
    generateAdvancedPDFReport(reportData: any, template: string, options?: ReportGenerationOptions): Promise<FileResult>;
    generatePDFReport(reportData: any, template: string): Promise<FileResult>;
    private generateExecutivePDF;
    private generateBoardPDF;
    private generateOperationalPDF;
    private generateGenericPDF;
    generateAdvancedExcelReport(reportData: any, template: string, options?: ReportGenerationOptions): Promise<FileResult>;
    generateExcelReport(reportData: any, template: string): Promise<FileResult>;
    private createExecutiveExcelSheets;
    private createBoardExcelSheets;
    private createOperationalExcelSheets;
    scheduleReport(templateId: string, schedule: ScheduleConfig): Promise<import("mongoose").Document<unknown, {}, import("../models/ScheduledReport").IScheduledReport> & import("../models/ScheduledReport").IScheduledReport & {
        _id: import("mongoose").Types.ObjectId;
    }>;
    processScheduledReports(): Promise<void>;
    private generateAndDeliverReport;
    private deliverReportByEmail;
    private deliverReportToSlack;
    private deliverReportViaWebhook;
    private formatNumber;
    private formatCurrency;
    private calculateNextRunDate;
    private addTableToPDF;
    private generateEmailHTML;
    private setupEmailTransporter;
    private getReportDateRange;
    private logReportGeneration;
    private logReportError;
    private getGrowthTrends;
    private getSeasonalPatterns;
    private getMRRProjection;
    private getCustomerGrowthForecast;
    private identifyRisks;
    private identifyOpportunities;
    private generateRecommendations;
    private getBoardExecutiveSummary;
    private getFinancialPerformance;
    private getOperationalMetrics;
    private getStrategicInitiatives;
    private getMarketAnalysis;
    private getFutureOutlook;
    private getBoardAppendices;
    private getReportTitle;
    private buildPDFSections;
    private buildReportCharts;
    private buildExcelSheets;
    cleanupOldReports(maxAgeHours?: number): Promise<void>;
}
//# sourceMappingURL=ComprehensiveReportingService.d.ts.map