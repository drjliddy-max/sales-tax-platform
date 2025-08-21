"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.validateEnvironment = exports.corsOptions = exports.sanitizeInput = exports.auditLogger = exports.requireBusinessOwnership = exports.xssProtection = exports.sqlInjectionProtection = exports.requestId = exports.securityHeaders = exports.rateLimits = exports.createRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const validation_1 = require("./validation");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const createRateLimit = (windowMs, max, message) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        message: {
            error: message || 'Too many requests from this IP, please try again later.',
            retryAfter: windowMs / 1000
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: {
                    message: message || 'Too many requests from this IP, please try again later.',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: windowMs / 1000,
                    timestamp: new Date().toISOString()
                }
            });
        }
    });
};
exports.createRateLimit = createRateLimit;
exports.rateLimits = {
    api: (0, exports.createRateLimit)(15 * 60 * 1000, 1000),
    auth: (0, exports.createRateLimit)(15 * 60 * 1000, 50, 'Too many authentication attempts'),
    transactions: (0, exports.createRateLimit)(60 * 1000, 30),
    reports: (0, exports.createRateLimit)(60 * 60 * 1000, 10),
    webhooks: (0, exports.createRateLimit)(60 * 1000, 100),
    taxCalculation: (0, exports.createRateLimit)(60 * 1000, 100)
};
const securityHeaders = (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
};
exports.securityHeaders = securityHeaders;
const requestId = (req, res, next) => {
    const requestId = req.get('x-request-id') || generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
};
exports.requestId = requestId;
const sqlInjectionProtection = (req, res, next) => {
    const sqlPatterns = [
        /('|(\\')|(;)|(\\;))/gi,
        /((\s|%20)+(or|and|union|select|insert|update|delete|drop|create|alter|exec|execute)(\s|%20)+)/gi,
        /(script\s*(<|&lt;))/gi
    ];
    const checkForSQLInjection = (obj, path = '') => {
        if (typeof obj === 'string') {
            return sqlPatterns.some(pattern => pattern.test(obj));
        }
        if (obj && typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj)) {
                if (checkForSQLInjection(value, `${path}.${key}`)) {
                    return true;
                }
            }
        }
        return false;
    };
    const suspicious = [
        checkForSQLInjection(req.query, 'query'),
        checkForSQLInjection(req.body, 'body'),
        checkForSQLInjection(req.params, 'params')
    ].some(Boolean);
    if (suspicious) {
        return next(new validation_1.AppError('Invalid characters detected in request', 400, 'INVALID_INPUT'));
    }
    next();
};
exports.sqlInjectionProtection = sqlInjectionProtection;
const xssProtection = (req, res, next) => {
    const xssPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
    ];
    const sanitizeValue = (value) => {
        if (typeof value === 'string') {
            return xssPatterns.reduce((str, pattern) => str.replace(pattern, ''), value);
        }
        if (value && typeof value === 'object') {
            const sanitized = Array.isArray(value) ? [] : {};
            for (const [key, val] of Object.entries(value)) {
                sanitized[key] = sanitizeValue(val);
            }
            return sanitized;
        }
        return value;
    };
    req.body = sanitizeValue(req.body);
    req.query = sanitizeValue(req.query);
    next();
};
exports.xssProtection = xssProtection;
const requireBusinessOwnership = async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            return next(new validation_1.AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
        }
        if (!businessId) {
            return next(new validation_1.AppError('Business ID is required', 400, 'BUSINESS_ID_REQUIRED'));
        }
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return next(new validation_1.AppError('User not found', 404, 'USER_NOT_FOUND'));
        }
        const business = await prisma_1.default.business.findUnique({
            where: {
                id: businessId,
                ownerId: user.id,
                isActive: true
            },
            select: { id: true, name: true }
        });
        if (!business) {
            return next(new validation_1.AppError('Business not found or access denied', 404, 'BUSINESS_NOT_FOUND'));
        }
        req.business = business;
        req.userId = user.id;
        next();
    }
    catch (error) {
        next(new validation_1.AppError('Failed to validate business ownership', 500, 'OWNERSHIP_VALIDATION_FAILED'));
    }
};
exports.requireBusinessOwnership = requireBusinessOwnership;
const auditLogger = (action, entityType) => {
    return async (req, res, next) => {
        const originalSend = res.json;
        res.json = function (body) {
            if (res.statusCode < 400 && req.userId) {
                setImmediate(async () => {
                    try {
                        await prisma_1.default.auditLog.create({
                            data: {
                                action,
                                entityType,
                                entityId: req.params.id || req.params.businessId || 'unknown',
                                newValues: action === 'CREATE' ? body : undefined,
                                oldValues: action === 'DELETE' ? req.originalData : undefined,
                                metadata: {
                                    method: req.method,
                                    path: req.path,
                                    statusCode: res.statusCode
                                },
                                userId: req.userId,
                                ipAddress: req.ip,
                                userAgent: req.get('User-Agent')
                            }
                        });
                    }
                    catch (error) {
                        console.error('Audit logging failed:', error);
                    }
                });
            }
            return originalSend.call(this, body);
        };
        next();
    };
};
exports.auditLogger = auditLogger;
const sanitizeInput = (req, res, next) => {
    const sanitizeString = (str) => {
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim();
    };
    const sanitizeObject = (obj) => {
        if (typeof obj === 'string') {
            return sanitizeString(obj);
        }
        if (obj && typeof obj === 'object') {
            const sanitized = Array.isArray(obj) ? [] : {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = sanitizeObject(value);
            }
            return sanitized;
        }
        return obj;
    };
    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    next();
};
exports.sanitizeInput = sanitizeInput;
exports.corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.NODE_ENV === 'production'
            ? (process.env.ALLOWED_ORIGINS || '').split(',')
            : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new validation_1.AppError('Not allowed by CORS', 403, 'CORS_BLOCKED'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'x-total-count']
};
function generateRequestId() {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}
const validateEnvironment = () => {
    const requiredEnvVars = [
        'DATABASE_URL',
        'CLERK_SECRET_KEY',
        'NODE_ENV'
    ];
    const missing = requiredEnvVars.filter(env => !process.env[env]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
};
exports.validateEnvironment = validateEnvironment;
const healthCheck = async (req, res, next) => {
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'connected',
                api: 'running'
            },
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        };
        res.json(health);
    }
    catch (error) {
        const health = {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            services: {
                database: 'disconnected',
                api: 'running'
            },
            error: process.env.NODE_ENV === 'production' ? 'Service unavailable' : error.message
        };
        res.status(503).json(health);
    }
};
exports.healthCheck = healthCheck;
//# sourceMappingURL=security.js.map