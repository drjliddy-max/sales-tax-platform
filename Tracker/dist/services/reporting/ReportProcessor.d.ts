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
export declare class ReportProcessor {
    private reportingService;
    private basicReportingService;
    private isProcessing;
    private cronJob;
    private processedToday;
    private errorsToday;
    private lastProcessingTime;
    constructor();
    start(): void;
    stop(): void;
    processScheduledReports(): Promise<ProcessingStats>;
    processNow(): Promise<ProcessingStats>;
    getStatus(): ReportProcessorStatus;
    getDetailedStatus(): Promise<ReportProcessorStatus & {
        totalScheduledReports: number;
        dueReports: number;
        upcomingReports: any[];
    }>;
    processSpecificReport(reportId: string): Promise<ProcessingStats>;
    private getNextCheckTime;
    private updateScheduledReport;
    private calculateNextRunDate;
    private logReportError;
    private getTotalScheduledReportsCount;
    private getUpcomingReports;
}
export declare const reportProcessor: ReportProcessor;
//# sourceMappingURL=ReportProcessor.d.ts.map