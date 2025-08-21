import mongoose from 'mongoose';
import { ReportTemplate } from '../models/ReportTemplate';
import { ScheduledReport } from '../models/ScheduledReport';
import { ReportHistory } from '../models/ReportHistory';
import { CustomDashboard } from '../models/CustomDashboard';
import { ReportPermission } from '../models/ReportPermission';
import { RevenueAnalyticsService } from './RevenueAnalyticsService';
import { EnhancedAnalyticsService } from './EnhancedAnalyticsService';

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

export class ReportingService {

  /**
   * Create a new report template
   */
  static async createTemplate(
    templateData: {
      name: string;
      description?: string;
      category: 'executive' | 'operational' | 'financial' | 'custom';
      templateConfig: any;
      isDefault?: boolean;
      isPublic?: boolean;
    },
    createdBy?: mongoose.Types.ObjectId
  ) {
    try {
      const template = new ReportTemplate({
        ...templateData,
        createdBy
      });
      
      await template.save();
      return template;
    } catch (error) {
      console.error('Error creating report template:', error);
      throw error;
    }
  }

  /**
   * Get all report templates with optional filtering
   */
  static async getTemplates(
    filters: {
      category?: string;
      isPublic?: boolean;
      createdBy?: mongoose.Types.ObjectId;
    } = {}
  ) {
    try {
      const query: any = {};
      
      if (filters.category) query.category = filters.category;
      if (filters.isPublic !== undefined) query.isPublic = filters.isPublic;
      if (filters.createdBy) query.createdBy = filters.createdBy;

      return await ReportTemplate.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
    } catch (error) {
      console.error('Error fetching report templates:', error);
      throw error;
    }
  }

