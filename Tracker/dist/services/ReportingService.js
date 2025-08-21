"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingService = void 0;
const ReportTemplate_1 = require("../models/ReportTemplate");
const ScheduledReport_1 = require("../models/ScheduledReport");
const ReportHistory_1 = require("../models/ReportHistory");
const CustomDashboard_1 = require("../models/CustomDashboard");
const ReportPermission_1 = require("../models/ReportPermission");
const RevenueAnalyticsService_1 = require("./RevenueAnalyticsService");
const EnhancedAnalyticsService_1 = require("./EnhancedAnalyticsService");
class ReportingService {
    static async createTemplate(templateData, createdBy) {
        try {
            const template = new ReportTemplate_1.ReportTemplate({
                ...templateData,
                createdBy
            });
            await template.save();
            return template;
        }
        catch (error) {
            console.error('Error creating report template:', error);
            throw error;
        }
    }
    static async getTemplates(filters = {}) {
        try {
            const query = {};
            if (filters.category)
                query.category = filters.category;
            if (filters.isPublic !== undefined)
                query.isPublic = filters.isPublic;
            if (filters.createdBy)
                query.createdBy = filters.createdBy;
            return await ReportTemplate_1.ReportTemplate.find(query)
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 });
        }
        catch (error) {
            console.error('Error fetching report templates:', error);
            throw error;
        }
    }
    static async generateReport(templateId, filters = {}, scheduledReportId) {
        const startTime = Date.now();
        try {
            const template = await ReportTemplate_1.ReportTemplate.findById(templateId);
            if (!template) {
                throw new Error('Template not found');
            }
            const reportData = await this.generateReportData(template, filters);
            const generationTimeMs = Date.now() - startTime;
            const history = new ReportHistory_1.ReportHistory({
                templateId,
                scheduledReportId,
                reportName: template.name,
                reportData,
                generationTimeMs,
                status: 'completed'
            });
            await history.save();
            return {
                success: true,
                reportId: history._id.toString(),
                generationTimeMs
            };
        }
        catch (error) {
            const generationTimeMs = Date.now() - startTime;
            const history = new ReportHistory_1.ReportHistory({
                templateId,
                scheduledReportId,
                reportName: 'Failed Report Generation',
                reportData: {},
                generationTimeMs,
                status: 'failed',
                errorMessage: error.message
            });
            await history.save();
            return {
                success: false,
                error: error.message,
                generationTimeMs
            };
        }
    }
    static async generateReportData(template, filters) {
        const config = template.templateConfig;
        const reportData = {
            template: template.name,
            category: template.category,
            generatedAt: new Date(),
            filters,
            sections: []
        };
        for (const metric of config.metrics || []) {
            let sectionData;
            switch (metric) {
                case 'mrr_arr':
                    sectionData = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateMRR();
                    break;
                case 'revenue_summary':
                    const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
                    sectionData = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueSummary(startDate, endDate);
                    break;
                case 'revenue_by_stream':
                    const streamStartDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                    const streamEndDate = filters.endDate ? new Date(filters.endDate) : new Date();
                    sectionData = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByStream(streamStartDate, streamEndDate);
                    break;
                case 'cohort_analysis':
                    sectionData = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getCohortAnalysis(12);
                    break;
                case 'churn_metrics':
                    const churnStartDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                    const churnEndDate = filters.endDate ? new Date(filters.endDate) : new Date();
                    sectionData = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.calculateChurnMetrics(churnStartDate, churnEndDate);
                    break;
                case 'revenue_forecast':
                    sectionData = await EnhancedAnalyticsService_1.EnhancedAnalyticsService.generateRevenueForecast(6);
                    break;
                default:
                    sectionData = { error: `Unknown metric: ${metric}` };
            }
            reportData.sections.push({
                metric,
                data: sectionData,
                chartType: config.chartTypes?.find((chart) => chart.includes(metric)) || 'table'
            });
        }
        return reportData;
    }
    static async scheduleReport(scheduleData, createdBy) {
        try {
            const scheduledReport = new ScheduledReport_1.ScheduledReport({
                ...scheduleData,
                createdBy
            });
            await scheduledReport.save();
            return scheduledReport;
        }
        catch (error) {
            console.error('Error scheduling report:', error);
            throw error;
        }
    }
    static async getDueReports() {
        try {
            return await ScheduledReport_1.ScheduledReport.find({
                isActive: true,
                nextRunDate: { $lte: new Date() }
            }).populate('templateId');
        }
        catch (error) {
            console.error('Error fetching due reports:', error);
            return [];
        }
    }
    static async processScheduledReports() {
        try {
            const dueReports = await this.getDueReports();
            for (const scheduledReport of dueReports) {
                console.log(`Processing scheduled report: ${scheduledReport.name}`);
                const result = await this.generateReport(scheduledReport.templateId._id, scheduledReport.filters || {}, scheduledReport._id);
                if (result.success) {
                    scheduledReport.lastRunDate = new Date();
                    scheduledReport.nextRunDate = scheduledReport.calculateNextRunDate();
                    await scheduledReport.save();
                    await this.deliverReport(scheduledReport, result.reportId);
                }
                else {
                    console.error('Failed to generate scheduled report', {
                        reportName: scheduledReport.name,
                        error: result.error
                    });
                }
            }
        }
        catch (error) {
            console.error('Error processing scheduled reports:', error);
        }
    }
    static async deliverReport(scheduledReport, reportId) {
        console.log('Delivering report', {
            reportId: reportId,
            deliveryMethod: scheduledReport.deliveryMethod,
            recipients: scheduledReport.recipients
        });
    }
    static async createDashboard(dashboardData, createdBy) {
        try {
            const dashboard = new CustomDashboard_1.CustomDashboard({
                ...dashboardData,
                createdBy
            });
            await dashboard.save();
            return dashboard;
        }
        catch (error) {
            console.error('Error creating custom dashboard:', error);
            throw error;
        }
    }
    static async getDashboardData(dashboardId, filters = {}) {
        try {
            const dashboard = await CustomDashboard_1.CustomDashboard.findById(dashboardId);
            if (!dashboard) {
                throw new Error('Dashboard not found');
            }
            const widgets = [];
            for (const widget of dashboard.layoutConfig.widgets) {
                let data;
                switch (widget.type) {
                    case 'kpi':
                        data = await this.getKPIData(widget.config.metric, filters);
                        break;
                    case 'chart':
                        data = await this.getChartData(widget.config.chartType, widget.config.metric, filters);
                        break;
                    case 'table':
                        data = await this.getTableData(widget.config.dataSource, filters);
                        break;
                    default:
                        data = {};
                }
                widgets.push({
                    id: widget.id,
                    type: widget.type,
                    title: widget.config.title || 'Widget',
                    data,
                    config: widget.config
                });
            }
            return widgets;
        }
        catch (error) {
            console.error('Error getting dashboard data:', error);
            throw error;
        }
    }
    static async getKPIData(metric, filters) {
        switch (metric) {
            case 'total_mrr':
                const mrr = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateMRR();
                return { value: mrr.totalMrr, label: 'Total MRR' };
            case 'active_clients':
                const clients = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateMRR();
                return { value: clients.activeSubscriptions, label: 'Active Clients' };
            default:
                return { value: 0, label: 'Unknown Metric' };
        }
    }
    static async getChartData(chartType, metric, filters) {
        const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
        switch (metric) {
            case 'revenue_by_stream':
                return await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByStream(startDate, endDate);
            case 'revenue_by_tier':
                return await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByTier(startDate, endDate);
            default:
                return [];
        }
    }
    static async getTableData(dataSource, filters) {
        switch (dataSource) {
            case 'top_clients':
                return await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getTopClientsHealthScores(10);
            default:
                return [];
        }
    }
    static async grantPermission(reportId, reportType, userId, permissionLevel, grantedBy) {
        try {
            const permission = new ReportPermission_1.ReportPermission({
                reportId,
                reportType,
                userId,
                permissionLevel,
                grantedBy
            });
            await permission.save();
            return permission;
        }
        catch (error) {
            console.error('Error granting permission:', error);
            throw error;
        }
    }
    static async checkPermission(reportId, reportType, userId, requiredLevel = 'view') {
        try {
            const permission = await ReportPermission_1.ReportPermission.findOne({
                reportId,
                reportType,
                userId
            });
            if (!permission)
                return false;
            const levels = ['view', 'edit', 'admin'];
            const userLevel = levels.indexOf(permission.permissionLevel);
            const requiredLevelIndex = levels.indexOf(requiredLevel);
            return userLevel >= requiredLevelIndex;
        }
        catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }
    static async initializeDefaultTemplates() {
        try {
            const existingTemplates = await ReportTemplate_1.ReportTemplate.countDocuments();
            if (existingTemplates > 0) {
                console.log('Default report templates already initialized');
                return;
            }
            const defaultTemplates = [
                {
                    name: 'Executive Summary',
                    description: 'High-level revenue and business metrics',
                    category: 'executive',
                    templateConfig: {
                        chartTypes: ['line', 'bar', 'kpi'],
                        metrics: ['mrr_arr', 'revenue_summary', 'churn_metrics'],
                        filters: { period: 'monthly' },
                        layout: { sections: 3, orientation: 'vertical' }
                    },
                    isDefault: true,
                    isPublic: true
                },
                {
                    name: 'Revenue Analysis',
                    description: 'Detailed revenue breakdown and forecasting',
                    category: 'financial',
                    templateConfig: {
                        chartTypes: ['line', 'pie', 'table'],
                        metrics: ['revenue_by_stream', 'revenue_forecast', 'cohort_analysis'],
                        filters: { period: 'quarterly' },
                        layout: { sections: 4, orientation: 'mixed' }
                    },
                    isDefault: true,
                    isPublic: true
                },
                {
                    name: 'Customer Health Report',
                    description: 'Client health scores and churn analysis',
                    category: 'operational',
                    templateConfig: {
                        chartTypes: ['bar', 'scatter', 'table'],
                        metrics: ['churn_metrics', 'cohort_analysis'],
                        filters: { period: 'monthly' },
                        layout: { sections: 2, orientation: 'horizontal' }
                    },
                    isDefault: true,
                    isPublic: true
                }
            ];
            await ReportTemplate_1.ReportTemplate.insertMany(defaultTemplates);
            console.log('Default report templates initialized successfully');
        }
        catch (error) {
            console.error('Error initializing default templates:', error);
            throw error;
        }
    }
}
exports.ReportingService = ReportingService;
//# sourceMappingURL=ReportingService.js.map