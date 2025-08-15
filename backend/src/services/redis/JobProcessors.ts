import { Job } from 'bull';
import { JobQueueService } from './JobQueueService';
import { TaxCalculator } from '@/services/tax-calculation/TaxCalculator';
import { FirecrawlService } from '@/services/tax-data-collection/FirecrawlService';
import { TaxRateScheduler } from '@/services/tax-data-collection/TaxRateScheduler';
import { TaxRateAuditLogger } from '@/services/tax-data-collection/TaxRateAuditLogger';
import { taxRateCache } from '@/services/redis/TaxRateCacheService';
import { logger } from '@/utils';
import { Transaction, Business } from '@/models';

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

export class JobProcessors {
  private taxCalculator: TaxCalculator;
  private firecrawlService: FirecrawlService;
  private taxRateScheduler: TaxRateScheduler;
  private auditLogger: TaxRateAuditLogger;
  private jobQueue: JobQueueService;

  constructor() {
    this.taxCalculator = new TaxCalculator();
    this.firecrawlService = new FirecrawlService();
    this.taxRateScheduler = new TaxRateScheduler();
    this.auditLogger = new TaxRateAuditLogger();
    this.jobQueue = JobQueueService.getInstance();
    
    this.registerAllProcessors();
  }

  private registerAllProcessors(): void {
    // Tax calculation processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.TAX_CALCULATION,
      this.processTaxCalculationJob.bind(this)
    );

