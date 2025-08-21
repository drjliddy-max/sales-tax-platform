"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posMonitoring = exports.POSMonitoringService = void 0;
const SentryService_1 = require("./SentryService");
const utils_1 = require("@/utils");
class POSMonitoringService {
    constructor() {
        this.integrationMetrics = new Map();
        this.alertCooldowns = new Map();
    }
    static getInstance() {
        if (!POSMonitoringService.instance) {
            POSMonitoringService.instance = new POSMonitoringService();
        }
        return POSMonitoringService.instance;
    }
    trackPOSEvent(event) {
        const startTime = Date.now();
        const transaction = SentryService_1.sentryService.startTransaction(`pos_${event.operation}`, 'integration.pos', {
            businessId: event.businessId,
            integrationType: event.type,
            operation: event.operation
        });
        try {
            SentryService_1.sentryService.trackPOSIntegrationHealth({
                type: event.type,
                businessId: event.businessId,
                status: this.mapEventStatusToHealth(event.status),
                errorCount: event.status === 'failed' ? 1 : 0,
                responseTime: event.duration,
                transactionsSynced: event.recordCount
            });
            this.updateIntegrationMetrics(event);
            this.checkPOSAlerts(event);
            SentryService_1.sentryService.addBreadcrumb('pos_integration', `${event.type} ${event.operation}: ${event.status}`, event.status === 'failed' ? 'error' : 'info', {
                integration_type: event.type,
                operation: event.operation,
                duration: event.duration,
                record_count: event.recordCount
            });
            transaction.setAttribute('integration_type', event.type);
            transaction.setAttribute('operation', event.operation);
            transaction.setAttribute('status', event.status);
            transaction.end();
        }
        catch (error) {
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('POS monitoring error'), {
                businessId: event.businessId,
                severity: 'medium'
            });
            transaction.setAttribute('error', 'true');
            transaction.end();
        }
    }
    mapEventStatusToHealth(status) {
        switch (status) {
            case 'success': return 'healthy';
            case 'partial': return 'degraded';
            case 'failed': return 'failed';
            default: return 'degraded';
        }
    }
    updateIntegrationMetrics(event) {
        const key = `${event.businessId}_${event.type}`;
        const existing = this.integrationMetrics.get(key) || {
            integrationId: key,
            type: event.type,
            businessId: event.businessId,
            isConnected: false,
            errorRate: 0,
            avgResponseTime: 0,
            totalTransactions: 0,
            failedTransactions: 0,
            uptime: 100
        };
        existing.isConnected = event.status !== 'failed';
        existing.totalTransactions += event.recordCount || 1;
        if (event.status === 'failed') {
            existing.failedTransactions++;
        }
        existing.errorRate = existing.failedTransactions / existing.totalTransactions;
        existing.avgResponseTime = (existing.avgResponseTime + event.duration) / 2;
        if (event.status === 'success') {
            existing.lastSuccessfulSync = new Date();
        }
        this.integrationMetrics.set(key, existing);
    }
    checkPOSAlerts(event) {
        const alertKey = `${event.businessId}_${event.type}`;
        const lastAlert = this.alertCooldowns.get(alertKey);
        const now = new Date();
        if (lastAlert && (now.getTime() - lastAlert.getTime()) < 15 * 60 * 1000) {
            return;
        }
        const metrics = this.integrationMetrics.get(alertKey);
        if (!metrics) {
            return;
        }
        if (metrics.errorRate > 0.1 && metrics.totalTransactions > 10) {
            SentryService_1.sentryService.createComplianceAlert({
                type: 'threshold',
                severity: metrics.errorRate > 0.25 ? 'critical' : 'high',
                businessId: event.businessId,
                jurisdiction: 'POS Integration',
                message: `${event.type} integration error rate is ${(metrics.errorRate * 100).toFixed(1)}%`,
                metadata: {
                    integration_type: event.type,
                    error_rate: metrics.errorRate,
                    total_transactions: metrics.totalTransactions,
                    failed_transactions: metrics.failedTransactions
                },
                timestamp: now
            });
            this.alertCooldowns.set(alertKey, now);
        }
        if (!metrics.isConnected) {
            SentryService_1.sentryService.createComplianceAlert({
                type: 'threshold',
                severity: 'high',
                businessId: event.businessId,
                jurisdiction: 'POS Integration',
                message: `${event.type} integration connection failed`,
                metadata: {
                    integration_type: event.type,
                    last_successful_sync: metrics.lastSuccessfulSync?.toISOString(),
                    operation: event.operation
                },
                timestamp: now
            });
            this.alertCooldowns.set(alertKey, now);
        }
    }
    async monitorPOSWebhook(webhookData) {
        const transaction = SentryService_1.sentryService.startTransaction(`pos_webhook_${webhookData.source}`, 'integration.webhook', {
            businessId: webhookData.businessId,
            source: webhookData.source,
            eventType: webhookData.eventType
        });
        try {
            this.trackPOSEvent({
                type: webhookData.source,
                businessId: webhookData.businessId,
                operation: 'webhook',
                status: webhookData.success ? 'success' : 'failed',
                duration: webhookData.processingTime,
                recordCount: 1,
                errorDetails: webhookData.errorMessage,
                metadata: {
                    event_type: webhookData.eventType
                }
            });
            if (!webhookData.success) {
                SentryService_1.sentryService.captureFinancialError(new Error(`POS webhook processing failed: ${webhookData.errorMessage}`), {
                    businessId: webhookData.businessId,
                    severity: 'medium'
                });
            }
            transaction.setAttribute('webhook_event', webhookData.eventType);
            transaction.setAttribute('success', webhookData.success.toString());
            transaction.end();
        }
        catch (error) {
            transaction.setAttribute('error', 'true');
            transaction.end();
            throw error;
        }
    }
    getPOSIntegrationMetrics(businessId) {
        const metrics = [];
        for (const [key, metric] of this.integrationMetrics.entries()) {
            if (metric.businessId === businessId) {
                metrics.push(metric);
            }
        }
        return metrics;
    }
    getAllPOSMetrics() {
        return new Map(this.integrationMetrics);
    }
    async generatePOSHealthReport() {
        const integrations = Array.from(this.integrationMetrics.values());
        const summary = {
            totalIntegrations: integrations.length,
            healthyIntegrations: integrations.filter(i => i.isConnected && i.errorRate < 0.05).length,
            degradedIntegrations: integrations.filter(i => i.isConnected && i.errorRate >= 0.05).length,
            failedIntegrations: integrations.filter(i => !i.isConnected).length
        };
        const alerts = integrations
            .filter(i => !i.isConnected || i.errorRate > 0.1)
            .map(i => ({
            businessId: i.businessId,
            type: i.type,
            severity: i.isConnected ? 'medium' : 'high',
            message: i.isConnected
                ? `High error rate: ${(i.errorRate * 100).toFixed(1)}%`
                : 'Integration disconnected'
        }));
        SentryService_1.sentryService.addBreadcrumb('pos_health_report', `POS Health: ${summary.healthyIntegrations}/${summary.totalIntegrations} healthy`, summary.failedIntegrations > 0 ? 'error' : 'info', summary);
        return {
            summary,
            integrations,
            alerts
        };
    }
    resetMetrics(businessId) {
        if (businessId) {
            const keysToDelete = Array.from(this.integrationMetrics.keys())
                .filter(key => key.startsWith(businessId));
            keysToDelete.forEach(key => {
                this.integrationMetrics.delete(key);
                this.alertCooldowns.delete(key);
            });
            utils_1.logger.info(`Reset POS metrics for business: ${businessId}`);
        }
        else {
            this.integrationMetrics.clear();
            this.alertCooldowns.clear();
            utils_1.logger.info('Reset all POS metrics');
        }
        SentryService_1.sentryService.addBreadcrumb('pos_metrics', businessId ? `Reset metrics for ${businessId}` : 'Reset all metrics', 'info');
    }
}
exports.POSMonitoringService = POSMonitoringService;
exports.posMonitoring = POSMonitoringService.getInstance();
//# sourceMappingURL=POSMonitoringService.js.map