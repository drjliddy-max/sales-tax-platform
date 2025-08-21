"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobQueue = exports.JobQueueService = void 0;
const bull_1 = __importDefault(require("bull"));
const RedisConnectionService_1 = require("./RedisConnectionService");
const utils_1 = require("@/utils");
class JobQueueService {
    constructor() {
        this.queues = new Map();
        this.processors = new Map();
        this.isShuttingDown = false;
        this.redisConnection = RedisConnectionService_1.RedisConnectionService.getInstance();
        this.initializeQueues();
    }
    static getInstance() {
        if (!JobQueueService.instance) {
            JobQueueService.instance = new JobQueueService();
        }
        return JobQueueService.instance;
    }
    async initializeQueues() {
        try {
            const redisClient = await this.redisConnection.getClient();
            const redisConfig = {
                redis: {
                    host: redisClient.options.host,
                    port: redisClient.options.port,
                    password: redisClient.options.password,
                    db: redisClient.options.db
                },
                defaultJobOptions: {
                    removeOnComplete: 10,
                    removeOnFail: 50,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000
                    }
                }
            };
            for (const [queueKey, queueName] of Object.entries(JobQueueService.QUEUES)) {
                const queue = new bull_1.default(queueName, redisConfig);
                queue.on('error', (error) => {
                    utils_1.logger.error(`Queue ${queueName} error:`, error);
                });
                queue.on('stalled', (job) => {
                    utils_1.logger.warn(`Job stalled in queue ${queueName}:`, { jobId: job.id, data: job.data });
                });
                queue.on('failed', (job, error) => {
                    utils_1.logger.error(`Job failed in queue ${queueName}:`, {
                        jobId: job.id,
                        error: error.message,
                        data: job.data
                    });
                });
                queue.on('completed', (job, result) => {
                    utils_1.logger.info(`Job completed in queue ${queueName}:`, {
                        jobId: job.id,
                        processingTime: Date.now() - job.timestamp,
                        data: job.data.type
                    });
                });
                this.queues.set(queueName, queue);
                utils_1.logger.info(`Initialized queue: ${queueName}`);
            }
            utils_1.logger.info(`All ${this.queues.size} job queues initialized successfully`);
        }
        catch (error) {
            utils_1.logger.error('Failed to initialize job queues:', error);
            throw error;
        }
    }
    async addJob(queueName, jobData, options = {}) {
        try {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const jobOptions = {
                priority: this.getPriorityValue(jobData.metadata?.priority),
                attempts: jobData.metadata?.maxRetries || 3,
                ...options
            };
            const enrichedJobData = {
                ...jobData,
                metadata: {
                    createdAt: new Date(),
                    ...jobData.metadata
                }
            };
            const job = await queue.add(enrichedJobData, jobOptions);
            utils_1.logger.debug(`Job added to queue ${queueName}:`, {
                jobId: job.id,
                type: jobData.type,
                priority: jobData.metadata?.priority
            });
            return job;
        }
        catch (error) {
            utils_1.logger.error(`Error adding job to queue ${queueName}:`, error);
            throw error;
        }
    }
    getPriorityValue(priority) {
        switch (priority) {
            case 'critical': return 1;
            case 'high': return 2;
            case 'normal': return 3;
            case 'low': return 4;
            default: return 3;
        }
    }
    registerProcessor(queueName, processor) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        this.processors.set(queueName, processor);
        queue.process(async (job) => {
            utils_1.logger.info(`Processing job in queue ${queueName}:`, {
                jobId: job.id,
                type: job.data.type
            });
            try {
                const result = await processor(job);
                utils_1.logger.debug(`Job completed successfully:`, {
                    jobId: job.id,
                    queueName,
                    processingTime: Date.now() - job.timestamp
                });
                return result;
            }
            catch (error) {
                utils_1.logger.error(`Job processing failed:`, {
                    jobId: job.id,
                    queueName,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                throw error;
            }
        });
        utils_1.logger.info(`Registered processor for queue: ${queueName}`);
    }
    async getQueueMetrics(queueName) {
        try {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const [waiting, active, completed, failed] = await Promise.all([
                queue.getWaiting(),
                queue.getActive(),
                queue.getCompleted(),
                queue.getFailed()
            ]);
            return {
                processed: completed.length + failed.length,
                failed: failed.length,
                active: active.length,
                waiting: waiting.length,
                completed: completed.length,
                paused: await queue.isPaused()
            };
        }
        catch (error) {
            utils_1.logger.error(`Error getting metrics for queue ${queueName}:`, error);
            throw error;
        }
    }
    async getAllQueueMetrics() {
        const metrics = {};
        for (const queueName of this.queues.keys()) {
            try {
                metrics[queueName] = await this.getQueueMetrics(queueName);
            }
            catch (error) {
                utils_1.logger.error(`Error getting metrics for queue ${queueName}:`, error);
                metrics[queueName] = {
                    processed: 0,
                    failed: 0,
                    active: 0,
                    waiting: 0,
                    completed: 0,
                    paused: true
                };
            }
        }
        return metrics;
    }
    async pauseQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        await queue.pause();
        utils_1.logger.info(`Queue ${queueName} paused`);
    }
    async resumeQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        await queue.resume();
        utils_1.logger.info(`Queue ${queueName} resumed`);
    }
    async drainQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        await queue.empty();
        utils_1.logger.info(`Queue ${queueName} drained`);
    }
    async retryFailedJobs(queueName) {
        try {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const failedJobs = await queue.getFailed();
            let retriedCount = 0;
            for (const job of failedJobs) {
                try {
                    await job.retry();
                    retriedCount++;
                }
                catch (error) {
                    utils_1.logger.error(`Failed to retry job ${job.id}:`, error);
                }
            }
            utils_1.logger.info(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
            return retriedCount;
        }
        catch (error) {
            utils_1.logger.error(`Error retrying failed jobs in queue ${queueName}:`, error);
            throw error;
        }
    }
    async getJobDetails(queueName, jobId) {
        try {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const job = await queue.getJob(jobId);
            if (!job) {
                return null;
            }
            return {
                id: job.id,
                data: job.data,
                progress: job.progress(),
                state: await job.getState(),
                createdAt: new Date(job.timestamp),
                processedOn: job.processedOn ? new Date(job.processedOn) : null,
                finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
                failedReason: job.failedReason,
                attemptsMade: job.attemptsMade,
                opts: job.opts
            };
        }
        catch (error) {
            utils_1.logger.error(`Error getting job details for ${jobId} in queue ${queueName}:`, error);
            throw error;
        }
    }
    async cleanOldJobs(queueName, maxAge = 24 * 60 * 60 * 1000) {
        try {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const grace = 100;
            await queue.clean(maxAge, 'completed', grace);
            await queue.clean(maxAge, 'failed', grace);
            utils_1.logger.info(`Cleaned old jobs from queue ${queueName} (older than ${maxAge}ms)`);
        }
        catch (error) {
            utils_1.logger.error(`Error cleaning old jobs from queue ${queueName}:`, error);
            throw error;
        }
    }
    async scheduleRecurringJob(queueName, jobData, cronPattern, options = {}) {
        try {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const jobOptions = {
                repeat: { cron: cronPattern },
                priority: this.getPriorityValue(jobData.metadata?.priority),
                ...options
            };
            const job = await queue.add(jobData, jobOptions);
            utils_1.logger.info(`Scheduled recurring job in queue ${queueName}:`, {
                jobId: job.id,
                cronPattern,
                type: jobData.type
            });
            return job;
        }
        catch (error) {
            utils_1.logger.error(`Error scheduling recurring job in queue ${queueName}:`, error);
            throw error;
        }
    }
    async removeRecurringJob(queueName, jobId) {
        try {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const repeatableJobs = await queue.getRepeatableJobs();
            const targetJob = repeatableJobs.find(job => job.id === jobId);
            if (targetJob) {
                await queue.removeRepeatableByKey(targetJob.key);
                utils_1.logger.info(`Removed recurring job ${jobId} from queue ${queueName}`);
            }
        }
        catch (error) {
            utils_1.logger.error(`Error removing recurring job ${jobId} from queue ${queueName}:`, error);
            throw error;
        }
    }
    async shutdown() {
        if (this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        utils_1.logger.info('Shutting down job queue service');
        const closePromises = [];
        for (const [queueName, queue] of this.queues) {
            utils_1.logger.info(`Closing queue: ${queueName}`);
            closePromises.push(queue.close());
        }
        try {
            await Promise.all(closePromises);
            this.queues.clear();
            this.processors.clear();
            utils_1.logger.info('All job queues closed successfully');
        }
        catch (error) {
            utils_1.logger.error('Error during job queue shutdown:', error);
        }
    }
    async addTaxCalculationJob(data, priority = 'normal') {
        return this.addJob(JobQueueService.QUEUES.TAX_CALCULATION, {
            type: 'calculate-tax',
            payload: data,
            metadata: {
                businessId: data.businessId,
                priority,
                maxRetries: 2
            }
        });
    }
    async addTransactionProcessingJob(data, priority = 'normal') {
        return this.addJob(JobQueueService.QUEUES.TRANSACTION_PROCESSING, {
            type: 'process-transaction',
            payload: data,
            metadata: {
                businessId: data.businessId,
                priority,
                maxRetries: 3
            }
        });
    }
    async addPOSSyncJob(data, priority = 'normal') {
        return this.addJob(JobQueueService.QUEUES.POS_SYNC, {
            type: 'sync-pos-data',
            payload: data,
            metadata: {
                businessId: data.businessId,
                priority,
                maxRetries: 2
            }
        });
    }
    async addTaxRateUpdateJob(data, priority = 'normal') {
        return this.addJob(JobQueueService.QUEUES.TAX_RATE_UPDATE, {
            type: 'update-tax-rates',
            payload: data,
            metadata: {
                priority,
                maxRetries: 1
            }
        });
    }
    async addComplianceMonitoringJob(data, priority = 'normal') {
        return this.addJob(JobQueueService.QUEUES.COMPLIANCE_MONITORING, {
            type: 'monitor-compliance',
            payload: data,
            metadata: {
                priority,
                maxRetries: 2
            }
        });
    }
    async addAuditProcessingJob(data) {
        return this.addJob(JobQueueService.QUEUES.AUDIT_PROCESSING, {
            type: 'process-audit',
            payload: data,
            metadata: {
                businessId: data.businessId,
                priority: 'normal',
                maxRetries: 3
            }
        });
    }
    async addEmailNotificationJob(data, priority = 'normal') {
        return this.addJob(JobQueueService.QUEUES.EMAIL_NOTIFICATIONS, {
            type: 'send-email',
            payload: data,
            metadata: {
                businessId: data.businessId,
                priority,
                maxRetries: 3
            }
        }, {
            delay: priority === 'high' ? 0 : 5000
        });
    }
    async addReportGenerationJob(data) {
        return this.addJob(JobQueueService.QUEUES.REPORT_GENERATION, {
            type: 'generate-report',
            payload: data,
            metadata: {
                businessId: data.businessId,
                userId: data.requestedBy,
                priority: 'low',
                maxRetries: 2
            }
        });
    }
    async clearQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        await queue.empty();
        utils_1.logger.info(`Queue ${queueName} cleared`);
    }
    async getActiveJobs(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        return queue.getActive();
    }
    async getFailedJobs(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        return queue.getFailed();
    }
    async getWaitingJobs(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        return queue.getWaiting();
    }
    getAvailableQueues() {
        return Array.from(this.queues.keys());
    }
    async healthCheck() {
        try {
            const redisHealth = await this.redisConnection.getConnectionHealth();
            const queueMetrics = await this.getAllQueueMetrics();
            let overallStatus = 'healthy';
            if (redisHealth.status === 'unhealthy') {
                overallStatus = 'unhealthy';
            }
            else if (redisHealth.status === 'degraded') {
                overallStatus = 'degraded';
            }
            const stuckJobsCount = Object.values(queueMetrics)
                .reduce((sum, metrics) => sum + metrics.failed, 0);
            if (stuckJobsCount > 10) {
                overallStatus = 'degraded';
            }
            const queueStatus = {};
            for (const [queueName, metrics] of Object.entries(queueMetrics)) {
                queueStatus[queueName] = {
                    status: metrics.paused ? 'paused' : 'active',
                    metrics
                };
            }
            return {
                status: overallStatus,
                queues: queueStatus,
                redis: redisHealth
            };
        }
        catch (error) {
            utils_1.logger.error('Job queue health check failed:', error);
            return {
                status: 'unhealthy',
                queues: {},
                redis: { status: 'unhealthy' }
            };
        }
    }
}
exports.JobQueueService = JobQueueService;
JobQueueService.QUEUES = {
    TAX_CALCULATION: 'tax-calculation',
    TRANSACTION_PROCESSING: 'transaction-processing',
    POS_SYNC: 'pos-sync',
    TAX_RATE_UPDATE: 'tax-rate-update',
    COMPLIANCE_MONITORING: 'compliance-monitoring',
    AUDIT_PROCESSING: 'audit-processing',
    EMAIL_NOTIFICATIONS: 'email-notifications',
    REPORT_GENERATION: 'report-generation'
};
exports.jobQueue = JobQueueService.getInstance();
//# sourceMappingURL=JobQueueService.js.map