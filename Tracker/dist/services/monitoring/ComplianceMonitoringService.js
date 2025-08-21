"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.complianceMonitoring = exports.ComplianceMonitoringService = void 0;
const SentryService_1 = require("./SentryService");
const utils_1 = require("@/utils");
const models_1 = require("@/models");
class ComplianceMonitoringService {
    constructor() {
        this.complianceCache = new Map();
        this.auditTrail = [];
        this.filingRequirements = new Map();
        this.startComplianceMonitoring();
    }
    static getInstance() {
        if (!ComplianceMonitoringService.instance) {
            ComplianceMonitoringService.instance = new ComplianceMonitoringService();
        }
        return ComplianceMonitoringService.instance;
    }
    async performComplianceCheck(check) {
        const transaction = SentryService_1.sentryService.startTransaction(`compliance_check_${check.type}`, 'compliance.check', {
            businessId: check.businessId,
            jurisdiction: check.jurisdiction,
            checkType: check.type
        });
        try {
            const timestamp = new Date();
            const fullCheck = {
                ...check,
                timestamp
            };
            const checkKey = `${check.businessId}_${check.jurisdiction}_${check.type}`;
            this.complianceCache.set(checkKey, fullCheck);
            SentryService_1.sentryService.trackComplianceWorkflow({
                type: this.mapCheckTypeToWorkflow(check.type),
                businessId: check.businessId,
                jurisdiction: check.jurisdiction,
                status: check.status === 'pass' ? 'completed' : 'failed',
                complianceScore: check.score
            });
            if (check.status === 'fail' || check.score < 0.7) {
                const alertId = SentryService_1.sentryService.createComplianceAlert({
                    type: check.type === 'accuracy' ? 'accuracy' : 'threshold',
                    severity: check.score < 0.5 ? 'critical' : check.score < 0.7 ? 'high' : 'medium',
                    businessId: check.businessId,
                    jurisdiction: check.jurisdiction,
                    message: `Compliance check failed: ${check.details}`,
                    metadata: {
                        check_type: check.type,
                        score: check.score,
                        details: check.details,
                        ...check.metadata
                    },
                    timestamp
                });
                utils_1.logger.warn('Compliance check failed', {
                    alertId,
                    businessId: check.businessId,
                    type: check.type,
                    score: check.score
                });
            }
            transaction.setAttribute('check_type', check.type);
            transaction.setAttribute('status', check.status);
            transaction.setAttribute('score', check.score.toString());
            transaction.end();
            return checkKey;
        }
        catch (error) {
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Compliance check failed'), {
                businessId: check.businessId,
                jurisdiction: check.jurisdiction,
                severity: 'high'
            });
            transaction.setAttribute('error', 'true');
            transaction.end();
            throw error;
        }
    }
    async auditTaxCalculation(transactionId, calculatedTax, expectedTax, businessId) {
        try {
            let accuracyScore = 1.0;
            let status = 'pass';
            let details = 'Tax calculation accurate';
            if (expectedTax !== undefined) {
                const variance = Math.abs(calculatedTax - expectedTax) / expectedTax;
                if (variance > 0.1) {
                    status = 'fail';
                    accuracyScore = Math.max(0, 1 - variance);
                    details = `Tax calculation variance: ${(variance * 100).toFixed(2)}%`;
                }
                else if (variance > 0.05) {
                    status = 'warning';
                    accuracyScore = 0.8;
                    details = `Tax calculation variance: ${(variance * 100).toFixed(2)}%`;
                }
            }
            const transaction = await models_1.Transaction.findById(transactionId);
            const jurisdiction = transaction ?
                `${transaction.address?.city || 'Unknown'}, ${transaction.address?.state || 'Unknown'}` :
                'Unknown';
            await this.performComplianceCheck({
                type: 'accuracy',
                businessId: businessId || transaction?.businessId || 'default',
                jurisdiction,
                status,
                score: accuracyScore,
                details,
                metadata: {
                    transaction_id: transactionId,
                    calculated_tax: calculatedTax,
                    expected_tax: expectedTax,
                    variance: expectedTax ? Math.abs(calculatedTax - expectedTax) / expectedTax : 0
                }
            });
        }
        catch (error) {
            utils_1.logger.error('Error during tax calculation audit:', error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Tax calculation audit failed'), {
                businessId,
                transactionId,
                severity: 'medium'
            });
        }
    }
    logAuditEvent(event) {
        this.auditTrail.push(event);
        if (this.auditTrail.length > 1000) {
            this.auditTrail = this.auditTrail.slice(-1000);
        }
        SentryService_1.sentryService.addBreadcrumb('audit_trail', `${event.action} ${event.entityType}`, 'info', {
            entity_type: event.entityType,
            entity_id: event.entityId,
            action: event.action,
            business_id: event.businessId,
            user_id: event.userId,
            jurisdiction: event.jurisdiction,
            change_count: Object.keys(event.changes).length
        });
        if (event.entityType === 'tax_rate' && (event.action === 'updated' || event.action === 'deleted')) {
            SentryService_1.sentryService.createComplianceAlert({
                type: 'rate_change',
                severity: 'medium',
                businessId: event.businessId,
                jurisdiction: event.jurisdiction || 'System',
                message: `Tax rate ${event.action}: ${event.entityId}`,
                metadata: {
                    entity_type: event.entityType,
                    action: event.action,
                    user_id: event.userId,
                    changes: event.changes
                },
                timestamp: event.timestamp
            });
        }
    }
    async monitorFilingRequirements() {
        const transaction = SentryService_1.sentryService.startTransaction('filing_requirements_check', 'compliance.filing', {});
        try {
            const businesses = await models_1.Business.find({ status: 'active' });
            for (const business of businesses) {
                const businessSpan = SentryService_1.sentryService.createSpan(transaction, 'business_filing_check', `Check filing for ${business.name}`);
                try {
                    await this.checkBusinessFilingRequirements(business._id.toString());
                }
                catch (error) {
                    SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Filing requirement check failed'), {
                        businessId: business._id.toString(),
                        severity: 'high'
                    });
                }
                businessSpan.end();
            }
            transaction.end();
        }
        catch (error) {
            transaction.setAttribute('error', 'true');
            transaction.end();
            throw error;
        }
    }
    async checkBusinessFilingRequirements(businessId) {
        const mockRequirement = {
            businessId,
            jurisdiction: 'CA',
            filingPeriod: 'monthly',
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            status: 'pending',
            taxOwed: 1500.00,
            penaltyRisk: 'low'
        };
        this.filingRequirements.set(`${businessId}_CA`, mockRequirement);
        const daysUntilDue = (mockRequirement.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilDue <= 7) {
            SentryService_1.sentryService.createComplianceAlert({
                type: 'filing',
                severity: daysUntilDue <= 3 ? 'critical' : 'high',
                businessId,
                jurisdiction: mockRequirement.jurisdiction,
                message: `Tax filing due in ${Math.ceil(daysUntilDue)} days`,
                metadata: {
                    filing_period: mockRequirement.filingPeriod,
                    due_date: mockRequirement.dueDate.toISOString(),
                    tax_owed: mockRequirement.taxOwed,
                    penalty_risk: mockRequirement.penaltyRisk
                },
                timestamp: new Date()
            });
        }
    }
    async detectTaxCalculationAnomalies(businessId) {
        const transaction = SentryService_1.sentryService.startTransaction('anomaly_detection', 'compliance.anomaly', { businessId });
        try {
            const recentTransactions = await models_1.Transaction.find({
                businessId,
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }).limit(1000);
            if (recentTransactions.length < 10) {
                transaction.end();
                return;
            }
            const totalRevenue = recentTransactions.reduce((sum, t) => sum + (t.subtotal || 0), 0);
            const totalTax = recentTransactions.reduce((sum, t) => sum + (t.totalTax || 0), 0);
            const avgTaxRate = totalRevenue > 0 ? totalTax / totalRevenue : 0;
            const anomalies = recentTransactions.filter(transaction => {
                if (!transaction.subtotal || !transaction.totalTax)
                    return false;
                const transactionTaxRate = transaction.totalTax / transaction.subtotal;
                const deviation = Math.abs(transactionTaxRate - avgTaxRate) / avgTaxRate;
                return deviation > 0.5;
            });
            if (anomalies.length > 0) {
                SentryService_1.sentryService.createComplianceAlert({
                    type: 'anomaly',
                    severity: anomalies.length > 10 ? 'critical' : 'medium',
                    businessId,
                    jurisdiction: 'Multiple',
                    message: `${anomalies.length} tax calculation anomalies detected`,
                    metadata: {
                        anomaly_count: anomalies.length,
                        total_transactions: recentTransactions.length,
                        avg_tax_rate: avgTaxRate,
                        anomaly_transaction_ids: anomalies.slice(0, 5).map(t => t._id.toString())
                    },
                    timestamp: new Date()
                });
            }
            const complianceScore = 1 - (anomalies.length / recentTransactions.length);
            await this.performComplianceCheck({
                type: 'accuracy',
                businessId,
                jurisdiction: 'System-wide',
                status: complianceScore > 0.95 ? 'pass' : complianceScore > 0.9 ? 'warning' : 'fail',
                score: complianceScore,
                details: `${anomalies.length} anomalies in ${recentTransactions.length} transactions`,
                metadata: {
                    avg_tax_rate: avgTaxRate,
                    anomaly_count: anomalies.length,
                    total_transactions: recentTransactions.length
                }
            });
            transaction.setAttribute('anomaly_count', anomalies.length.toString());
            transaction.setAttribute('compliance_score', complianceScore.toString());
            transaction.end();
        }
        catch (error) {
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Anomaly detection failed'), {
                businessId,
                severity: 'medium'
            });
            transaction.setAttribute('error', 'true');
            transaction.end();
            throw error;
        }
    }
    mapCheckTypeToWorkflow(checkType) {
        switch (checkType) {
            case 'filing': return 'tax_filing';
            case 'rate_compliance': return 'rate_update';
            case 'accuracy': return 'audit_trail';
            default: return 'compliance_check';
        }
    }
    startComplianceMonitoring() {
        setInterval(() => {
            this.runScheduledComplianceChecks();
        }, 60 * 60 * 1000);
        setInterval(() => {
            this.runAnomalyDetection();
        }, 6 * 60 * 60 * 1000);
        setInterval(() => {
            this.monitorFilingRequirements();
        }, 24 * 60 * 60 * 1000);
        utils_1.logger.info('Started compliance monitoring services');
    }
    async runScheduledComplianceChecks() {
        try {
            const businesses = await models_1.Business.find({ status: 'active' });
            for (const business of businesses) {
                try {
                    await this.checkTaxRateCompliance(business._id.toString());
                    await this.detectTaxCalculationAnomalies(business._id.toString());
                }
                catch (error) {
                    utils_1.logger.error(`Error in compliance check for business ${business._id}:`, error);
                }
            }
        }
        catch (error) {
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Scheduled compliance check failed'), { severity: 'medium' });
        }
    }
    async runAnomalyDetection() {
        try {
            const businesses = await models_1.Business.find({ status: 'active' });
            for (const business of businesses) {
                await this.detectTaxCalculationAnomalies(business._id.toString());
            }
        }
        catch (error) {
            utils_1.logger.error('Error running anomaly detection:', error);
        }
    }
    async checkTaxRateCompliance(businessId) {
        try {
            const business = await models_1.Business.findById(businessId);
            if (!business)
                return;
            const nexusStates = business.nexusStates || [];
            for (const state of nexusStates) {
                const stateCode = typeof state === 'string' ? state : state.state;
                const rates = await models_1.TaxRate.find({
                    state: stateCode,
                    active: true,
                    effectiveDate: { $lte: new Date() }
                });
                const outdatedRates = rates.filter(rate => {
                    const daysSinceUpdate = (Date.now() - rate.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
                    return daysSinceUpdate > 90;
                });
                if (outdatedRates.length > 0) {
                    await this.performComplianceCheck({
                        type: 'rate_compliance',
                        businessId,
                        jurisdiction: stateCode,
                        status: 'warning',
                        score: 1 - (outdatedRates.length / rates.length),
                        details: `${outdatedRates.length} outdated tax rates found`,
                        metadata: {
                            total_rates: rates.length,
                            outdated_rates: outdatedRates.length,
                            oldest_rate_age: Math.max(...outdatedRates.map(r => (Date.now() - r.lastUpdated.getTime()) / (1000 * 60 * 60 * 24)))
                        }
                    });
                }
            }
        }
        catch (error) {
            utils_1.logger.error(`Error checking tax rate compliance for business ${businessId}:`, error);
        }
    }
    getComplianceReport(businessId) {
        const checks = Array.from(this.complianceCache.values())
            .filter(check => !businessId || check.businessId === businessId);
        const overallScore = checks.length > 0
            ? checks.reduce((sum, check) => sum + check.score, 0) / checks.length
            : 1.0;
        const alerts = checks
            .filter(check => check.status !== 'pass')
            .map(check => ({
            type: check.type,
            severity: check.score < 0.5 ? 'critical' : check.score < 0.7 ? 'high' : 'medium',
            message: check.details,
            timestamp: check.timestamp
        }));
        const recentAudits = this.auditTrail
            .filter(audit => !businessId || audit.businessId === businessId)
            .slice(-50);
        return {
            overallScore,
            checks,
            alerts,
            recentAudits
        };
    }
    async generateComplianceReport(businessId) {
        const transaction = SentryService_1.sentryService.startTransaction('compliance_report_generation', 'compliance.report', { businessId });
        try {
            const business = await models_1.Business.findById(businessId);
            if (!business) {
                throw new Error(`Business ${businessId} not found`);
            }
            const complianceData = this.getComplianceReport(businessId);
            const recentTransactions = await models_1.Transaction.find({
                businessId,
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });
            const taxAccuracy = {
                score: complianceData.overallScore,
                anomaliesDetected: complianceData.alerts.filter(a => a.type === 'anomaly').length,
                totalCalculations: recentTransactions.length
            };
            const businessFilings = Array.from(this.filingRequirements.values())
                .filter(f => f.businessId === businessId);
            const filingStatus = {
                upcomingFilings: businessFilings.filter(f => f.status === 'pending').length,
                overdueFilings: businessFilings.filter(f => f.status === 'overdue').length,
                totalTaxOwed: businessFilings.reduce((sum, f) => sum + f.taxOwed, 0)
            };
            const systemHealth = {
                posIntegrations: business.integrations?.pos?.map((integration) => ({
                    type: integration.type,
                    status: integration.status || 'unknown',
                    lastSync: integration.lastSync || null
                })) || [],
                redisPerformance: 'healthy',
                overallHealth: complianceData.overallScore > 0.9 ? 'healthy' :
                    complianceData.overallScore > 0.7 ? 'degraded' : 'unhealthy'
            };
            const report = {
                business: {
                    id: businessId,
                    name: business.name,
                    complianceScore: complianceData.overallScore
                },
                taxAccuracy,
                filingStatus,
                systemHealth
            };
            SentryService_1.sentryService.addBreadcrumb('compliance_report', 'Generated compliance report', 'info', {
                business_id: businessId,
                compliance_score: complianceData.overallScore,
                anomalies: taxAccuracy.anomaliesDetected,
                upcoming_filings: filingStatus.upcomingFilings
            });
            transaction.end();
            return report;
        }
        catch (error) {
            transaction.setAttribute('error', 'true');
            transaction.end();
            throw error;
        }
    }
    getAuditTrail(businessId, limit = 100) {
        return this.auditTrail
            .filter(audit => !businessId || audit.businessId === businessId)
            .slice(-limit);
    }
    clearAuditTrail(businessId) {
        if (businessId) {
            this.auditTrail = this.auditTrail.filter(audit => audit.businessId !== businessId);
        }
        else {
            this.auditTrail = [];
        }
        SentryService_1.sentryService.addBreadcrumb('audit_trail', businessId ? `Cleared audit trail for ${businessId}` : 'Cleared all audit trails', 'info');
    }
}
exports.ComplianceMonitoringService = ComplianceMonitoringService;
exports.complianceMonitoring = ComplianceMonitoringService.getInstance();
//# sourceMappingURL=ComplianceMonitoringService.js.map