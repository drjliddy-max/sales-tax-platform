"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentryService = exports.SentryService = void 0;
const Sentry = __importStar(require("@sentry/node"));
const config_1 = require("@/config");
const utils_1 = require("@/utils");
class SentryService {
    constructor() {
        this.isInitialized = false;
    }
    static getInstance() {
        if (!SentryService.instance) {
            SentryService.instance = new SentryService();
        }
        return SentryService.instance;
    }
    initialize() {
        if (this.isInitialized) {
            return;
        }
        if (!config_1.config.monitoring.sentryDsn) {
            utils_1.logger.warn('Sentry DSN not configured, monitoring disabled');
            return;
        }
        try {
            Sentry.init({
                dsn: config_1.config.monitoring.sentryDsn,
                environment: config_1.config.monitoring.sentryEnvironment,
                release: config_1.config.monitoring.sentryRelease,
                integrations: [
                    Sentry.httpIntegration(),
                    Sentry.expressIntegration(),
                    Sentry.mongooseIntegration()
                ],
                beforeSend: (event, hint) => {
                    return this.filterErrorEvent(event, hint);
                },
                tracesSampleRate: config_1.config.server.env === 'production' ? 0.1 : 1.0
            });
            this.isInitialized = true;
            utils_1.logger.info('Sentry initialized successfully', {
                environment: config_1.config.monitoring.sentryEnvironment,
                release: config_1.config.monitoring.sentryRelease
            });
        }
        catch (error) {
            utils_1.logger.error('Failed to initialize Sentry:', error);
            throw error;
        }
    }
    filterErrorEvent(event, hint) {
        if (config_1.config.server.env === 'development') {
            const error = hint?.originalException;
            if (error instanceof Error) {
                if (error.message.includes('ECONNREFUSED') && error.message.includes('redis')) {
                    return null;
                }
            }
        }
        if (event.extra) {
            delete event.extra.creditCardNumber;
            delete event.extra.ssn;
            delete event.extra.taxId;
            delete event.extra.bankAccount;
        }
        return event;
    }
    captureFinancialError(error, context) {
        return Sentry.withScope(scope => {
            scope.setTag('error_type', 'financial');
            scope.setTag('severity', context.severity || 'medium');
            if (context.businessId) {
                scope.setTag('business_id', context.businessId);
            }
            if (context.transactionId) {
                scope.setTag('transaction_id', context.transactionId);
            }
            if (context.jurisdiction) {
                scope.setTag('jurisdiction', context.jurisdiction);
            }
            if (context.calculationType) {
                scope.setTag('calculation_type', context.calculationType);
            }
            if (context.amount !== undefined) {
                scope.setTag('transaction_amount', context.amount.toString());
            }
            scope.setContext('financial_operation', context);
            return Sentry.captureException(error);
        });
    }
    addBreadcrumb(category, message, level = 'info', data) {
        Sentry.addBreadcrumb({
            category,
            message,
            level,
            data,
            timestamp: Date.now() / 1000
        });
    }
    captureMessage(message, level = 'info', context) {
        return Sentry.withScope(scope => {
            if (context) {
                scope.setContext('message_context', context);
                Object.entries(context).forEach(([key, value]) => {
                    scope.setTag(key, String(value));
                });
            }
            return Sentry.captureMessage(message, level);
        });
    }
    trackTaxCalculationAccuracy(data) {
        Sentry.withScope(scope => {
            scope.setTag('event_type', 'tax_calculation');
            scope.setTag('business_id', data.businessId);
            scope.setTag('jurisdiction', data.jurisdiction);
            scope.setTag('confidence_level', data.confidence > 0.9 ? 'high' : data.confidence > 0.7 ? 'medium' : 'low');
            scope.setContext('tax_calculation', {
                calculated_tax: data.calculatedTax,
                confidence: data.confidence,
                calculation_time: data.calculationTime,
                jurisdiction: data.jurisdiction
            });
            if (data.confidence < 0.7) {
                Sentry.captureMessage(`Low confidence tax calculation: ${data.confidence}`, data.confidence < 0.5 ? 'warning' : 'info');
            }
        });
    }
    trackPOSIntegrationHealth(data) {
        Sentry.withScope(scope => {
            scope.setTag('event_type', 'pos_integration');
            scope.setTag('integration_type', data.type);
            scope.setTag('business_id', data.businessId);
            scope.setTag('health_status', data.status);
            scope.setContext('pos_integration', {
                type: data.type,
                status: data.status,
                error_count: data.errorCount,
                response_time: data.responseTime,
                transactions_synced: data.transactionsSynced
            });
            if (data.status === 'failed' || data.errorCount > 0) {
                Sentry.captureMessage(`POS integration health issue: ${data.type} - ${data.status}`, data.status === 'failed' ? 'error' : 'warning');
            }
        });
    }
    trackRedisPerformance(data) {
        Sentry.withScope(scope => {
            scope.setTag('event_type', 'redis_performance');
            scope.setTag('operation', data.operation);
            scope.setTag('success', data.success.toString());
            scope.setContext('redis_operation', {
                operation: data.operation,
                latency: data.latency,
                success: data.success,
                error_message: data.error?.message
            });
            if (!data.success && data.error) {
                Sentry.captureException(data.error);
            }
            else if (data.latency > 1000) {
                Sentry.captureMessage(`Slow Redis operation: ${data.operation} took ${data.latency}ms`, 'warning');
            }
        });
    }
    trackComplianceWorkflow(data) {
        Sentry.withScope(scope => {
            scope.setTag('event_type', 'compliance_workflow');
            scope.setTag('workflow_type', data.type);
            scope.setTag('business_id', data.businessId);
            scope.setTag('jurisdiction', data.jurisdiction);
            scope.setTag('status', data.status);
            scope.setContext('compliance_workflow', {
                type: data.type,
                business_id: data.businessId,
                jurisdiction: data.jurisdiction,
                status: data.status,
                compliance_score: data.complianceScore
            });
            if (data.status === 'failed') {
                Sentry.captureMessage(`Compliance workflow failed: ${data.type} for ${data.businessId}`, 'error');
            }
        });
    }
    createComplianceAlert(alert) {
        return Sentry.withScope(scope => {
            scope.setTag('alert_type', alert.type);
            scope.setTag('severity', alert.severity);
            scope.setTag('business_id', alert.businessId);
            scope.setTag('jurisdiction', alert.jurisdiction);
            scope.setContext('compliance_alert', {
                type: alert.type,
                severity: alert.severity,
                business_id: alert.businessId,
                jurisdiction: alert.jurisdiction,
                metadata: alert.metadata,
                timestamp: alert.timestamp.toISOString()
            });
            const sentryLevel = alert.severity === 'critical' ? 'fatal' :
                alert.severity === 'high' ? 'error' :
                    alert.severity === 'medium' ? 'warning' : 'info';
            return Sentry.captureMessage(alert.message, sentryLevel);
        });
    }
    createCustomAlert(title, message, severity, metadata) {
        return Sentry.withScope(scope => {
            scope.setTag('alert_type', 'custom');
            scope.setTag('severity', severity);
            if (metadata) {
                scope.setContext('custom_alert', metadata);
                Object.entries(metadata).forEach(([key, value]) => {
                    scope.setTag(key, String(value));
                });
            }
            const sentryLevel = severity === 'critical' ? 'fatal' :
                severity === 'high' ? 'error' :
                    severity === 'medium' ? 'warning' : 'info';
            return Sentry.captureMessage(`${title}: ${message}`, sentryLevel);
        });
    }
    startTransaction(name, op, data) {
        const span = Sentry.startInactiveSpan({
            name,
            op
        });
        if (data) {
            Object.entries(data).forEach(([key, value]) => {
                span.setAttribute(key, String(value));
            });
        }
        return span;
    }
    createSpan(parentTransaction, operation, description) {
        return Sentry.startInactiveSpan({
            name: description,
            op: operation,
            parentSpan: parentTransaction
        });
    }
    setUserContext(user) {
        Sentry.setUser({
            id: user.id,
            email: user.email,
            username: user.id,
            segment: user.businessId,
            data: {
                business_id: user.businessId,
                role: user.role
            }
        });
    }
    async healthCheck() {
        try {
            const status = this.isInitialized ? 'healthy' : 'unhealthy';
            return {
                status,
                isInitialized: this.isInitialized,
                metricsCollected: 0,
                lastError: undefined
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                isInitialized: false,
                metricsCollected: 0,
                lastError: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async flush(timeout = 5000) {
        try {
            if (!this.isInitialized) {
                return false;
            }
            await Sentry.flush(timeout);
            return true;
        }
        catch (error) {
            utils_1.logger.error('Failed to flush Sentry events:', error);
            return false;
        }
    }
    getRequestHandler() {
        return Sentry.expressIntegration();
    }
    getTracingHandler() {
        return Sentry.expressIntegration();
    }
    getErrorHandler() {
        return Sentry.expressErrorHandler();
    }
    close() {
        return Sentry.close();
    }
}
exports.SentryService = SentryService;
exports.sentryService = SentryService.getInstance();
//# sourceMappingURL=SentryService.js.map