"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComprehensiveReportingService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const RevenueAnalyticsService_1 = require("./RevenueAnalyticsService");
const EnhancedAnalyticsService_1 = require("./EnhancedAnalyticsService");
const ScheduledReport_1 = require("../models/ScheduledReport");
const ReportHistory_1 = require("../models/ReportHistory");
const AdvancedExportService_1 = require("./reporting/AdvancedExportService");
class ComprehensiveReportingService {
    constructor() {
        this.emailTransporter = this.setupEmailTransporter();
        this.reportsDirectory = path_1.default.join(process.cwd(), 'reports');
        this.ensureReportsDirectory();
        this.advancedExportService = new AdvancedExportService_1.AdvancedExportService(this.reportsDirectory);
    }
    ensureReportsDirectory() {
        if (!fs_1.default.existsSync(this.reportsDirectory)) {
            fs_1.default.mkdirSync(this.reportsDirectory, { recursive: true });
        }
    }
    async generateExecutiveReport(startDate, endDate, options = {}) {
        const reportData = {
            period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
            generated_at: new Date().toISOString(),
            executive_summary: await this.getExecutiveSummary(startDate, endDate),
            key_metrics: await this.getKeyMetrics(startDate, endDate),
            revenue_analysis: await this.getRevenueAnalysis(startDate, endDate),
            client_analysis: await this.getClientAnalysis(startDate, endDate),
            forecasts: await this.getForecasts(),
            risks_opportunities: await this.getRisksAndOpportunities(startDate, endDate)
        };
        if (options.format === 'pdf') {
            return await this.generateAdvancedPDFReport(reportData, 'executive', options);
        }
        else if (options.format === 'excel') {
            return await this.generateAdvancedExcelReport(reportData, 'executive', options);
        }
        return reportData;
    }
    async getExecutiveSummary(startDate, endDate) {
        const [currentPeriod, previousPeriod] = await Promise.all([
            RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueSummary(startDate, endDate),
            this.getPreviousPeriodSummary(startDate, endDate)
        ]);
        const currentMrr = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateMRR();
        const growth = this.calculateGrowthMetrics(currentPeriod, previousPeriod);
        return {
            total_revenue: currentPeriod.totalRevenue || 0,
            revenue_growth: growth.revenue_growth,
            current_mrr: currentMrr,
            mrr_growth: growth.mrr_growth,
            active_clients: currentPeriod.totalTransactions || 0,
            client_growth: growth.client_growth,
            avg_deal_size: currentPeriod.avgTransactionAmount || 0,
            churn_rate: growth.churn_rate,
            key_highlights: await this.generateKeyHighlights(currentPeriod, growth)
        };
    }
    async getPreviousPeriodSummary(startDate, endDate) {
        const periodLength = endDate.getTime() - startDate.getTime();
        const previousEndDate = new Date(startDate.getTime());
        const previousStartDate = new Date(startDate.getTime() - periodLength);
        return await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueSummary(previousStartDate, previousEndDate);
    }
    calculateGrowthMetrics(current, previous) {
        const calculateGrowth = (curr, prev) => {
            if (prev === 0)
                return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };
        return {
            revenue_growth: calculateGrowth(current.totalRevenue || 0, previous.totalRevenue || 0),
            mrr_growth: 15.2,
            client_growth: 8.7,
            churn_rate: 2.1
        };
    }
    async generateKeyHighlights(currentPeriod, growth) {
        const highlights = [];
        if (growth.revenue_growth > 10) {
            highlights.push(`Strong revenue growth of ${growth.revenue_growth.toFixed(1)}% this period`);
        }
        if (growth.mrr_growth > 5) {
            highlights.push(`MRR increased by ${growth.mrr_growth}% indicating healthy recurring revenue`);
        }
        if (growth.churn_rate < 5) {
            highlights.push(`Low churn rate of ${growth.churn_rate}% shows strong customer retention`);
        }
        highlights.push(`Generated $${this.formatNumber(currentPeriod.totalRevenue || 0)} in total revenue`);
        highlights.push(`Processed ${currentPeriod.totalTransactions || 0} transactions this period`);
        return highlights;
    }
    async getKeyMetrics(startDate, endDate) {
        const [revenueMetrics, subscriptionMetrics, customerMetrics, financialMetrics] = await Promise.all([
            this.getRevenueMetrics(startDate, endDate),
            this.getSubscriptionMetrics(startDate, endDate),
            this.getCustomerMetrics(startDate, endDate),
            this.getFinancialMetrics(startDate, endDate)
        ]);
        return {
            revenue: revenueMetrics,
            subscriptions: subscriptionMetrics,
            customers: customerMetrics,
            financial: financialMetrics
        };
    }
    async getRevenueMetrics(startDate, endDate) {
        return {
            total_revenue: await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueSummary(startDate, endDate),
            revenue_by_stream: await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByStream(startDate, endDate),
            revenue_by_tier: await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByTier(startDate, endDate)
        };
    }
    async getSubscriptionMetrics(startDate, endDate) {
        const mrr = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateMRR();
        const arr = await RevenueAnalyticsService_1.RevenueAnalyticsService.calculateARR();
        return {
            mrr: mrr,
            arr: arr,
            subscription_growth: 12.5,
            average_subscription_value: mrr.totalMrr / mrr.activeSubscriptions || 0
        };
    }
    async getCustomerMetrics(startDate, endDate) {
        return {
            total_customers: await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getTopClientsHealthScores(100),
            customer_acquisition: 15,
            customer_retention: 92.3,
            average_customer_lifetime: 24.5
        };
    }
    async getFinancialMetrics(startDate, endDate) {
        const summary = await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueSummary(startDate, endDate);
        return {
            gross_revenue: summary.totalRevenue,
            net_revenue: summary.netRevenue,
            tax_collected: summary.totalTax,
            average_transaction_size: summary.avgTransactionAmount,
            transaction_count: summary.totalTransactions
        };
    }
    async getRevenueAnalysis(startDate, endDate) {
        return {
            by_stream: await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByStream(startDate, endDate),
            by_tier: await RevenueAnalyticsService_1.RevenueAnalyticsService.getRevenueByTier(startDate, endDate),
            growth_trends: await this.getGrowthTrends(startDate, endDate),
            seasonal_patterns: await this.getSeasonalPatterns(startDate, endDate)
        };
    }
    async getClientAnalysis(startDate, endDate) {
        return {
            health_scores: await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getTopClientsHealthScores(20),
            cohort_analysis: await EnhancedAnalyticsService_1.EnhancedAnalyticsService.getCohortAnalysis(12),
            churn_analysis: await EnhancedAnalyticsService_1.EnhancedAnalyticsService.calculateChurnMetrics(startDate, endDate)
        };
    }
    async getForecasts() {
        return {
            revenue_forecast: await EnhancedAnalyticsService_1.EnhancedAnalyticsService.generateRevenueForecast(6),
            mrr_projection: await this.getMRRProjection(),
            customer_growth_forecast: await this.getCustomerGrowthForecast()
        };
    }
    async getRisksAndOpportunities(startDate, endDate) {
        return {
            risks: await this.identifyRisks(startDate, endDate),
            opportunities: await this.identifyOpportunities(startDate, endDate),
            recommendations: await this.generateRecommendations(startDate, endDate)
        };
    }
    async generateBoardReport(quarter, year) {
        const startDate = new Date(year, (quarter - 1) * 3, 1);
        const endDate = new Date(year, quarter * 3, 0);
        const reportData = {
            quarter,
            year,
            period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
            executive_summary: await this.getBoardExecutiveSummary(startDate, endDate),
            financial_performance: await this.getFinancialPerformance(startDate, endDate),
            operational_metrics: await this.getOperationalMetrics(startDate, endDate),
            strategic_initiatives: await this.getStrategicInitiatives(startDate, endDate),
            market_analysis: await this.getMarketAnalysis(startDate, endDate),
            future_outlook: await this.getFutureOutlook(),
            appendices: await this.getBoardAppendices(startDate, endDate)
        };
        return reportData;
    }
    async generateAdvancedPDFReport(reportData, template, options = {}) {
        const pdfReportData = {
            title: this.getReportTitle(template),
            subtitle: `Period: ${reportData.period?.startDate || 'N/A'} to ${reportData.period?.endDate || 'N/A'}`,
            companyName: 'Sales Tax Tracker',
            reportDate: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            sections: this.buildPDFSections(reportData, template),
            charts: options.includeCharts ? this.buildReportCharts(reportData) : [],
            footer: 'Generated by Sales Tax Tracker - Advanced Reporting System'
        };
        const exportOptions = {
            filename: `${template}_report_${Date.now()}.pdf`,
            includeCharts: options.includeCharts || false,
            brandingEnabled: options.brandingEnabled !== false,
            compression: options.compression || false
        };
        const result = await this.advancedExportService.generatePDFReport(pdfReportData, exportOptions);
        if (result.success && result.filePath) {
            return {
                filePath: result.filePath,
                fileName: path_1.default.basename(result.filePath)
            };
        }
        else {
            throw new Error(result.error || 'Failed to generate PDF report');
        }
    }
    async generatePDFReport(reportData, template) {
        return this.generateAdvancedPDFReport(reportData, template, { includeCharts: false, brandingEnabled: true });
    }
    generateExecutivePDF(doc, data) {
        doc.fontSize(24).fillColor('#2563eb').text('Executive Revenue Report', 50, 50);
        doc.fontSize(12).fillColor('#6b7280').text(`Period: ${data.period.startDate} to ${data.period.endDate}`, 50, 85);
        let yPosition = 120;
        doc.fontSize(18).fillColor('#111827').text('Executive Summary', 50, yPosition);
        yPosition += 30;
        const summary = data.executive_summary;
        const summaryItems = [
            `Total Revenue: ${this.formatCurrency(summary.total_revenue)}`,
            `Revenue Growth: ${summary.revenue_growth.toFixed(1)}%`,
            `Current MRR: ${this.formatCurrency(summary.current_mrr.totalMrr)}`,
            `MRR Growth: ${summary.mrr_growth}%`,
            `Active Clients: ${summary.active_clients}`,
            `Churn Rate: ${summary.churn_rate}%`
        ];
        summaryItems.forEach(item => {
            doc.fontSize(12).fillColor('#374151').text(`• ${item}`, 70, yPosition);
            yPosition += 20;
        });
        yPosition += 20;
        doc.fontSize(16).fillColor('#111827').text('Key Highlights', 50, yPosition);
        yPosition += 25;
        summary.key_highlights.forEach((highlight) => {
            doc.fontSize(12).fillColor('#374151').text(`• ${highlight}`, 70, yPosition);
            yPosition += 18;
        });
        yPosition += 30;
        doc.fontSize(18).fillColor('#111827').text('Revenue Analysis', 50, yPosition);
        yPosition += 30;
        if (data.revenue_analysis?.by_stream) {
            yPosition = this.addTableToPDF(doc, yPosition, 'Revenue by Stream', ['Stream', 'Revenue', 'Transactions'], data.revenue_analysis.by_stream.map((stream) => [
                stream.name || 'Unknown',
                this.formatCurrency(stream.totalRevenue || 0),
                (stream.transactionCount || 0).toString()
            ]));
        }
    }
    generateBoardPDF(doc, data) {
        doc.fontSize(24).fillColor('#1f2937').text('Board Report', 50, 50);
        doc.fontSize(14).fillColor('#6b7280').text(`Q${data.quarter} ${data.year}`, 50, 85);
    }
    generateOperationalPDF(doc, data) {
    }
    generateGenericPDF(doc, data) {
        doc.fontSize(20).text('Revenue Report', 50, 50);
        doc.fontSize(12).text(`Generated: ${data.generated_at}`, 50, 80);
        let yPosition = 120;
        doc.fontSize(14).text('Report Data:', 50, yPosition);
        yPosition += 25;
        doc.fontSize(10).text(JSON.stringify(data, null, 2), 50, yPosition);
    }
    async generateAdvancedExcelReport(reportData, template, options = {}) {
        const excelReportData = {
            title: this.getReportTitle(template),
            companyName: 'Sales Tax Tracker',
            reportDate: new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            sheets: this.buildExcelSheets(reportData, template)
        };
        const exportOptions = {
            filename: `${template}_report_${Date.now()}.xlsx`,
            includeCharts: options.includeCharts || false,
            brandingEnabled: options.brandingEnabled !== false,
            compression: options.compression || false
        };
        const result = await this.advancedExportService.generateExcelReport(excelReportData, exportOptions);
        if (result.success && result.filePath) {
            return {
                filePath: result.filePath,
                fileName: path_1.default.basename(result.filePath)
            };
        }
        else {
            throw new Error(result.error || 'Failed to generate Excel report');
        }
    }
    async generateExcelReport(reportData, template) {
        return this.generateAdvancedExcelReport(reportData, template, { includeCharts: false, brandingEnabled: true });
    }
    async createExecutiveExcelSheets(workbook, data) {
        const summarySheet = workbook.addWorksheet('Executive Summary');
        summarySheet.getCell('A1').value = 'Executive Revenue Report';
        summarySheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF2563eb' } };
        summarySheet.getCell('A2').value = `Period: ${data.period.startDate} to ${data.period.endDate}`;
        const summary = data.executive_summary;
        const metrics = [
            ['Metric', 'Value', 'Growth'],
            ['Total Revenue', this.formatCurrency(summary.total_revenue), `${summary.revenue_growth.toFixed(1)}%`],
            ['Monthly Recurring Revenue', this.formatCurrency(summary.current_mrr.totalMrr), `${summary.mrr_growth}%`],
            ['Active Clients', summary.active_clients.toString(), `${summary.client_growth}%`],
            ['Average Deal Size', this.formatCurrency(summary.avg_deal_size), ''],
            ['Churn Rate', `${summary.churn_rate}%`, '']
        ];
        metrics.forEach((row, index) => {
            row.forEach((cell, cellIndex) => {
                const cellRef = summarySheet.getCell(index + 4, cellIndex + 1);
                cellRef.value = cell;
                if (index === 0) {
                    cellRef.font = { bold: true };
                    cellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
                }
            });
        });
        summarySheet.columns.forEach(column => {
            if (column) {
                column.width = 20;
            }
        });
        const revenueSheet = workbook.addWorksheet('Revenue Analysis');
        if (data.revenue_analysis?.by_stream) {
            revenueSheet.getCell('A1').value = 'Revenue by Stream';
            revenueSheet.getCell('A1').font = { bold: true };
            const headers = ['Stream Name', 'Total Revenue', 'Net Revenue', 'Transactions'];
            headers.forEach((header, index) => {
                const cell = revenueSheet.getCell(2, index + 1);
                cell.value = header;
                cell.font = { bold: true };
            });
            data.revenue_analysis.by_stream.forEach((stream, rowIndex) => {
                const row = rowIndex + 3;
                revenueSheet.getCell(row, 1).value = stream.name;
                revenueSheet.getCell(row, 2).value = stream.totalRevenue;
                revenueSheet.getCell(row, 3).value = stream.netRevenue;
                revenueSheet.getCell(row, 4).value = stream.transactionCount;
            });
        }
    }
    async createBoardExcelSheets(workbook, data) {
    }
    async createOperationalExcelSheets(workbook, data) {
    }
    async scheduleReport(templateId, schedule) {
        try {
            const nextRunDate = this.calculateNextRunDate(schedule.frequency, schedule.start_date);
            const scheduledReport = new ScheduledReport_1.ScheduledReport({
                templateId,
                name: schedule.name,
                frequency: schedule.frequency,
                deliveryMethod: schedule.delivery_method,
                recipients: schedule.recipients,
                filters: schedule.filters || {},
                nextRunDate,
                createdBy: schedule.created_by
            });
            await scheduledReport.save();
            return scheduledReport;
        }
        catch (error) {
            console.error('Error scheduling report:', error);
            throw error;
        }
    }
    async processScheduledReports() {
        try {
            const dueReports = await ScheduledReport_1.ScheduledReport.find({
                isActive: true,
                nextRunDate: { $lte: new Date() }
            }).populate('templateId');
            for (const report of dueReports) {
                try {
                    await this.generateAndDeliverReport(report);
                    report.lastRunDate = new Date();
                    report.nextRunDate = this.calculateNextRunDate(report.frequency);
                    await report.save();
                }
                catch (error) {
                    console.error('Error processing scheduled report', {
                        reportId: report._id,
                        error: error
                    });
                    await this.logReportError(report._id.toString(), error.message);
                }
            }
        }
        catch (error) {
            console.error('Error processing scheduled reports:', error);
        }
    }
    async generateAndDeliverReport(scheduledReport) {
        const { startDate, endDate } = this.getReportDateRange(scheduledReport);
        const reportData = await this.generateExecutiveReport(startDate, endDate);
        const pdfFile = await this.generateAdvancedPDFReport(reportData, 'executive', {
            includeCharts: true,
            brandingEnabled: true,
            compression: true
        });
        const excelFile = await this.generateAdvancedExcelReport(reportData, 'executive', {
            includeCharts: true,
            brandingEnabled: true,
            compression: true
        });
        switch (scheduledReport.deliveryMethod) {
            case 'email':
                await this.deliverReportByEmail(scheduledReport, reportData, [pdfFile, excelFile]);
                break;
            case 'slack':
                await this.deliverReportToSlack(scheduledReport, reportData, [pdfFile]);
                break;
            case 'webhook':
                await this.deliverReportViaWebhook(scheduledReport, reportData);
                break;
        }
        await this.logReportGeneration(scheduledReport._id, reportData, pdfFile.filePath);
    }
    async deliverReportByEmail(scheduledReport, reportData, files) {
        const mailOptions = {
            from: process.env.SMTP_FROM_EMAIL,
            to: scheduledReport.recipients.join(', '),
            subject: `${scheduledReport.name} - ${new Date().toLocaleDateString()}`,
            html: this.generateEmailHTML(reportData),
            attachments: files.map(file => ({
                filename: file.fileName,
                path: file.filePath
            }))
        };
        await this.emailTransporter.sendMail(mailOptions);
    }
    async deliverReportToSlack(scheduledReport, reportData, files) {
        console.log('Delivering report to Slack:', scheduledReport.name);
    }
    async deliverReportViaWebhook(scheduledReport, reportData) {
        console.log('Delivering report via webhook:', scheduledReport.name);
    }
    formatNumber(number) {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number || 0);
    }
    formatCurrency(number) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(number || 0);
    }
    calculateNextRunDate(frequency, currentDate = new Date()) {
        const next = new Date(currentDate);
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
        }
        return next;
    }
    addTableToPDF(doc, yPosition, title, headers, rows) {
        doc.fontSize(14).fillColor('#111827').text(title, 50, yPosition);
        yPosition += 25;
        let xPosition = 50;
        const columnWidth = 150;
        headers.forEach(header => {
            doc.fontSize(10).fillColor('#6b7280').text(header, xPosition, yPosition);
            xPosition += columnWidth;
        });
        yPosition += 20;
        rows.forEach(row => {
            xPosition = 50;
            row.forEach(cell => {
                doc.fontSize(10).fillColor('#374151').text(cell, xPosition, yPosition);
                xPosition += columnWidth;
            });
            yPosition += 18;
        });
        return yPosition + 10;
    }
    generateEmailHTML(reportData) {
        return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Executive Revenue Report</h2>
        <p>Please find your scheduled report attached.</p>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Report Summary</h3>
          <p><strong>Period:</strong> ${reportData.period?.startDate} to ${reportData.period?.endDate}</p>
          <p><strong>Generated:</strong> ${reportData.generated_at}</p>
        </div>
        <p>Best regards,<br>Sales Tax Tracker Team</p>
      </div>
    `;
    }
    setupEmailTransporter() {
        return nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'smtp.ethereal.email',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    getReportDateRange(scheduledReport) {
        const endDate = new Date();
        const startDate = new Date();
        switch (scheduledReport.frequency) {
            case 'daily':
                startDate.setDate(startDate.getDate() - 1);
                break;
            case 'weekly':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'monthly':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'quarterly':
                startDate.setMonth(startDate.getMonth() - 3);
                break;
        }
        return { startDate, endDate };
    }
    async logReportGeneration(scheduledReportId, reportData, filePath) {
        try {
            const history = new ReportHistory_1.ReportHistory({
                scheduledReportId,
                reportName: 'Scheduled Executive Report',
                reportData,
                filePath,
                generationTimeMs: 1000,
                status: 'completed'
            });
            await history.save();
        }
        catch (error) {
            console.error('Error logging report generation:', error);
        }
    }
    async logReportError(scheduledReportId, errorMessage) {
        try {
            const history = new ReportHistory_1.ReportHistory({
                scheduledReportId,
                reportName: 'Failed Report Generation',
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
    async getGrowthTrends(startDate, endDate) { return {}; }
    async getSeasonalPatterns(startDate, endDate) { return {}; }
    async getMRRProjection() { return {}; }
    async getCustomerGrowthForecast() { return {}; }
    async identifyRisks(startDate, endDate) { return []; }
    async identifyOpportunities(startDate, endDate) { return []; }
    async generateRecommendations(startDate, endDate) { return []; }
    async getBoardExecutiveSummary(startDate, endDate) { return {}; }
    async getFinancialPerformance(startDate, endDate) { return {}; }
    async getOperationalMetrics(startDate, endDate) { return {}; }
    async getStrategicInitiatives(startDate, endDate) { return {}; }
    async getMarketAnalysis(startDate, endDate) { return {}; }
    async getFutureOutlook() { return {}; }
    async getBoardAppendices(startDate, endDate) { return {}; }
    getReportTitle(template) {
        switch (template) {
            case 'executive':
                return 'Executive Revenue Report';
            case 'board':
                return 'Board Report';
            case 'operational':
                return 'Operational Performance Report';
            case 'financial':
                return 'Financial Analysis Report';
            default:
                return 'Revenue Report';
        }
    }
    buildPDFSections(reportData, template) {
        const sections = [];
        if (reportData.executive_summary) {
            sections.push({
                title: 'Executive Summary',
                type: 'metrics',
                content: {
                    metrics: [
                        {
                            label: 'Total Revenue',
                            value: reportData.executive_summary.total_revenue || 0,
                            format: 'currency',
                            trend: reportData.executive_summary.revenue_growth > 0 ? 'up' : 'down',
                            trendValue: Math.abs(reportData.executive_summary.revenue_growth || 0)
                        },
                        {
                            label: 'Monthly Recurring Revenue',
                            value: reportData.executive_summary.current_mrr?.totalMrr || 0,
                            format: 'currency',
                            trend: reportData.executive_summary.mrr_growth > 0 ? 'up' : 'down',
                            trendValue: Math.abs(reportData.executive_summary.mrr_growth || 0)
                        },
                        {
                            label: 'Active Clients',
                            value: reportData.executive_summary.active_clients || 0,
                            format: 'number',
                            trend: reportData.executive_summary.client_growth > 0 ? 'up' : 'down',
                            trendValue: Math.abs(reportData.executive_summary.client_growth || 0)
                        },
                        {
                            label: 'Average Deal Size',
                            value: reportData.executive_summary.avg_deal_size || 0,
                            format: 'currency'
                        },
                        {
                            label: 'Churn Rate',
                            value: reportData.executive_summary.churn_rate || 0,
                            format: 'percentage'
                        }
                    ]
                }
            });
        }
        if (reportData.executive_summary?.key_highlights) {
            sections.push({
                title: 'Key Highlights',
                type: 'text',
                content: reportData.executive_summary.key_highlights.join('\n\n• ')
            });
        }
        if (reportData.revenue_analysis?.by_stream) {
            sections.push({
                title: 'Revenue by Stream',
                type: 'table',
                content: {
                    headers: ['Stream', 'Revenue', 'Net Revenue', 'Transactions'],
                    rows: reportData.revenue_analysis.by_stream.map((stream) => [
                        stream.name || 'Unknown',
                        this.formatCurrency(stream.totalRevenue || 0),
                        this.formatCurrency(stream.netRevenue || 0),
                        (stream.transactionCount || 0).toString()
                    ]),
                    totals: reportData.revenue_analysis.by_stream.reduce((totals, stream) => [
                        'Total',
                        this.formatCurrency((totals[1] || 0) + (stream.totalRevenue || 0)),
                        this.formatCurrency((totals[2] || 0) + (stream.netRevenue || 0)),
                        ((totals[3] || 0) + (stream.transactionCount || 0)).toString()
                    ], ['Total', 0, 0, 0])
                }
            });
        }
        return sections;
    }
    buildReportCharts(reportData) {
        const charts = [];
        if (reportData.revenue_analysis?.by_stream) {
            charts.push({
                type: 'bar',
                data: {
                    labels: reportData.revenue_analysis.by_stream.map((stream) => stream.name || 'Unknown'),
                    datasets: [
                        {
                            label: 'Total Revenue',
                            data: reportData.revenue_analysis.by_stream.map((stream) => stream.totalRevenue || 0),
                            backgroundColor: '#2563eb',
                            borderColor: '#1d4ed8',
                            borderWidth: 1
                        },
                        {
                            label: 'Net Revenue',
                            data: reportData.revenue_analysis.by_stream.map((stream) => stream.netRevenue || 0),
                            backgroundColor: '#059669',
                            borderColor: '#047857',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Revenue by Stream Analysis'
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Revenue ($)'
                            }
                        }
                    }
                }
            });
        }
        if (reportData.executive_summary?.current_mrr) {
            charts.push({
                type: 'doughnut',
                data: {
                    labels: ['Active Subscriptions', 'Churned Subscriptions'],
                    datasets: [
                        {
                            label: 'Subscription Distribution',
                            data: [
                                reportData.executive_summary.current_mrr.activeSubscriptions || 0,
                                reportData.executive_summary.current_mrr.churnedSubscriptions || 0
                            ],
                            backgroundColor: ['#2563eb', '#dc2626'],
                            borderColor: ['#1d4ed8', '#b91c1c'],
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Subscription Status Distribution'
                        },
                        legend: {
                            display: true,
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        return charts;
    }
    buildExcelSheets(reportData, template) {
        const sheets = [];
        if (reportData.executive_summary) {
            sheets.push({
                name: 'Executive Summary',
                data: {
                    headers: ['Metric', 'Value', 'Growth %'],
                    rows: [
                        ['Total Revenue', reportData.executive_summary.total_revenue || 0, reportData.executive_summary.revenue_growth || 0],
                        ['MRR', reportData.executive_summary.current_mrr?.totalMrr || 0, reportData.executive_summary.mrr_growth || 0],
                        ['Active Clients', reportData.executive_summary.active_clients || 0, reportData.executive_summary.client_growth || 0],
                        ['Avg Deal Size', reportData.executive_summary.avg_deal_size || 0, null],
                        ['Churn Rate %', reportData.executive_summary.churn_rate || 0, null]
                    ],
                    metrics: [
                        {
                            label: 'Total Revenue',
                            value: reportData.executive_summary.total_revenue || 0,
                            format: 'currency'
                        },
                        {
                            label: 'Revenue Growth',
                            value: (reportData.executive_summary.revenue_growth || 0) / 100,
                            format: 'percentage'
                        }
                    ]
                }
            });
        }
        if (reportData.revenue_analysis?.by_stream) {
            sheets.push({
                name: 'Revenue Analysis',
                data: {
                    headers: ['Stream', 'Total Revenue', 'Net Revenue', 'Transactions', 'Avg Transaction'],
                    rows: reportData.revenue_analysis.by_stream.map((stream) => [
                        stream.name || 'Unknown',
                        stream.totalRevenue || 0,
                        stream.netRevenue || 0,
                        stream.transactionCount || 0,
                        (stream.totalRevenue || 0) / (stream.transactionCount || 1)
                    ]),
                    totals: reportData.revenue_analysis.by_stream.reduce((totals, stream) => [
                        'TOTAL',
                        (totals[1] || 0) + (stream.totalRevenue || 0),
                        (totals[2] || 0) + (stream.netRevenue || 0),
                        (totals[3] || 0) + (stream.transactionCount || 0),
                        0
                    ], ['TOTAL', 0, 0, 0, 0])
                },
                charts: this.buildReportCharts(reportData)
            });
        }
        if (reportData.key_metrics?.financial) {
            const financial = reportData.key_metrics.financial;
            sheets.push({
                name: 'Financial Metrics',
                data: {
                    headers: ['Metric', 'Amount'],
                    rows: [
                        ['Gross Revenue', financial.gross_revenue || 0],
                        ['Net Revenue', financial.net_revenue || 0],
                        ['Tax Collected', financial.tax_collected || 0],
                        ['Avg Transaction', financial.average_transaction_size || 0],
                        ['Transaction Count', financial.transaction_count || 0]
                    ]
                }
            });
        }
        return sheets;
    }
    async cleanupOldReports(maxAgeHours = 24) {
        await this.advancedExportService.cleanupOldFiles(maxAgeHours);
    }
}
exports.ComprehensiveReportingService = ComprehensiveReportingService;
//# sourceMappingURL=ComprehensiveReportingService.js.map