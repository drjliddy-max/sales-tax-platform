import { Job, JobOptions } from 'bull';
interface JobData {
    type: string;
    payload: any;
    metadata?: {
        userId?: string;
        businessId?: string;
        priority?: 'low' | 'normal' | 'high' | 'critical';
        maxRetries?: number;
        createdAt?: Date;
    };
}
interface QueueMetrics {
    processed: number;
    failed: number;
    active: number;
    waiting: number;
    completed: number;
    paused: boolean;
}
type JobProcessor = (job: Job<JobData>) => Promise<any>;
export declare class JobQueueService {
    private static instance;
    private queues;
    private processors;
    private redisConnection;
    private isShuttingDown;
    static readonly QUEUES: {
        readonly TAX_CALCULATION: "tax-calculation";
        readonly TRANSACTION_PROCESSING: "transaction-processing";
        readonly POS_SYNC: "pos-sync";
        readonly TAX_RATE_UPDATE: "tax-rate-update";
        readonly COMPLIANCE_MONITORING: "compliance-monitoring";
        readonly AUDIT_PROCESSING: "audit-processing";
        readonly EMAIL_NOTIFICATIONS: "email-notifications";
        readonly REPORT_GENERATION: "report-generation";
    };
    private constructor();
    static getInstance(): JobQueueService;
    private initializeQueues;
    addJob(queueName: string, jobData: JobData, options?: JobOptions): Promise<Job<JobData>>;
    private getPriorityValue;
    registerProcessor(queueName: string, processor: JobProcessor): void;
    getQueueMetrics(queueName: string): Promise<QueueMetrics>;
    getAllQueueMetrics(): Promise<Record<string, QueueMetrics>>;
    pauseQueue(queueName: string): Promise<void>;
    resumeQueue(queueName: string): Promise<void>;
    drainQueue(queueName: string): Promise<void>;
    retryFailedJobs(queueName: string): Promise<number>;
    getJobDetails(queueName: string, jobId: string): Promise<any>;
    cleanOldJobs(queueName: string, maxAge?: number): Promise<void>;
    scheduleRecurringJob(queueName: string, jobData: JobData, cronPattern: string, options?: JobOptions): Promise<Job<JobData>>;
    removeRecurringJob(queueName: string, jobId: string): Promise<void>;
    shutdown(): Promise<void>;
    addTaxCalculationJob(data: {
        transactionId: string;
        businessId: string;
        recalculate?: boolean;
    }, priority?: 'low' | 'normal' | 'high'): Promise<Job<JobData>>;
    addTransactionProcessingJob(data: {
        transactionData: any;
        source: 'square' | 'shopify' | 'clover' | 'manual';
        businessId: string;
    }, priority?: 'low' | 'normal' | 'high'): Promise<Job<JobData>>;
    addPOSSyncJob(data: {
        integrationId: string;
        businessId: string;
        syncType: 'full' | 'incremental';
        lastSyncTime?: Date;
    }, priority?: 'low' | 'normal' | 'high'): Promise<Job<JobData>>;
    addTaxRateUpdateJob(data: {
        states?: string[];
        force?: boolean;
        source: 'scheduled' | 'manual' | 'emergency';
    }, priority?: 'low' | 'normal' | 'high' | 'critical'): Promise<Job<JobData>>;
    addComplianceMonitoringJob(data: {
        states: string[];
        checkType: 'routine' | 'deep' | 'emergency';
    }, priority?: 'low' | 'normal' | 'high'): Promise<Job<JobData>>;
    addAuditProcessingJob(data: {
        auditType: 'transaction' | 'tax-rate-change' | 'compliance-update';
        entityId: string;
        businessId?: string;
        changeData: any;
    }): Promise<Job<JobData>>;
    addEmailNotificationJob(data: {
        to: string[];
        subject: string;
        template: string;
        templateData: any;
        businessId?: string;
    }, priority?: 'low' | 'normal' | 'high'): Promise<Job<JobData>>;
    addReportGenerationJob(data: {
        reportType: 'tax-summary' | 'compliance-audit' | 'transaction-details';
        businessId: string;
        dateRange: {
            startDate: Date;
            endDate: Date;
        };
        format: 'pdf' | 'csv' | 'xlsx';
        requestedBy: string;
    }): Promise<Job<JobData>>;
    clearQueue(queueName: string): Promise<void>;
    getActiveJobs(queueName: string): Promise<Job<JobData>[]>;
    getFailedJobs(queueName: string): Promise<Job<JobData>[]>;
    getWaitingJobs(queueName: string): Promise<Job<JobData>[]>;
    getAvailableQueues(): string[];
    healthCheck(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        queues: Record<string, {
            status: string;
            metrics: QueueMetrics;
        }>;
        redis: any;
    }>;
}
export declare const jobQueue: JobQueueService;
export {};
//# sourceMappingURL=JobQueueService.d.ts.map