import cron from 'node-cron';
import mongoose from 'mongoose';
import { ComprehensiveReportingService } from '../ComprehensiveReportingService.js';
import { ReportingService } from '../ReportingService.js';
import { RevenueAnalyticsService } from '../RevenueAnalyticsService.js';
import { EnhancedAnalyticsService } from '../EnhancedAnalyticsService.js';

export interface ReportProcessorStatus {
  isRunning: boolean;
  isProcessing: boolean;
  lastCheck: string;
  nextCheck?: string;
  processedToday: number;
  errorsToday: number;
}

export interface ProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  processingTimeMs: number;
  errors: string[];
}

export class ReportProcessor {
  private reportingService: ComprehensiveReportingService;
  private basicReportingService: typeof ReportingService;
  private isProcessing: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  private processedToday: number = 0;
  private errorsToday: number = 0;
  private lastProcessingTime: Date | null = null;

  constructor() {
    this.reportingService = new ComprehensiveReportingService();
    this.basicReportingService = ReportingService;
  }

  /**
   * Start the scheduled report processor
   * Runs every 15 minutes to check for due reports
   */
  start(): void {
    if (this.cronJob) {
      console.warn('Report processor is already running');
      return;
    }

    // Run every 15 minutes to check for scheduled reports
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      if (!this.isProcessing) {
        await this.processScheduledReports();
      }
    }, {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'UTC'
    });

    // Reset daily counters at midnight
    cron.schedule('0 0 * * *', () => {
      this.processedToday = 0;
      this.errorsToday = 0;
      console.log('Report processor daily counters reset');
    });

    console.log('✅ Report processor started - checking every 15 minutes');
    console.log(`🕐 Next check: ${this.getNextCheckTime()}`);
  }

  /**
   * Stop the scheduled report processor
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('⏹️ Report processor stopped');
    }
  }

  /**
   * Process all due scheduled reports
   */
  async processScheduledReports(): Promise<ProcessingStats> {
    this.isProcessing = true;
    const startTime = Date.now();
    const stats: ProcessingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      processingTimeMs: 0,
      errors: []
    };

    try {
      console.log('🔄 Checking for scheduled reports...');
      this.lastProcessingTime = new Date();

      // Get due reports from both services
      const [comprehensiveReports, basicReports] = await Promise.all([
        this.reportingService.processScheduledReports(),
        this.basicReportingService.processScheduledReports()
      ]);

      // Process comprehensive reports (returns void, so we just track that it was called)
      stats.totalProcessed++;
      stats.successful++;
      this.processedToday++;

      // Get additional due reports for manual processing
      const dueReports = await this.basicReportingService.getDueReports();
      
      for (const report of dueReports) {
        try {
          console.log(`📊 Processing scheduled report: ${report.name}`);
          
          // Process the report
          const result = await this.basicReportingService.generateReport(
            report.templateId,
            report.filters || {},
            report._id
          );

          if (result.success) {
            stats.successful++;
            this.processedToday++;
            
            // Update the scheduled report's next run date
            await this.updateScheduledReport(report._id);
            
            console.log(`✅ Successfully processed report: ${report.name}`);
          } else {
            throw new Error(result.error || 'Unknown error during report generation');
          }
          
          stats.totalProcessed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to process report ${report.name}:`, errorMessage);
          
          stats.failed++;
          stats.errors.push(`${report.name}: ${errorMessage}`);
          this.errorsToday++;
          
          // Log the error to report history
          await this.logReportError(report._id, errorMessage);
        }
      }

      stats.processingTimeMs = Date.now() - startTime;

      if (stats.totalProcessed > 0) {
        console.log(`📈 Report processing completed:`, {
          total: stats.totalProcessed,
          successful: stats.successful,
          failed: stats.failed,
          processingTime: `${stats.processingTimeMs}ms`
        });
      } else {
        console.log('ℹ️ No scheduled reports due for processing');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('💥 Error in report processor:', errorMessage);
      
      stats.errors.push(`Processor error: ${errorMessage}`);
      stats.processingTimeMs = Date.now() - startTime;
      this.errorsToday++;
    } finally {
      this.isProcessing = false;
    }

    return stats;
  }

  /**
   * Manual trigger for immediate processing
   */
  async processNow(): Promise<ProcessingStats> {
    if (this.isProcessing) {
      throw new Error('Report processing already in progress. Please wait for current processing to complete.');
    }

    console.log('🚀 Manual report processing triggered');
    return await this.processScheduledReports();
  }

  /**
   * Get processor status and health information
   */
  getStatus(): ReportProcessorStatus {
    return {
      isRunning: this.cronJob !== null,
      isProcessing: this.isProcessing,
      lastCheck: this.lastProcessingTime?.toISOString() || 'Never',
      nextCheck: this.getNextCheckTime(),
      processedToday: this.processedToday,
      errorsToday: this.errorsToday
    };
  }

  /**
   * Get detailed processor statistics
   */
  async getDetailedStatus(): Promise<ReportProcessorStatus & {
    totalScheduledReports: number;
    dueReports: number;
    upcomingReports: any[];
  }> {
    const basicStatus = this.getStatus();
    
    try {
      const [dueReports, upcomingReports] = await Promise.all([
        this.basicReportingService.getDueReports(),
        this.getUpcomingReports()
      ]);

      return {
        ...basicStatus,
        totalScheduledReports: await this.getTotalScheduledReportsCount(),
        dueReports: dueReports.length,
        upcomingReports
      };
    } catch (error) {
      console.error('Error getting detailed status:', error);
      return {
        ...basicStatus,
        totalScheduledReports: 0,
        dueReports: 0,
        upcomingReports: []
      };
    }
  }

  /**
   * Force process a specific scheduled report by ID
   */
  async processSpecificReport(reportId: string): Promise<ProcessingStats> {
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      throw new Error('Invalid report ID format');
    }

    const stats: ProcessingStats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      processingTimeMs: 0,
      errors: []
    };

    const startTime = Date.now();

    try {
      const ScheduledReport = (await import('../../models/ScheduledReport')).ScheduledReport;
      const report = await ScheduledReport.findById(reportId).populate('templateId');
      
      if (!report) {
        throw new Error('Scheduled report not found');
      }

      console.log(`🎯 Force processing report: ${report.name}`);

      const result = await this.basicReportingService.generateReport(
        report.templateId._id,
        report.filters || {},
        report._id
      );

      if (result.success) {
        stats.successful = 1;
        await this.updateScheduledReport(report._id);
        console.log(`✅ Successfully force-processed report: ${report.name}`);
      } else {
        throw new Error(result.error || 'Unknown error during report generation');
      }

      stats.totalProcessed = 1;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Failed to force-process report:`, errorMessage);
      
      stats.failed = 1;
      stats.errors.push(errorMessage);
      
      await this.logReportError(reportId, errorMessage);
    } finally {
      stats.processingTimeMs = Date.now() - startTime;
    }

    return stats;
  }

  /**
   * Private helper methods
   */
  private getNextCheckTime(): string {
    if (!this.cronJob) return 'Not scheduled';
    
    // Calculate next 15-minute interval
    const now = new Date();
    const next = new Date(now);
    const minutes = next.getMinutes();
    const nextQuarter = Math.ceil(minutes / 15) * 15;
    
    if (nextQuarter === 60) {
      next.setHours(next.getHours() + 1, 0, 0, 0);
    } else {
      next.setMinutes(nextQuarter, 0, 0);
    }
    
    return next.toISOString();
  }

  private async updateScheduledReport(reportId: string): Promise<void> {
    try {
      const ScheduledReport = (await import('../../models/ScheduledReport')).ScheduledReport;
      const report = await ScheduledReport.findById(reportId);
      
      if (report) {
        report.lastRunDate = new Date();
        report.nextRunDate = this.calculateNextRunDate(report.frequency);
        await report.save();
      }
    } catch (error) {
      console.error('Error updating scheduled report:', error);
    }
  }

  private calculateNextRunDate(frequency: string): Date {
    const next = new Date();
    
    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        break;
      default:
        next.setDate(next.getDate() + 1); // Default to daily
    }
    
    return next;
  }

  private async logReportError(reportId: string, errorMessage: string): Promise<void> {
    try {
      const ReportHistory = (await import('../../models/ReportHistory')).ReportHistory;
      
      const history = new ReportHistory({
        scheduledReportId: reportId,
        reportName: 'Failed Scheduled Report',
        reportData: {},
        generationTimeMs: 0,
        status: 'failed',
        errorMessage
      });
      
      await history.save();
    } catch (error) {
      console.error('Error logging report error:', error);
    }
  }

  private async getTotalScheduledReportsCount(): Promise<number> {
    try {
      const ScheduledReport = (await import('../../models/ScheduledReport')).ScheduledReport;
      return await ScheduledReport.countDocuments({ isActive: true });
    } catch (error) {
      console.error('Error getting scheduled reports count:', error);
      return 0;
    }
  }

  private async getUpcomingReports(): Promise<any[]> {
    try {
      const ScheduledReport = (await import('../../models/ScheduledReport')).ScheduledReport;
      return await ScheduledReport.find({ 
        isActive: true,
        nextRunDate: { $gt: new Date() }
      })
      .sort({ nextRunDate: 1 })
      .limit(5)
      .populate('templateId', 'name')
      .lean();
    } catch (error) {
      console.error('Error getting upcoming reports:', error);
      return [];
    }
  }
}

// Export singleton instance
export const reportProcessor = new ReportProcessor();