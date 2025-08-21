"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportProcessor = exports.ReportProcessor = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const mongoose_1 = __importDefault(require("mongoose"));
const ComprehensiveReportingService_js_1 = require("../ComprehensiveReportingService.js");
const ReportingService_js_1 = require("../ReportingService.js");
class ReportProcessor {
    constructor() {
        this.isProcessing = false;
        this.cronJob = null;
        this.processedToday = 0;
        this.errorsToday = 0;
        this.lastProcessingTime = null;
        this.reportingService = new ComprehensiveReportingService_js_1.ComprehensiveReportingService();
        this.basicReportingService = ReportingService_js_1.ReportingService;
    }
    start() {
        if (this.cronJob) {
            console.warn('Report processor is already running');
            return;
        }
        this.cronJob = node_cron_1.default.schedule('*/15 * * * *', async () => {
            if (!this.isProcessing) {
                await this.processScheduledReports();
            }
        }, {
            scheduled: true,
            timezone: process.env.TIMEZONE || 'UTC'
        });
        node_cron_1.default.schedule('0 0 * * *', () => {
            this.processedToday = 0;
            this.errorsToday = 0;
            console.log('Report processor daily counters reset');
        });
        console.log('✅ Report processor started - checking every 15 minutes');
        console.log(`🕐 Next check: ${this.getNextCheckTime()}`);
    }
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('⏹️ Report processor stopped');
        }
    }
    async processScheduledReports() {
        this.isProcessing = true;
        const startTime = Date.now();
        const stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            processingTimeMs: 0,
            errors: []
        };
        try {
            console.log('🔄 Checking for scheduled reports...');
            this.lastProcessingTime = new Date();
            const [comprehensiveReports, basicReports] = await Promise.all([
                this.reportingService.processScheduledReports(),
                this.basicReportingService.processScheduledReports()
            ]);
            stats.totalProcessed++;
            stats.successful++;
            this.processedToday++;
            const dueReports = await this.basicReportingService.getDueReports();
            for (const report of dueReports) {
                try {
                    console.log(`📊 Processing scheduled report: ${report.name}`);
                    const result = await this.basicReportingService.generateReport(report.templateId, report.filters || {}, report._id);
                    if (result.success) {
                        stats.successful++;
                        this.processedToday++;
                        await this.updateScheduledReport(report._id);
                        console.log(`✅ Successfully processed report: ${report.name}`);
                    }
                    else {
                        throw new Error(result.error || 'Unknown error during report generation');
                    }
                    stats.totalProcessed++;
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`❌ Failed to process report ${report.name}:`, errorMessage);
                    stats.failed++;
                    stats.errors.push(`${report.name}: ${errorMessage}`);
                    this.errorsToday++;
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
            }
            else {
                console.log('ℹ️ No scheduled reports due for processing');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('💥 Error in report processor:', errorMessage);
            stats.errors.push(`Processor error: ${errorMessage}`);
            stats.processingTimeMs = Date.now() - startTime;
            this.errorsToday++;
        }
        finally {
            this.isProcessing = false;
        }
        return stats;
    }
    async processNow() {
        if (this.isProcessing) {
            throw new Error('Report processing already in progress. Please wait for current processing to complete.');
        }
        console.log('🚀 Manual report processing triggered');
        return await this.processScheduledReports();
    }
    getStatus() {
        return {
            isRunning: this.cronJob !== null,
            isProcessing: this.isProcessing,
            lastCheck: this.lastProcessingTime?.toISOString() || 'Never',
            nextCheck: this.getNextCheckTime(),
            processedToday: this.processedToday,
            errorsToday: this.errorsToday
        };
    }
    async getDetailedStatus() {
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
        }
        catch (error) {
            console.error('Error getting detailed status:', error);
            return {
                ...basicStatus,
                totalScheduledReports: 0,
                dueReports: 0,
                upcomingReports: []
            };
        }
    }
    async processSpecificReport(reportId) {
        if (!mongoose_1.default.Types.ObjectId.isValid(reportId)) {
            throw new Error('Invalid report ID format');
        }
        const stats = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            processingTimeMs: 0,
            errors: []
        };
        const startTime = Date.now();
        try {
            const ScheduledReport = (await Promise.resolve().then(() => __importStar(require('../../models/ScheduledReport')))).ScheduledReport;
            const report = await ScheduledReport.findById(reportId).populate('templateId');
            if (!report) {
                throw new Error('Scheduled report not found');
            }
            console.log(`🎯 Force processing report: ${report.name}`);
            const result = await this.basicReportingService.generateReport(report.templateId._id, report.filters || {}, report._id);
            if (result.success) {
                stats.successful = 1;
                await this.updateScheduledReport(report._id);
                console.log(`✅ Successfully force-processed report: ${report.name}`);
            }
            else {
                throw new Error(result.error || 'Unknown error during report generation');
            }
            stats.totalProcessed = 1;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`❌ Failed to force-process report:`, errorMessage);
            stats.failed = 1;
            stats.errors.push(errorMessage);
            await this.logReportError(reportId, errorMessage);
        }
        finally {
            stats.processingTimeMs = Date.now() - startTime;
        }
        return stats;
    }
    getNextCheckTime() {
        if (!this.cronJob)
            return 'Not scheduled';
        const now = new Date();
        const next = new Date(now);
        const minutes = next.getMinutes();
        const nextQuarter = Math.ceil(minutes / 15) * 15;
        if (nextQuarter === 60) {
            next.setHours(next.getHours() + 1, 0, 0, 0);
        }
        else {
            next.setMinutes(nextQuarter, 0, 0);
        }
        return next.toISOString();
    }
    async updateScheduledReport(reportId) {
        try {
            const ScheduledReport = (await Promise.resolve().then(() => __importStar(require('../../models/ScheduledReport')))).ScheduledReport;
            const report = await ScheduledReport.findById(reportId);
            if (report) {
                report.lastRunDate = new Date();
                report.nextRunDate = this.calculateNextRunDate(report.frequency);
                await report.save();
            }
        }
        catch (error) {
            console.error('Error updating scheduled report:', error);
        }
    }
    calculateNextRunDate(frequency) {
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
                next.setDate(next.getDate() + 1);
        }
        return next;
    }
    async logReportError(reportId, errorMessage) {
        try {
            const ReportHistory = (await Promise.resolve().then(() => __importStar(require('../../models/ReportHistory')))).ReportHistory;
            const history = new ReportHistory({
                scheduledReportId: reportId,
                reportName: 'Failed Scheduled Report',
                reportData: {},
                generationTimeMs: 0,
                status: 'failed',
                errorMessage
            });
            await history.save();
        }
        catch (error) {
            console.error('Error logging report error:', error);
        }
    }
    async getTotalScheduledReportsCount() {
        try {
            const ScheduledReport = (await Promise.resolve().then(() => __importStar(require('../../models/ScheduledReport')))).ScheduledReport;
            return await ScheduledReport.countDocuments({ isActive: true });
        }
        catch (error) {
            console.error('Error getting scheduled reports count:', error);
            return 0;
        }
    }
    async getUpcomingReports() {
        try {
            const ScheduledReport = (await Promise.resolve().then(() => __importStar(require('../../models/ScheduledReport')))).ScheduledReport;
            return await ScheduledReport.find({
                isActive: true,
                nextRunDate: { $gt: new Date() }
            })
                .sort({ nextRunDate: 1 })
                .limit(5)
                .populate('templateId', 'name')
                .lean();
        }
        catch (error) {
            console.error('Error getting upcoming reports:', error);
            return [];
        }
    }
}
exports.ReportProcessor = ReportProcessor;
exports.reportProcessor = new ReportProcessor();
//# sourceMappingURL=ReportProcessor.js.map