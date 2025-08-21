import mongoose from 'mongoose';
export interface ReportGenerationResult {
    success: boolean;
    reportId?: string;
    filePath?: string;
    error?: string;
    generationTimeMs: number;
}
export interface DashboardWidget {
    id: string;
    type: 'chart' | 'metric' | 'table' | 'kpi';
    title: string;
    data: any;
    config: Record<string, any>;
}
export declare class ReportingService {
    static createTemplate(templateData: {
        name: string;
        description?: string;
        category: 'executive' | 'operational' | 'financial' | 'custom';
        templateConfig: any;
        isDefault?: boolean;
        isPublic?: boolean;
    }, createdBy?: mongoose.Types.ObjectId): Promise<mongoose.Document<unknown, {}, import("../models/ReportTemplate").IReportTemplate> & import("../models/ReportTemplate").IReportTemplate & {
        _id: mongoose.Types.ObjectId;
    }>;
    static getTemplates(filters?: {
        category?: string;
        isPublic?: boolean;
        createdBy?: mongoose.Types.ObjectId;
    }): Promise<Omit<mongoose.Document<unknown, {}, import("../models/ReportTemplate").IReportTemplate> & import("../models/ReportTemplate").IReportTemplate & {
        _id: mongoose.Types.ObjectId;
    }, never>[]>;
    static generateReport(templateId: mongoose.Types.ObjectId, filters?: Record<string, any>, scheduledReportId?: mongoose.Types.ObjectId): Promise<ReportGenerationResult>;
    private static generateReportData;
    static scheduleReport(scheduleData: {
        templateId: mongoose.Types.ObjectId;
        name: string;
        frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
        deliveryMethod: 'email' | 'slack' | 'webhook';
        recipients: string[];
        filters?: Record<string, any>;
    }, createdBy?: mongoose.Types.ObjectId): Promise<mongoose.Document<unknown, {}, import("../models/ScheduledReport").IScheduledReport> & import("../models/ScheduledReport").IScheduledReport & {
        _id: mongoose.Types.ObjectId;
    }>;
    static getDueReports(): Promise<any[]>;
    static processScheduledReports(): Promise<void>;
    private static deliverReport;
    static createDashboard(dashboardData: {
        name: string;
        description?: string;
        layoutConfig: any;
        filters?: Record<string, any>;
        isDefault?: boolean;
        isShared?: boolean;
    }, createdBy?: mongoose.Types.ObjectId): Promise<mongoose.Document<unknown, {}, import("../models/CustomDashboard").ICustomDashboard> & import("../models/CustomDashboard").ICustomDashboard & {
        _id: mongoose.Types.ObjectId;
    }>;
    static getDashboardData(dashboardId: mongoose.Types.ObjectId, filters?: Record<string, any>): Promise<DashboardWidget[]>;
    private static getKPIData;
    private static getChartData;
    private static getTableData;
    static grantPermission(reportId: mongoose.Types.ObjectId, reportType: 'template' | 'dashboard', userId: mongoose.Types.ObjectId, permissionLevel: 'view' | 'edit' | 'admin', grantedBy?: mongoose.Types.ObjectId): Promise<mongoose.Document<unknown, {}, import("../models/ReportPermission").IReportPermission> & import("../models/ReportPermission").IReportPermission & {
        _id: mongoose.Types.ObjectId;
    }>;
    static checkPermission(reportId: mongoose.Types.ObjectId, reportType: 'template' | 'dashboard', userId: mongoose.Types.ObjectId, requiredLevel?: 'view' | 'edit' | 'admin'): Promise<boolean>;
    static initializeDefaultTemplates(): Promise<void>;
}
//# sourceMappingURL=ReportingService.d.ts.map