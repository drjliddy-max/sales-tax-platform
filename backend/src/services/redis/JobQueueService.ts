import Bull, { Queue, Job, JobOptions } from 'bull';
import { RedisConnectionService } from './RedisConnectionService';
import { logger } from '@/utils';
import { config } from '@/config';

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

export class JobQueueService {
  private static instance: JobQueueService;
  private queues: Map<string, Queue> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private redisConnection: RedisConnectionService;
  private isShuttingDown = false;

  // Queue names
  public static readonly QUEUES = {
    TAX_CALCULATION: 'tax-calculation',
    TRANSACTION_PROCESSING: 'transaction-processing', 
    POS_SYNC: 'pos-sync',
    TAX_RATE_UPDATE: 'tax-rate-update',
    COMPLIANCE_MONITORING: 'compliance-monitoring',
    AUDIT_PROCESSING: 'audit-processing',
    EMAIL_NOTIFICATIONS: 'email-notifications',
    REPORT_GENERATION: 'report-generation'
  } as const;

  private constructor() {
    this.redisConnection = RedisConnectionService.getInstance();
    this.initializeQueues();
  }

  public static getInstance(): JobQueueService {
    if (!JobQueueService.instance) {
      JobQueueService.instance = new JobQueueService();
    }
    return JobQueueService.instance;
  }

