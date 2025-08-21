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
exports.financialErrorBoundary = exports.performanceMonitoringMiddleware = exports.auditMiddleware = exports.financialOperationMiddleware = exports.businessContextMiddleware = exports.sentryErrorHandler = exports.sentryTracingHandler = exports.sentryRequestHandler = void 0;
const Sentry = __importStar(require("@sentry/node"));
const SentryService_1 = require("@/services/monitoring/SentryService");
const utils_1 = require("@/utils");
const sentryRequestHandler = () => {
    return (req, res, next) => {
        Sentry.withScope(scope => {
            scope.setTag('method', req.method);
            scope.setTag('url', req.url);
            scope.setContext('request', {
                method: req.method,
                url: req.url,
                user_agent: req.get('User-Agent'),
                ip: req.ip
            });
        });
        next();
    };
};
exports.sentryRequestHandler = sentryRequestHandler;
const sentryTracingHandler = () => {
    return (req, res, next) => {
        next();
    };
};
exports.sentryTracingHandler = sentryTracingHandler;
const sentryErrorHandler = () => {
    return (error, req, res, next) => {
        Sentry.captureException(error);
        next(error);
    };
};
exports.sentryErrorHandler = sentryErrorHandler;
const businessContextMiddleware = (req, res, next) => {
    try {
        const businessId = req.headers['x-business-id'] ||
            req.query.businessId ||
            req.session?.businessId ||
            req.user?.businessId;
        const userId = req.headers['x-user-id'] ||
            req.session?.userId ||
            req.user?.id;
        if (businessId) {
            req.businessId = businessId;
            SentryService_1.sentryService.setUserContext({
                id: userId || 'anonymous',
                businessId,
                email: req.user?.email,
                role: req.user?.role
            });
        }
        if (userId) {
            req.userId = userId;
        }
        next();
    }
    catch (error) {
        utils_1.logger.error('Error setting business context:', error);
        next();
    }
};
exports.businessContextMiddleware = businessContextMiddleware;
const financialOperationMiddleware = (operationType) => {
    return (req, res, next) => {
        try {
            const transaction = SentryService_1.sentryService.startTransaction(`${operationType}_${req.method.toLowerCase()}`, `financial.${operationType}`, {
                businessId: req.businessId,
                userId: req.userId,
                endpoint: req.path
            });
            req.sentryTransaction = transaction;
            SentryService_1.sentryService.addBreadcrumb('financial_operation', `${operationType}: ${req.method} ${req.path}`, 'info', {
                operation_type: operationType,
                method: req.method,
                path: req.path,
                business_id: req.businessId,
                user_id: req.userId
            });
            const originalJson = res.json;
            res.json = function (data) {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        if (data && typeof data === 'object') {
                            if (data.totalTax !== undefined) {
                                transaction.setAttribute('tax_amount', data.totalTax.toString());
                            }
                            if (data.subtotal !== undefined) {
                                transaction.setAttribute('transaction_amount', data.subtotal.toString());
                            }
                        }
                    }
                    transaction.setAttribute('status_code', res.statusCode.toString());
                    transaction.end();
                }
                catch (error) {
                    utils_1.logger.error('Error tracking financial operation response:', error);
                    transaction.setAttribute('error', 'true');
                    transaction.end();
                }
                return originalJson.call(this, data);
            };
            next();
        }
        catch (error) {
            utils_1.logger.error('Error in financial operation middleware:', error);
            next();
        }
    };
};
exports.financialOperationMiddleware = financialOperationMiddleware;
const auditMiddleware = (req, res, next) => {
    try {
        const originalJson = res.json;
        res.json = function (data) {
            try {
                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                    const auditEvent = {
                        entityType: extractEntityType(req.path),
                        entityId: req.params.id || 'unknown',
                        action: mapMethodToAction(req.method),
                        userId: req.userId,
                        businessId: req.businessId || 'system',
                        changes: req.method === 'DELETE' ? {} : req.body || {},
                        timestamp: new Date(),
                        ipAddress: req.ip,
                        jurisdiction: extractJurisdiction(req.body || {})
                    };
                }
            }
            catch (error) {
                utils_1.logger.error('Error logging audit event:', error);
            }
            return originalJson.call(this, data);
        };
        next();
    }
    catch (error) {
        utils_1.logger.error('Error in audit middleware:', error);
        next();
    }
};
exports.auditMiddleware = auditMiddleware;
const performanceMonitoringMiddleware = (req, res, next) => {
    const startTime = Date.now();
    res.on('finish', () => {
        try {
            const duration = Date.now() - startTime;
            if (duration > 5000) {
                SentryService_1.sentryService.captureMessage(`Slow request detected: ${req.method} ${req.path}`, 'warning', {
                    method: req.method,
                    path: req.path,
                    duration,
                    status_code: res.statusCode,
                    business_id: req.businessId
                });
            }
            if (req.path.includes('/tax/calculate') || req.path.includes('/transactions')) {
                SentryService_1.sentryService.addBreadcrumb('performance', `${req.method} ${req.path} - ${duration}ms`, duration > 2000 ? 'warning' : 'info', {
                    duration,
                    status_code: res.statusCode,
                    business_id: req.businessId
                });
            }
        }
        catch (error) {
            utils_1.logger.error('Error in performance monitoring:', error);
        }
    });
    next();
};
exports.performanceMonitoringMiddleware = performanceMonitoringMiddleware;
function extractEntityType(path) {
    if (path.includes('/transactions'))
        return 'transaction';
    if (path.includes('/tax') || path.includes('/rates'))
        return 'tax_rate';
    if (path.includes('/business'))
        return 'business';
    if (path.includes('/filing'))
        return 'filing';
    return 'transaction';
}
function mapMethodToAction(method) {
    switch (method) {
        case 'POST': return 'created';
        case 'PUT':
        case 'PATCH': return 'updated';
        case 'DELETE': return 'deleted';
        default: return 'calculated';
    }
}
function extractJurisdiction(body) {
    if (body?.address?.state) {
        return `${body.address.city || 'Unknown'}, ${body.address.state}`;
    }
    if (body?.state) {
        return body.state;
    }
    return undefined;
}
const financialErrorBoundary = (error, req, res, next) => {
    const isFinancialOperation = req.path.includes('/tax') ||
        req.path.includes('/transactions') ||
        req.path.includes('/pos') ||
        req.path.includes('/calculate');
    if (isFinancialOperation) {
        SentryService_1.sentryService.captureFinancialError(error, {
            businessId: req.businessId,
            transactionId: req.params.transactionId,
            severity: 'high'
        });
        res.status(500).json({
            error: 'Financial operation failed',
            message: 'A critical error occurred during financial processing',
            requestId: res.getHeader('X-Request-ID'),
            timestamp: new Date().toISOString(),
            support: 'Please contact support if this error persists'
        });
    }
    else {
        next(error);
    }
};
exports.financialErrorBoundary = financialErrorBoundary;
//# sourceMappingURL=sentry.js.map