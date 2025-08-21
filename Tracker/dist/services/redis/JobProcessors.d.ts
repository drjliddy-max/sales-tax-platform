export declare class JobProcessors {
    private taxCalculator;
    private firecrawlService;
    private taxRateScheduler;
    private auditLogger;
    private jobQueue;
    constructor();
    private registerAllProcessors;
    private processTaxCalculationJob;
    private processTransactionJob;
    private processPOSSyncJob;
    private processTaxRateUpdateJob;
    private processComplianceMonitoringJob;
    private processAuditJob;
    private processEmailNotificationJob;
    private processReportGenerationJob;
    private normalizeTransactionData;
    private syncSquareTransactions;
    private generateTaxSummaryReport;
    private generateComplianceAuditReport;
    private generateTransactionDetailsReport;
    private groupTaxByJurisdiction;
    private formatReport;
    processHealthCheckJobs(): Promise<void>;
}
export declare const jobProcessors: JobProcessors;
//# sourceMappingURL=JobProcessors.d.ts.map