  private async initializeQueues(): Promise<void> {
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
          removeOnComplete: 10, // Keep last 10 completed jobs
          removeOnFail: 50, // Keep last 50 failed jobs for debugging
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        }
      };

      // Initialize all queues
      for (const [queueKey, queueName] of Object.entries(JobQueueService.QUEUES)) {
        const queue = new Bull(queueName, redisConfig);
        
        // Set up global error handlers
        queue.on('error', (error) => {
          logger.error(`Queue ${queueName} error:`, error);
        });

        queue.on('stalled', (job) => {
          logger.warn(`Job stalled in queue ${queueName}:`, { jobId: job.id, data: job.data });
        });

        queue.on('failed', (job, error) => {
          logger.error(`Job failed in queue ${queueName}:`, { 
            jobId: job.id, 
            error: error.message,
            data: job.data 
          });
        });

        queue.on('completed', (job, result) => {
          logger.info(`Job completed in queue ${queueName}:`, { 
            jobId: job.id, 
            processingTime: Date.now() - job.timestamp,
            data: job.data.type 
          });
        });

        this.queues.set(queueName, queue);
        logger.info(`Initialized queue: ${queueName}`);
      }

      logger.info(`All ${this.queues.size} job queues initialized successfully`);
      
    } catch (error) {
      logger.error('Failed to initialize job queues:', error);
      throw error;
    }
  }

  public async addJob(
    queueName: string, 
    jobData: JobData, 
    options: JobOptions = {}
  ): Promise<Job<JobData>> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      // Set job options based on priority
      const jobOptions: JobOptions = {
        priority: this.getPriorityValue(jobData.metadata?.priority),
        attempts: jobData.metadata?.maxRetries || 3,
        ...options
      };

      // Add metadata
      const enrichedJobData: JobData = {
        ...jobData,
        metadata: {
          createdAt: new Date(),
          ...jobData.metadata
        }
      };

      const job = await queue.add(enrichedJobData, jobOptions);
      
      logger.debug(`Job added to queue ${queueName}:`, { 
        jobId: job.id, 
        type: jobData.type,
        priority: jobData.metadata?.priority 
      });
      
      return job;
      
    } catch (error) {
      logger.error(`Error adding job to queue ${queueName}:`, error);
      throw error;
    }
  }

  private getPriorityValue(priority?: string): number {
    switch (priority) {
      case 'critical': return 1;
      case 'high': return 2;
      case 'normal': return 3;
      case 'low': return 4;
      default: return 3;
    }
  }

  public registerProcessor(queueName: string, processor: JobProcessor): void {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Store processor for management
    this.processors.set(queueName, processor);

    // Register the processor with Bull
    queue.process(async (job: Job<JobData>) => {
      logger.info(`Processing job in queue ${queueName}:`, { 
        jobId: job.id, 
        type: job.data.type 
      });
      
      try {
        const result = await processor(job);
        logger.debug(`Job completed successfully:`, { 
          jobId: job.id, 
          queueName, 
          processingTime: Date.now() - job.timestamp 
        });
        return result;
      } catch (error) {
        logger.error(`Job processing failed:`, { 
          jobId: job.id, 
          queueName, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        throw error;
      }
    });

    logger.info(`Registered processor for queue: ${queueName}`);
  }

  public async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
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
      
    } catch (error) {
      logger.error(`Error getting metrics for queue ${queueName}:`, error);
      throw error;
    }
  }

  public async getAllQueueMetrics(): Promise<Record<string, QueueMetrics>> {
    const metrics: Record<string, QueueMetrics> = {};
    
    for (const queueName of this.queues.keys()) {
      try {
        metrics[queueName] = await this.getQueueMetrics(queueName);
      } catch (error) {
        logger.error(`Error getting metrics for queue ${queueName}:`, error);
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

  public async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  public async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  public async drainQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.empty();
    logger.info(`Queue ${queueName} drained`);
  }

  public async retryFailedJobs(queueName: string): Promise<number> {
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
        } catch (error) {
          logger.error(`Failed to retry job ${job.id}:`, error);
        }
      }

      logger.info(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
      return retriedCount;
      
    } catch (error) {
      logger.error(`Error retrying failed jobs in queue ${queueName}:`, error);
      throw error;
    }
  }

  public async getJobDetails(queueName: string, jobId: string): Promise<any> {
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
      
    } catch (error) {
      logger.error(`Error getting job details for ${jobId} in queue ${queueName}:`, error);
      throw error;
    }
  }

  public async cleanOldJobs(queueName: string, maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const grace = 100; // Keep at least 100 jobs
      await queue.clean(maxAge, 'completed', grace);
      await queue.clean(maxAge, 'failed', grace);
      
      logger.info(`Cleaned old jobs from queue ${queueName} (older than ${maxAge}ms)`);
      
    } catch (error) {
      logger.error(`Error cleaning old jobs from queue ${queueName}:`, error);
      throw error;
    }
  }

  public async scheduleRecurringJob(
    queueName: string,
    jobData: JobData,
    cronPattern: string,
    options: JobOptions = {}
  ): Promise<Job<JobData>> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const jobOptions: JobOptions = {
        repeat: { cron: cronPattern },
        priority: this.getPriorityValue(jobData.metadata?.priority),
        ...options
      };

      const job = await queue.add(jobData, jobOptions);
      
      logger.info(`Scheduled recurring job in queue ${queueName}:`, { 
        jobId: job.id, 
        cronPattern, 
        type: jobData.type 
      });
      
      return job;
      
    } catch (error) {
      logger.error(`Error scheduling recurring job in queue ${queueName}:`, error);
      throw error;
    }
  }

  public async removeRecurringJob(queueName: string, jobId: string): Promise<void> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`Queue ${queueName} not found`);
      }

      const repeatableJobs = await queue.getRepeatableJobs();
      const targetJob = repeatableJobs.find(job => job.id === jobId);
      
      if (targetJob) {
        await queue.removeRepeatableByKey(targetJob.key);
        logger.info(`Removed recurring job ${jobId} from queue ${queueName}`);
      }
      
    } catch (error) {
      logger.error(`Error removing recurring job ${jobId} from queue ${queueName}:`, error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    logger.info('Shutting down job queue service');

    const closePromises: Promise<void>[] = [];

    for (const [queueName, queue] of this.queues) {
      logger.info(`Closing queue: ${queueName}`);
      closePromises.push(queue.close());
    }

    try {
      await Promise.all(closePromises);
      this.queues.clear();
      this.processors.clear();
      logger.info('All job queues closed successfully');
    } catch (error) {
      logger.error('Error during job queue shutdown:', error);
    }
  }

  // Utility methods for common job types
  public async addTaxCalculationJob(data: {
    transactionId: string;
    businessId: string;
    recalculate?: boolean;
  }, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<Job<JobData>> {
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

  public async addTransactionProcessingJob(data: {
    transactionData: any;
    source: 'square' | 'shopify' | 'clover' | 'manual';
    businessId: string;
  }, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<Job<JobData>> {
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

  public async addPOSSyncJob(data: {
    integrationId: string;
    businessId: string;
    syncType: 'full' | 'incremental';
    lastSyncTime?: Date;
  }, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<Job<JobData>> {
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

  public async addTaxRateUpdateJob(data: {
    states?: string[];
    force?: boolean;
    source: 'scheduled' | 'manual' | 'emergency';
  }, priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'): Promise<Job<JobData>> {
    return this.addJob(JobQueueService.QUEUES.TAX_RATE_UPDATE, {
      type: 'update-tax-rates',
      payload: data,
      metadata: {
        priority,
        maxRetries: 1 // Tax updates shouldn't retry automatically
      }
    });
  }

  public async addComplianceMonitoringJob(data: {
    states: string[];
    checkType: 'routine' | 'deep' | 'emergency';
  }, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<Job<JobData>> {
    return this.addJob(JobQueueService.QUEUES.COMPLIANCE_MONITORING, {
      type: 'monitor-compliance',
      payload: data,
      metadata: {
        priority,
        maxRetries: 2
      }
    });
  }

  public async addAuditProcessingJob(data: {
    auditType: 'transaction' | 'tax-rate-change' | 'compliance-update';
    entityId: string;
    businessId?: string;
    changeData: any;
  }): Promise<Job<JobData>> {
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

  public async addEmailNotificationJob(data: {
    to: string[];
    subject: string;
    template: string;
    templateData: any;
    businessId?: string;
  }, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<Job<JobData>> {
    return this.addJob(JobQueueService.QUEUES.EMAIL_NOTIFICATIONS, {
      type: 'send-email',
      payload: data,
      metadata: {
        businessId: data.businessId,
        priority,
        maxRetries: 3
      }
    }, {
      delay: priority === 'high' ? 0 : 5000 // High priority emails send immediately
    });
  }

  public async addReportGenerationJob(data: {
    reportType: 'tax-summary' | 'compliance-audit' | 'transaction-details';
    businessId: string;
    dateRange: {
      startDate: Date;
      endDate: Date;
    };
    format: 'pdf' | 'csv' | 'xlsx';
    requestedBy: string;
  }): Promise<Job<JobData>> {
    return this.addJob(JobQueueService.QUEUES.REPORT_GENERATION, {
      type: 'generate-report',
      payload: data,
      metadata: {
        businessId: data.businessId,
        userId: data.requestedBy,
        priority: 'low', // Reports are typically low priority
        maxRetries: 2
      }
    });
  }

  public async clearQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.empty();
    logger.info(`Queue ${queueName} cleared`);
  }

  public async getActiveJobs(queueName: string): Promise<Job<JobData>[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return queue.getActive();
  }

  public async getFailedJobs(queueName: string): Promise<Job<JobData>[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return queue.getFailed();
  }

  public async getWaitingJobs(queueName: string): Promise<Job<JobData>[]> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return queue.getWaiting();
  }

  public getAvailableQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    queues: Record<string, {
      status: string;
      metrics: QueueMetrics;
    }>;
    redis: any;
  }> {
    try {
      const redisHealth = await this.redisConnection.getConnectionHealth();
      const queueMetrics = await this.getAllQueueMetrics();
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (redisHealth.status === 'unhealthy') {
        overallStatus = 'unhealthy';
      } else if (redisHealth.status === 'degraded') {
        overallStatus = 'degraded';
      }
      
      // Check for stuck jobs
      const stuckJobsCount = Object.values(queueMetrics)
        .reduce((sum, metrics) => sum + metrics.failed, 0);
      
      if (stuckJobsCount > 10) {
        overallStatus = 'degraded';
      }

      const queueStatus: Record<string, { status: string; metrics: QueueMetrics }> = {};
      
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
      
    } catch (error) {
      logger.error('Job queue health check failed:', error);
      return {
        status: 'unhealthy',
        queues: {},
        redis: { status: 'unhealthy' }
      };
    }
  }
}

// Export singleton instance
export const jobQueue = JobQueueService.getInstance();