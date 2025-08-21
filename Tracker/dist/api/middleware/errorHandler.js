"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeoutHandler = exports.AuthErrors = exports.IntegrationErrors = exports.TransactionErrors = exports.BusinessErrors = exports.handleDatabaseError = exports.asyncHandler = exports.notFoundHandler = exports.errorHandler = void 0;
const library_1 = require("@prisma/client/runtime/library");
const validation_1 = require("./validation");
const errorHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details = [];
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
        headers: {
            'user-agent': req.get('user-agent'),
            'content-type': req.get('content-type')
        }
    });
    if (err instanceof validation_1.AppError) {
        statusCode = err.statusCode;
        message = err.message;
        code = err.code || 'APP_ERROR';
        details = err.details || [];
    }
    else if (err instanceof library_1.PrismaClientKnownRequestError) {
        const prismaError = handlePrismaError(err);
        statusCode = prismaError.statusCode;
        message = prismaError.message;
        code = prismaError.code;
    }
    else if (err instanceof library_1.PrismaClientValidationError) {
        statusCode = 400;
        message = 'Invalid data provided';
        code = 'VALIDATION_ERROR';
        details = [{ field: 'general', message: 'Data validation failed' }];
    }
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
        code = 'VALIDATION_ERROR';
    }
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid ID format';
        code = 'INVALID_ID';
    }
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token';
        code = 'INVALID_TOKEN';
    }
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token expired';
        code = 'TOKEN_EXPIRED';
    }
    const errorResponse = {
        error: {
            message,
            code,
            details: details.length > 0 ? details : undefined,
            timestamp: new Date().toISOString(),
            path: req.path,
            requestId: req.get('x-request-id')
        }
    };
    if (process.env.NODE_ENV === 'production') {
        if (statusCode === 500) {
            errorResponse.error.message = 'Internal server error';
        }
    }
    else {
        errorResponse.error.stack = err.stack;
    }
    res.status(statusCode).json(errorResponse);
};
exports.errorHandler = errorHandler;
function handlePrismaError(err) {
    switch (err.code) {
        case 'P2002':
            const target = err.meta?.target;
            const field = target?.[0] || 'field';
            return {
                statusCode: 409,
                message: `${field} already exists`,
                code: 'DUPLICATE_ENTRY'
            };
        case 'P2025':
            return {
                statusCode: 404,
                message: 'Record not found',
                code: 'NOT_FOUND'
            };
        case 'P2003':
            return {
                statusCode: 400,
                message: 'Referenced record does not exist',
                code: 'FOREIGN_KEY_VIOLATION'
            };
        case 'P2014':
            return {
                statusCode: 400,
                message: 'Required relationship is missing',
                code: 'MISSING_RELATION'
            };
        case 'P2021':
            return {
                statusCode: 500,
                message: 'Database configuration error',
                code: 'DATABASE_ERROR'
            };
        case 'P2024':
            return {
                statusCode: 503,
                message: 'Database connection timeout',
                code: 'DATABASE_TIMEOUT'
            };
        default:
            return {
                statusCode: 500,
                message: 'Database operation failed',
                code: 'DATABASE_ERROR'
            };
    }
}
const notFoundHandler = (req, res, next) => {
    const error = new validation_1.AppError(`Route ${req.method} ${req.path} not found`, 404, 'ROUTE_NOT_FOUND');
    next(error);
};
exports.notFoundHandler = notFoundHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const handleDatabaseError = (err) => {
    if (err.message.includes('ECONNREFUSED')) {
        return new validation_1.AppError('Database connection failed', 503, 'DATABASE_CONNECTION_FAILED');
    }
    if (err.message.includes('authentication failed')) {
        return new validation_1.AppError('Database authentication failed', 503, 'DATABASE_AUTH_FAILED');
    }
    return new validation_1.AppError('Database operation failed', 500, 'DATABASE_ERROR');
};
exports.handleDatabaseError = handleDatabaseError;
exports.BusinessErrors = {
    NotFound: () => new validation_1.AppError('Business not found', 404, 'BUSINESS_NOT_FOUND'),
    AccessDenied: () => new validation_1.AppError('Access denied to this business', 403, 'BUSINESS_ACCESS_DENIED'),
    InactiveAccount: () => new validation_1.AppError('Business account is inactive', 403, 'BUSINESS_INACTIVE'),
    InvalidNexus: (state) => new validation_1.AppError(`Business does not have nexus in ${state}`, 400, 'INVALID_NEXUS')
};
exports.TransactionErrors = {
    NotFound: () => new validation_1.AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND'),
    InvalidAmount: () => new validation_1.AppError('Transaction amount must be positive', 400, 'INVALID_AMOUNT'),
    RefundExceedsOriginal: () => new validation_1.AppError('Refund amount cannot exceed original transaction amount', 400, 'REFUND_EXCEEDS_ORIGINAL'),
    AlreadyRefunded: () => new validation_1.AppError('Transaction has already been fully refunded', 400, 'ALREADY_REFUNDED'),
    TaxCalculationFailed: () => new validation_1.AppError('Failed to calculate tax for transaction', 500, 'TAX_CALCULATION_FAILED')
};
exports.IntegrationErrors = {
    NotFound: () => new validation_1.AppError('Integration not found', 404, 'INTEGRATION_NOT_FOUND'),
    ConnectionFailed: (provider) => new validation_1.AppError(`Failed to connect to ${provider}`, 400, 'INTEGRATION_CONNECTION_FAILED'),
    SyncInProgress: () => new validation_1.AppError('Sync operation already in progress', 409, 'SYNC_IN_PROGRESS'),
    InvalidCredentials: (provider) => new validation_1.AppError(`Invalid credentials for ${provider}`, 401, 'INVALID_CREDENTIALS'),
    WebhookVerificationFailed: () => new validation_1.AppError('Webhook signature verification failed', 401, 'WEBHOOK_VERIFICATION_FAILED')
};
exports.AuthErrors = {
    Unauthorized: () => new validation_1.AppError('Authentication required', 401, 'UNAUTHORIZED'),
    Forbidden: () => new validation_1.AppError('Access forbidden', 403, 'FORBIDDEN'),
    InvalidToken: () => new validation_1.AppError('Invalid authentication token', 401, 'INVALID_TOKEN'),
    TokenExpired: () => new validation_1.AppError('Authentication token expired', 401, 'TOKEN_EXPIRED'),
    UserNotFound: () => new validation_1.AppError('User not found', 404, 'USER_NOT_FOUND')
};
const timeoutHandler = (timeoutMs = 30000) => {
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                const error = new validation_1.AppError('Request timeout', 408, 'REQUEST_TIMEOUT');
                next(error);
            }
        }, timeoutMs);
        res.on('finish', () => clearTimeout(timeout));
        res.on('close', () => clearTimeout(timeout));
        next();
    };
};
exports.timeoutHandler = timeoutHandler;
//# sourceMappingURL=errorHandler.js.map