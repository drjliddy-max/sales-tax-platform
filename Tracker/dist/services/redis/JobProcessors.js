"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobProcessors = exports.JobProcessors = void 0;
const JobQueueService_1 = require("./JobQueueService");
const TaxCalculator_1 = require("@/services/tax-calculation/TaxCalculator");
const FirecrawlService_1 = require("@/services/tax-data-collection/FirecrawlService");
const TaxRateScheduler_1 = require("@/services/tax-data-collection/TaxRateScheduler");
const TaxRateAuditLogger_1 = require("@/services/tax-data-collection/TaxRateAuditLogger");
const TaxRateCacheService_1 = require("@/services/redis/TaxRateCacheService");
const utils_1 = require("@/utils");
const models_1 = require("@/models");
class JobProcessors {
    constructor() {
        this.taxCalculator = new TaxCalculator_1.TaxCalculator();
        this.firecrawlService = new FirecrawlService_1.FirecrawlService();
        this.taxRateScheduler = new TaxRateScheduler_1.TaxRateScheduler();
        this.auditLogger = new TaxRateAuditLogger_1.TaxRateAuditLogger();
        this.jobQueue = JobQueueService_1.JobQueueService.getInstance();
        this.registerAllProcessors();
    }
    registerAllProcessors() {
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.TAX_CALCULATION, this.processTaxCalculationJob.bind(this));
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.TRANSACTION_PROCESSING, this.processTransactionJob.bind(this));
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.POS_SYNC, this.processPOSSyncJob.bind(this));
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.TAX_RATE_UPDATE, this.processTaxRateUpdateJob.bind(this));
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.COMPLIANCE_MONITORING, this.processComplianceMonitoringJob.bind(this));
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.AUDIT_PROCESSING, this.processAuditJob.bind(this));
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.EMAIL_NOTIFICATIONS, this.processEmailNotificationJob.bind(this));
        this.jobQueue.registerProcessor(JobQueueService_1.JobQueueService.QUEUES.REPORT_GENERATION, this.processReportGenerationJob.bind(this));
        utils_1.logger.info('All job processors registered successfully');
    }
    async processTaxCalculationJob(job) {
        const { transactionId, businessId, recalculate } = job.data.payload;
        utils_1.logger.info(`Processing tax calculation job for transaction ${transactionId}`);
        try {
            const transaction = await models_1.Transaction.findById(transactionId);
            if (!transaction) {
                throw new Error(`Transaction ${transactionId} not found`);
            }
            const business = await models_1.Business.findById(businessId);
            if (!business) {
                throw new Error(`Business ${businessId} not found`);
            }
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
            const taxResult = await this.taxCalculator.calculateTax(calculationRequest);
            const updatedTransaction = await models_1.Transaction.findByIdAndUpdate(transactionId, {
                $set: {
                    taxBreakdown: taxResult.taxBreakdown,
                    totalTax: taxResult.totalTax,
                    grandTotal: taxResult.grandTotal,
                    taxCalculationCompleted: true,
                    lastTaxCalculation: new Date()
                }
            }, { new: true });
            utils_1.logger.info(`Tax calculation completed for transaction ${transactionId}`, {
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
        }
        catch (error) {
            utils_1.logger.error(`Tax calculation job failed for transaction ${transactionId}:`, error);
            throw error;
        }
    }
    async processTransactionJob(job) {
        const { transactionData, source, businessId } = job.data.payload;
        utils_1.logger.info(`Processing transaction from ${source} for business ${businessId}`);
        try {
            job.progress(10);
            const normalizedData = await this.normalizeTransactionData(transactionData, source);
            job.progress(30);
            const transaction = new models_1.Transaction({
                ...normalizedData,
                businessId,
                source,
                status: 'processing',
                createdAt: new Date()
            });
            await transaction.save();
            job.progress(50);
            await this.jobQueue.addTaxCalculationJob({
                transactionId: transaction._id.toString(),
                businessId,
                recalculate: false
            }, 'normal');
            job.progress(80);
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
        }
        catch (error) {
            utils_1.logger.error(`Transaction processing job failed:`, error);
            throw error;
        }
    }
    async processPOSSyncJob(job) {
        const { integrationId, businessId, syncType, lastSyncTime } = job.data.payload;
        utils_1.logger.info(`Processing POS sync job: ${syncType} sync for integration ${integrationId}`);
        try {
            job.progress(10);
            const business = await models_1.Business.findById(businessId);
            if (!business) {
                throw new Error(`Business ${businessId} not found`);
            }
            const integration = business.integrations.pos.find((int) => int._id?.toString() === integrationId);
            if (!integration) {
                throw new Error(`Integration ${integrationId} not found`);
            }
            job.progress(30);
            let syncedTransactions = 0;
            let errors = 0;
            switch (integration.type) {
                case 'square':
                    const result = await this.syncSquareTransactions(integration, lastSyncTime, syncType);
                    syncedTransactions = result.synced;
                    errors = result.errors;
                    break;
                case 'shopify':
                    break;
                case 'clover':
                    break;
                default:
                    throw new Error(`Unsupported integration type: ${integration.type}`);
            }
            job.progress(90);
            await models_1.Business.findOneAndUpdate({ _id: businessId, 'integrations.id': integrationId }, {
                $set: {
                    'integrations.$.lastSync': new Date(),
                    'integrations.$.syncStatus': 'completed'
                }
            });
            job.progress(100);
            return {
                success: true,
                integrationId,
                syncType,
                syncedTransactions,
                errors,
                completedAt: new Date()
            };
        }
        catch (error) {
            utils_1.logger.error(`POS sync job failed:`, error);
            await models_1.Business.findOneAndUpdate({ _id: businessId, 'integrations.id': integrationId }, {
                $set: {
                    'integrations.$.syncStatus': 'failed',
                    'integrations.$.lastError': error instanceof Error ? error.message : 'Unknown error'
                }
            });
            throw error;
        }
    }
    async processTaxRateUpdateJob(job) {
        const { states, force, source } = job.data.payload;
        utils_1.logger.info(`Processing tax rate update job from ${source}`);
        try {
            job.progress(10);
            let result;
            if (states && states.length > 0) {
                result = await this.taxRateScheduler.manualUpdate(states);
            }
            else {
                result = await this.taxRateScheduler.manualUpdate();
            }
            job.progress(50);
            if (states && states.length > 0) {
                await TaxRateCacheService_1.taxRateCache.bulkInvalidateByStates(states);
            }
            else {
                await TaxRateCacheService_1.taxRateCache.invalidateCache();
            }
            job.progress(100);
            return {
                success: true,
                source,
                result,
                cacheInvalidated: true
            };
        }
        catch (error) {
            utils_1.logger.error(`Tax rate update job failed:`, error);
            throw error;
        }
    }
    async processComplianceMonitoringJob(job) {
        const { states, checkType } = job.data.payload;
        utils_1.logger.info(`Processing compliance monitoring job: ${checkType} check for states: ${states.join(', ')}`);
        try {
            job.progress(50);
            const alerts = [];
            job.progress(100);
            return {
                success: true,
                checkType,
                states,
                alertsFound: alerts.length,
                completedAt: new Date()
            };
        }
        catch (error) {
            utils_1.logger.error(`Compliance monitoring job failed:`, error);
            throw error;
        }
    }
    async processAuditJob(job) {
        const { auditType, entityId, businessId, changeData } = job.data.payload;
        utils_1.logger.info(`Processing audit job: ${auditType} for entity ${entityId}`);
        try {
            utils_1.logger.info('Audit event logged:', {
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
        }
        catch (error) {
            utils_1.logger.error(`Audit processing job failed:`, error);
            throw error;
        }
    }
    async processEmailNotificationJob(job) {
        const { to, subject, template, templateData, businessId } = job.data.payload;
        utils_1.logger.info(`Processing email notification job: ${template} to ${to.length} recipients`);
        try {
            job.progress(50);
            utils_1.logger.info('Email notification sent:', {
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
        }
        catch (error) {
            utils_1.logger.error(`Email notification job failed:`, error);
            throw error;
        }
    }
    async processReportGenerationJob(job) {
        const { reportType, businessId, dateRange, format, requestedBy } = job.data.payload;
        utils_1.logger.info(`Processing report generation job: ${reportType} (${format}) for business ${businessId}`);
        try {
            job.progress(20);
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
            const reportFile = await this.formatReport(reportData, format);
            job.progress(90);
            utils_1.logger.info('Report generated:', {
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
        }
        catch (error) {
            utils_1.logger.error(`Report generation job failed:`, error);
            throw error;
        }
    }
    async normalizeTransactionData(data, source) {
        switch (source) {
            case 'square':
                return {
                    externalId: data.id,
                    amount: data.amount_money?.amount / 100,
                    currency: data.amount_money?.currency || 'USD',
                    items: data.itemizations?.map((item) => ({
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
                    items: data.line_items?.map((item) => ({
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
    async syncSquareTransactions(integration, lastSyncTime, syncType = 'incremental') {
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
            }
            catch (error) {
                errors++;
                utils_1.logger.error(`Error queuing Square transaction ${transaction.id}:`, error);
            }
        }
        return { synced, errors };
    }
    async generateTaxSummaryReport(businessId, dateRange) {
        const transactions = await models_1.Transaction.find({
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
    async generateComplianceAuditReport(businessId, dateRange) {
        return {
            businessId,
            auditPeriod: dateRange,
            findings: [],
            recordCount: 0
        };
    }
    async generateTransactionDetailsReport(businessId, dateRange) {
        const transactions = await models_1.Transaction.find({
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
    groupTaxByJurisdiction(transactions) {
        const grouped = {};
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
    async formatReport(data, format) {
        switch (format) {
            case 'pdf':
                return { size: 1024 * 50 };
            case 'csv':
                return { size: 1024 * 10 };
            case 'xlsx':
                return { size: 1024 * 25 };
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
    }
    async processHealthCheckJobs() {
        for (const queueName of this.jobQueue.getAvailableQueues()) {
            try {
                await this.jobQueue.addJob(queueName, {
                    type: 'health-check',
                    payload: { timestamp: new Date() },
                    metadata: { priority: 'low' }
                });
            }
            catch (error) {
                utils_1.logger.error(`Error adding health check job to ${queueName}:`, error);
            }
        }
    }
}
exports.JobProcessors = JobProcessors;
exports.jobProcessors = new JobProcessors();
//# sourceMappingURL=JobProcessors.js.map