  /**
   * Generate a report from a template
   */
  static async generateReport(
    templateId: mongoose.Types.ObjectId,
    filters: Record<string, any> = {},
    scheduledReportId?: mongoose.Types.ObjectId
  ): Promise<ReportGenerationResult> {
    const startTime = Date.now();
    
    try {
      const template = await ReportTemplate.findById(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Generate report data based on template configuration
      const reportData = await this.generateReportData(template, filters);
      
      const generationTimeMs = Date.now() - startTime;

      // Save to report history
      const history = new ReportHistory({
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
    } catch (error) {
      const generationTimeMs = Date.now() - startTime;
      
      // Save error to history
      const history = new ReportHistory({
        templateId,
        scheduledReportId,
        reportName: 'Failed Report Generation',
        reportData: {},
        generationTimeMs,
        status: 'failed',
        errorMessage: (error as Error).message
      });

      await history.save();

      return {
        success: false,
        error: (error as Error).message,
        generationTimeMs
      };
    }
  }

  /**
   * Generate report data based on template configuration
   */
  private static async generateReportData(
    template: any,
    filters: Record<string, any>
  ): Promise<any> {
    const config = template.templateConfig;
    const reportData: any = {
      template: template.name,
      category: template.category,
      generatedAt: new Date(),
      filters,
      sections: []
    };

    // Generate data based on metrics specified in template
    for (const metric of config.metrics || []) {
      let sectionData;

      switch (metric) {
        case 'mrr_arr':
          sectionData = await RevenueAnalyticsService.calculateMRR();
          break;
          
        case 'revenue_summary':
          const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
          sectionData = await RevenueAnalyticsService.getRevenueSummary(startDate, endDate);
          break;
          
        case 'revenue_by_stream':
          const streamStartDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const streamEndDate = filters.endDate ? new Date(filters.endDate) : new Date();
          sectionData = await RevenueAnalyticsService.getRevenueByStream(streamStartDate, streamEndDate);
          break;
          
        case 'cohort_analysis':
          sectionData = await EnhancedAnalyticsService.getCohortAnalysis(12);
          break;
          
        case 'churn_metrics':
          const churnStartDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          const churnEndDate = filters.endDate ? new Date(filters.endDate) : new Date();
          sectionData = await EnhancedAnalyticsService.calculateChurnMetrics(churnStartDate, churnEndDate);
          break;
          
        case 'revenue_forecast':
          sectionData = await EnhancedAnalyticsService.generateRevenueForecast(6);
          break;
          
        default:
          sectionData = { error: `Unknown metric: ${metric}` };
      }

      reportData.sections.push({
        metric,
        data: sectionData,
        chartType: config.chartTypes?.find((chart: string) => chart.includes(metric)) || 'table'
      });
    }

    return reportData;
  }

  /**
   * Schedule a report
   */
  static async scheduleReport(
    scheduleData: {
      templateId: mongoose.Types.ObjectId;
      name: string;
      frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      deliveryMethod: 'email' | 'slack' | 'webhook';
      recipients: string[];
      filters?: Record<string, any>;
    },
    createdBy?: mongoose.Types.ObjectId
  ) {
    try {
      const scheduledReport = new ScheduledReport({
        ...scheduleData,
        createdBy
      });

      await scheduledReport.save();
      return scheduledReport;
    } catch (error) {
      console.error('Error scheduling report:', error);
      throw error;
    }
  }

  /**
   * Get scheduled reports due for execution
   */
  static async getDueReports(): Promise<any[]> {
    try {
      return await ScheduledReport.find({
        isActive: true,
        nextRunDate: { $lte: new Date() }
      }).populate('templateId');
    } catch (error) {
      console.error('Error fetching due reports:', error);
      return [];
    }
  }

  /**
   * Process scheduled reports
   */
  static async processScheduledReports(): Promise<void> {
    try {
      const dueReports = await this.getDueReports();
      
      for (const scheduledReport of dueReports) {
        console.log(`Processing scheduled report: ${scheduledReport.name}`);
        
        const result = await this.generateReport(
          scheduledReport.templateId._id,
          scheduledReport.filters || {},
          scheduledReport._id
        );

        if (result.success) {
          // Update last run date and calculate next run
          scheduledReport.lastRunDate = new Date();
          scheduledReport.nextRunDate = scheduledReport.calculateNextRunDate();
          await scheduledReport.save();

          // Deliver the report (implement delivery logic here)
          await this.deliverReport(scheduledReport, result.reportId!);
        } else {
        console.error('Failed to generate scheduled report', {
          reportName: scheduledReport.name,
          error: result.error
        });
        }
      }
    } catch (error) {
      console.error('Error processing scheduled reports:', error);
    }
  }

  /**
   * Deliver a report (placeholder for delivery implementation)
   */
  private static async deliverReport(scheduledReport: any, reportId: string): Promise<void> {
        console.log('Delivering report', {
          reportId: reportId,
          deliveryMethod: scheduledReport.deliveryMethod,
          recipients: scheduledReport.recipients
        });
    
    // TODO: Implement actual delivery logic
    // - Email: Send report data as attachment or inline
    // - Slack: Post report summary with link
    // - Webhook: POST report data to specified URL
  }

  /**
   * Create custom dashboard
   */
  static async createDashboard(
    dashboardData: {
      name: string;
      description?: string;
      layoutConfig: any;
      filters?: Record<string, any>;
      isDefault?: boolean;
      isShared?: boolean;
    },
    createdBy?: mongoose.Types.ObjectId
  ) {
    try {
      const dashboard = new CustomDashboard({
        ...dashboardData,
        createdBy
      });

      await dashboard.save();
      return dashboard;
    } catch (error) {
      console.error('Error creating custom dashboard:', error);
      throw error;
    }
  }

  /**
   * Get dashboard data with widgets
   */
  static async getDashboardData(
    dashboardId: mongoose.Types.ObjectId,
    filters: Record<string, any> = {}
  ): Promise<DashboardWidget[]> {
    try {
      const dashboard = await CustomDashboard.findById(dashboardId);
      if (!dashboard) {
        throw new Error('Dashboard not found');
      }

      const widgets: DashboardWidget[] = [];

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
          type: widget.type as any,
          title: widget.config.title || 'Widget',
          data,
          config: widget.config
        });
      }

      return widgets;
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get KPI data for dashboard widgets
   */
  private static async getKPIData(metric: string, filters: Record<string, any>): Promise<any> {
    switch (metric) {
      case 'total_mrr':
        const mrr = await RevenueAnalyticsService.calculateMRR();
        return { value: mrr.totalMrr, label: 'Total MRR' };
        
      case 'active_clients':
        const clients = await RevenueAnalyticsService.calculateMRR();
        return { value: clients.activeSubscriptions, label: 'Active Clients' };
        
      default:
        return { value: 0, label: 'Unknown Metric' };
    }
  }

  /**
   * Get chart data for dashboard widgets
   */
  private static async getChartData(chartType: string, metric: string, filters: Record<string, any>): Promise<any> {
    const startDate = filters.startDate ? new Date(filters.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();

    switch (metric) {
      case 'revenue_by_stream':
        return await RevenueAnalyticsService.getRevenueByStream(startDate, endDate);
        
      case 'revenue_by_tier':
        return await RevenueAnalyticsService.getRevenueByTier(startDate, endDate);
        
      default:
        return [];
    }
  }

  /**
   * Get table data for dashboard widgets
   */
  private static async getTableData(dataSource: string, filters: Record<string, any>): Promise<any> {
    switch (dataSource) {
      case 'top_clients':
        return await EnhancedAnalyticsService.getTopClientsHealthScores(10);
        
      default:
        return [];
    }
  }

  /**
   * Grant permission to a report or dashboard
   */
  static async grantPermission(
    reportId: mongoose.Types.ObjectId,
    reportType: 'template' | 'dashboard',
    userId: mongoose.Types.ObjectId,
    permissionLevel: 'view' | 'edit' | 'admin',
    grantedBy?: mongoose.Types.ObjectId
  ) {
    try {
      const permission = new ReportPermission({
        reportId,
        reportType,
        userId,
        permissionLevel,
        grantedBy
      });

      await permission.save();
      return permission;
    } catch (error) {
      console.error('Error granting permission:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission for a report/dashboard
   */
  static async checkPermission(
    reportId: mongoose.Types.ObjectId,
    reportType: 'template' | 'dashboard',
    userId: mongoose.Types.ObjectId,
    requiredLevel: 'view' | 'edit' | 'admin' = 'view'
  ): Promise<boolean> {
    try {
      const permission = await ReportPermission.findOne({
        reportId,
        reportType,
        userId
      });

      if (!permission) return false;

      const levels = ['view', 'edit', 'admin'];
      const userLevel = levels.indexOf(permission.permissionLevel);
      const requiredLevelIndex = levels.indexOf(requiredLevel);

      return userLevel >= requiredLevelIndex;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Initialize default report templates
   */
  static async initializeDefaultTemplates(): Promise<void> {
    try {
      const existingTemplates = await ReportTemplate.countDocuments();
      if (existingTemplates > 0) {
        console.log('Default report templates already initialized');
        return;
      }

      const defaultTemplates = [
        {
          name: 'Executive Summary',
          description: 'High-level revenue and business metrics',
          category: 'executive' as const,
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
          category: 'financial' as const,
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
          category: 'operational' as const,
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

      await ReportTemplate.insertMany(defaultTemplates);
      console.log('Default report templates initialized successfully');
    } catch (error) {
      console.error('Error initializing default templates:', error);
      throw error;
    }
  }
}