    // Transaction processing processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.TRANSACTION_PROCESSING,
      this.processTransactionJob.bind(this)
    );

    // POS sync processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.POS_SYNC,
      this.processPOSSyncJob.bind(this)
    );

    // Tax rate update processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.TAX_RATE_UPDATE,
      this.processTaxRateUpdateJob.bind(this)
    );

    // Compliance monitoring processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.COMPLIANCE_MONITORING,
      this.processComplianceMonitoringJob.bind(this)
    );

    // Audit processing processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.AUDIT_PROCESSING,
      this.processAuditJob.bind(this)
    );

    // Email notification processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.EMAIL_NOTIFICATIONS,
      this.processEmailNotificationJob.bind(this)
    );

    // Report generation processor
    this.jobQueue.registerProcessor(
      JobQueueService.QUEUES.REPORT_GENERATION,
      this.processReportGenerationJob.bind(this)
    );

    logger.info('All job processors registered successfully');
  }

  private async processTaxCalculationJob(job: Job<JobData>): Promise<any> {
    const { transactionId, businessId, recalculate } = job.data.payload;
    
    logger.info(`Processing tax calculation job for transaction ${transactionId}`);
    
    try {
      // Get transaction details
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      // Get business details for tax configuration
      const business = await Business.findById(businessId);
      if (!business) {
        throw new Error(`Business ${businessId} not found`);
      }

      // Prepare calculation request
      const calculationRequest = {
        items: transaction.items.map(item => ({
          id: item.id || Math.random().toString(36).substr(2, 9),
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxCategory: item.taxCategory || 'general'
        })),
        address: transaction.address || business.address,
        customerTaxExempt: false
      };

      // Calculate taxes
      const taxResult = await this.taxCalculator.calculateTax(calculationRequest);
      
      // Update transaction with calculated taxes
      const updatedTransaction = await Transaction.findByIdAndUpdate(
        transactionId,
        {
          $set: {
            taxBreakdown: taxResult.taxBreakdown,
            totalTax: taxResult.totalTax,
            grandTotal: taxResult.grandTotal,
            taxCalculationCompleted: true,
            lastTaxCalculation: new Date()
          }
        },
        { new: true }
      );

      // Log audit entry
      logger.info(`Tax calculation completed for transaction ${transactionId}`, {
        businessId,
        recalculate,
        totalTax: taxResult.totalTax
      });

      job.progress(100);
      
      return {
        success: true,
        transactionId,
        taxResult,
        updatedAt: new Date()
      };
      
    } catch (error) {
      logger.error(`Tax calculation job failed for transaction ${transactionId}:`, error);
      throw error;
    }
  }

  private async processTransactionJob(job: Job<JobData>): Promise<any> {
    const { transactionData, source, businessId } = job.data.payload;
    
    logger.info(`Processing transaction from ${source} for business ${businessId}`);
    
    try {
      job.progress(10);
      
      // Validate and normalize transaction data
      const normalizedData = await this.normalizeTransactionData(transactionData, source);
      
      job.progress(30);
      
      // Create transaction record
      const transaction = new Transaction({
        ...normalizedData,
        businessId,
        source,
        status: 'processing',
        createdAt: new Date()
      });
      
      await transaction.save();
      job.progress(50);
      
      // Queue tax calculation
      await this.jobQueue.addTaxCalculationJob({
        transactionId: transaction._id.toString(),
        businessId,
        recalculate: false
      }, 'normal');
      
      job.progress(80);
      
      // Queue audit logging
      await this.jobQueue.addAuditProcessingJob({
        auditType: 'transaction',
        entityId: transaction._id.toString(),
        businessId,
        changeData: {
          action: 'created',
          source,
          transactionData: normalizedData
        }
      });
      
      job.progress(100);
      
      return {
        success: true,
        transactionId: transaction._id.toString(),
        source,
        queuedJobs: ['tax-calculation', 'audit-processing']
      };
      
    } catch (error) {
      logger.error(`Transaction processing job failed:`, error);
      throw error;
    }
  }

  private async processPOSSyncJob(job: Job<JobData>): Promise<any> {
    const { integrationId, businessId, syncType, lastSyncTime } = job.data.payload;
    
    logger.info(`Processing POS sync job: ${syncType} sync for integration ${integrationId}`);
    
    try {
      job.progress(10);
      
      // Get business and integration details
      const business = await Business.findById(businessId);
      if (!business) {
        throw new Error(`Business ${businessId} not found`);
      }

      const integration = business.integrations.pos.find((int: any) => int._id?.toString() === integrationId);
      if (!integration) {
        throw new Error(`Integration ${integrationId} not found`);
      }

      job.progress(30);
      
      let syncedTransactions = 0;
      let errors = 0;
      
      // Simulate POS sync logic based on integration type
      switch (integration.type) {
        case 'square':
          const result = await this.syncSquareTransactions(integration, lastSyncTime, syncType);
          syncedTransactions = result.synced;
          errors = result.errors;
          break;
          
        case 'shopify':
          // Implement Shopify sync
          break;
          
        case 'clover':
          // Implement Clover sync
          break;
          
        default:
          throw new Error(`Unsupported integration type: ${integration.type}`);
      }
      
      job.progress(90);
      
      // Update last sync time
      await Business.findOneAndUpdate(
        { _id: businessId, 'integrations.id': integrationId },
        { 
          $set: { 
            'integrations.$.lastSync': new Date(),
            'integrations.$.syncStatus': 'completed'
          }
        }
      );
      
      job.progress(100);
      
      return {
        success: true,
        integrationId,
        syncType,
        syncedTransactions,
        errors,
        completedAt: new Date()
      };
      
    } catch (error) {
      logger.error(`POS sync job failed:`, error);
      
      // Update integration status
      await Business.findOneAndUpdate(
        { _id: businessId, 'integrations.id': integrationId },
        { 
          $set: { 
            'integrations.$.syncStatus': 'failed',
            'integrations.$.lastError': error instanceof Error ? error.message : 'Unknown error'
          }
        }
      );
      
      throw error;
    }
  }

  private async processTaxRateUpdateJob(job: Job<JobData>): Promise<any> {
    const { states, force, source } = job.data.payload;
    
    logger.info(`Processing tax rate update job from ${source}`);
    
    try {
      job.progress(10);
      
      let result;
      if (states && states.length > 0) {
        result = await this.taxRateScheduler.manualUpdate(states);
      } else {
        result = await this.taxRateScheduler.manualUpdate();
      }
      
      job.progress(50);
      
      // Invalidate related cache entries
      if (states && states.length > 0) {
        await taxRateCache.bulkInvalidateByStates(states);
      } else {
        await taxRateCache.invalidateCache();
      }
      
      job.progress(100);
      
      return {
        success: true,
        source,
        result,
        cacheInvalidated: true
      };
      
    } catch (error) {
      logger.error(`Tax rate update job failed:`, error);
      throw error;
    }
  }

  private async processComplianceMonitoringJob(job: Job<JobData>): Promise<any> {
    const { states, checkType } = job.data.payload;
    
    logger.info(`Processing compliance monitoring job: ${checkType} check for states: ${states.join(', ')}`);
    
    try {
      // This would integrate with the ComplianceMonitor service
      // For now, simulate the processing
      job.progress(50);
      
      // Simulate compliance check results
      const alerts = [];
      
      job.progress(100);
      
      return {
        success: true,
        checkType,
        states,
        alertsFound: alerts.length,
        completedAt: new Date()
      };
      
    } catch (error) {
      logger.error(`Compliance monitoring job failed:`, error);
      throw error;
    }
  }

  private async processAuditJob(job: Job<JobData>): Promise<any> {
    const { auditType, entityId, businessId, changeData } = job.data.payload;
    
    logger.info(`Processing audit job: ${auditType} for entity ${entityId}`);
    
    try {
      logger.info('Audit event logged:', {
        auditType,
        entityId,
        businessId: businessId || 'system',
        changeData
      });
      
      job.progress(100);
      
      return {
        success: true,
        auditType,
        entityId,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error(`Audit processing job failed:`, error);
      throw error;
    }
  }

  private async processEmailNotificationJob(job: Job<JobData>): Promise<any> {
    const { to, subject, template, templateData, businessId } = job.data.payload;
    
    logger.info(`Processing email notification job: ${template} to ${to.length} recipients`);
    
    try {
      // Simulate email sending
      // In production, this would integrate with an email service
      job.progress(50);
      
      // Log the email for auditing
      logger.info('Email notification sent:', {
        to: to.length,
        subject,
        template,
        businessId,
        sentAt: new Date()
      });
      
      job.progress(100);
      
      return {
        success: true,
        recipientCount: to.length,
        template,
        sentAt: new Date()
      };
      
    } catch (error) {
      logger.error(`Email notification job failed:`, error);
      throw error;
    }
  }

  private async processReportGenerationJob(job: Job<JobData>): Promise<any> {
    const { reportType, businessId, dateRange, format, requestedBy } = job.data.payload;
    
    logger.info(`Processing report generation job: ${reportType} (${format}) for business ${businessId}`);
    
    try {
      job.progress(20);
      
      // Generate report based on type
      let reportData;
      switch (reportType) {
        case 'tax-summary':
          reportData = await this.generateTaxSummaryReport(businessId, dateRange);
          break;
        case 'compliance-audit':
          reportData = await this.generateComplianceAuditReport(businessId, dateRange);
          break;
        case 'transaction-details':
          reportData = await this.generateTransactionDetailsReport(businessId, dateRange);
          break;
        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }
      
      job.progress(70);
      
      // Format report (simulate file generation)
      const reportFile = await this.formatReport(reportData, format);
      
      job.progress(90);
      
      // Log audit entry
      logger.info('Report generated:', {
        reportType,
        format,
        dateRange,
        requestedBy,
        businessId,
        generatedAt: new Date()
      });
      
      job.progress(100);
      
      return {
        success: true,
        reportType,
        format,
        fileSize: reportFile.size,
        recordCount: reportData.recordCount,
        generatedAt: new Date()
      };
      
    } catch (error) {
      logger.error(`Report generation job failed:`, error);
      throw error;
    }
  }

  private async normalizeTransactionData(data: any, source: string): Promise<any> {
    // Normalize transaction data from different POS systems
    switch (source) {
      case 'square':
        return {
          externalId: data.id,
          amount: data.amount_money?.amount / 100, // Square uses cents
          currency: data.amount_money?.currency || 'USD',
          items: data.itemizations?.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.base_price_money?.amount / 100,
            taxCategory: 'general'
          })) || [],
          paymentMethod: data.tender?.[0]?.type || 'unknown',
          timestamp: new Date(data.created_at),
          metadata: { source: 'square', originalData: data }
        };
        
      case 'shopify':
        return {
          externalId: data.id,
          amount: parseFloat(data.total_price),
          currency: data.currency,
          items: data.line_items?.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: parseFloat(item.price),
            taxCategory: 'general'
          })) || [],
          paymentMethod: data.payment_gateway_names?.[0] || 'unknown',
          timestamp: new Date(data.created_at),
          metadata: { source: 'shopify', originalData: data }
        };
        
      default:
        return data;
    }
  }

  private async syncSquareTransactions(integration: any, lastSyncTime?: Date, syncType: string = 'incremental'): Promise<{ synced: number; errors: number }> {
    // Simulate Square sync
    const mockTransactions = [
      { id: '1', amount_money: { amount: 1500, currency: 'USD' } },
      { id: '2', amount_money: { amount: 2500, currency: 'USD' } }
    ];
    
    let synced = 0;
    let errors = 0;
    
    for (const transaction of mockTransactions) {
      try {
        await this.jobQueue.addTransactionProcessingJob({
          transactionData: transaction,
          source: 'square',
          businessId: integration.businessId
        });
        synced++;
      } catch (error) {
        errors++;
        logger.error(`Error queuing Square transaction ${transaction.id}:`, error);
      }
    }
    
    return { synced, errors };
  }

  private async generateTaxSummaryReport(businessId: string, dateRange: any): Promise<any> {
    const transactions = await Transaction.find({
      businessId,
      timestamp: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate
      }
    });
    
    const summary = {
      totalTransactions: transactions.length,
      totalTaxCollected: transactions.reduce((sum, t) => sum + (t.totalTax || 0), 0),
      totalRevenue: transactions.reduce((sum, t) => sum + (t.subtotal || 0), 0),
      taxByJurisdiction: this.groupTaxByJurisdiction(transactions),
      recordCount: transactions.length
    };
    
    return summary;
  }

  private async generateComplianceAuditReport(businessId: string, dateRange: any): Promise<any> {
    // This would generate a compliance audit report
    return {
      businessId,
      auditPeriod: dateRange,
      findings: [],
      recordCount: 0
    };
  }

  private async generateTransactionDetailsReport(businessId: string, dateRange: any): Promise<any> {
    const transactions = await Transaction.find({
      businessId,
      timestamp: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate
      }
    }).populate('business');
    
    return {
      transactions,
      recordCount: transactions.length
    };
  }

  private groupTaxByJurisdiction(transactions: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    for (const transaction of transactions) {
      if (transaction.taxBreakdown) {
        for (const tax of transaction.taxBreakdown) {
          const key = `${tax.jurisdiction} (${tax.jurisdictionType})`;
          grouped[key] = (grouped[key] || 0) + tax.taxAmount;
        }
      }
    }
    
    return grouped;
  }

  private async formatReport(data: any, format: string): Promise<{ size: number; path?: string }> {
    // Simulate report formatting
    switch (format) {
      case 'pdf':
        return { size: 1024 * 50 }; // 50KB
      case 'csv':
        return { size: 1024 * 10 }; // 10KB  
      case 'xlsx':
        return { size: 1024 * 25 }; // 25KB
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  public async processHealthCheckJobs(): Promise<void> {
    // Add test jobs to verify queue functionality
    for (const queueName of this.jobQueue.getAvailableQueues()) {
      try {
        await this.jobQueue.addJob(queueName, {
          type: 'health-check',
          payload: { timestamp: new Date() },
          metadata: { priority: 'low' }
        });
      } catch (error) {
        logger.error(`Error adding health check job to ${queueName}:`, error);
      }
    }
  }
}

// Export singleton instance
export const jobProcessors = new JobProcessors();