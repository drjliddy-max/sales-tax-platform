"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateContentType = exports.validateRequestSize = exports.validateBusinessAccess = exports.createUserRateLimit = exports.sanitizeInput = exports.commonSchemas = exports.validateSchema = exports.AppError = void 0;
const joi_1 = __importDefault(require("joi"));
class AppError extends Error {
    constructor(message, statusCode = 500, code, details, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const validateSchema = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', validationErrors));
        }
        req[property] = value;
        next();
    };
};
exports.validateSchema = validateSchema;
exports.commonSchemas = {
    pagination: joi_1.default.object({
        limit: joi_1.default.number().integer().min(1).max(100).default(50),
        offset: joi_1.default.number().integer().min(0).default(0),
        sortBy: joi_1.default.string().optional(),
        sortOrder: joi_1.default.string().valid('asc', 'desc').default('desc')
    }),
    dateRange: joi_1.default.object({
        startDate: joi_1.default.date().optional(),
        endDate: joi_1.default.date().optional()
    }).custom((value, helpers) => {
        if (value.startDate && value.endDate && value.startDate > value.endDate) {
            return helpers.error('custom.dateRange');
        }
        return value;
    }).messages({
        'custom.dateRange': 'startDate must be before endDate'
    }),
    businessId: joi_1.default.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
    mongoId: joi_1.default.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
    email: joi_1.default.string().email().required(),
    currency: joi_1.default.object({
        amount: joi_1.default.number().positive().required(),
        currency: joi_1.default.string().length(3).default('USD')
    }),
    address: joi_1.default.object({
        street: joi_1.default.string().required(),
        city: joi_1.default.string().required(),
        state: joi_1.default.string().length(2).required(),
        zipCode: joi_1.default.string().pattern(/^\d{5}(-\d{4})?$/).required(),
        country: joi_1.default.string().length(2).default('US')
    })
};
exports.sanitizeInput = {
    stripHtml: (str) => {
        return str.replace(/<[^>]*>/g, '');
    },
    normalizeEmail: (email) => {
        return email.toLowerCase().trim();
    },
    normalizePhone: (phone) => {
        return phone.replace(/\D/g, '');
    },
    capitalizeState: (state) => {
        return state.toUpperCase();
    },
    normalizeZipCode: (zipCode) => {
        return zipCode.replace(/\D/g, '').slice(0, 5);
    }
};
const createUserRateLimit = (windowMs, maxRequests) => {
    const userRequests = new Map();
    return (req, res, next) => {
        const userId = req.auth?.userId;
        if (!userId) {
            return next(new AppError('Authentication required for rate limiting', 401));
        }
        const now = Date.now();
        const userKey = userId;
        const userLimit = userRequests.get(userKey);
        if (!userLimit || now > userLimit.resetTime) {
            userRequests.set(userKey, {
                count: 1,
                resetTime: now + windowMs
            });
            return next();
        }
        if (userLimit.count >= maxRequests) {
            return next(new AppError('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED'));
        }
        userLimit.count++;
        next();
    };
};
exports.createUserRateLimit = createUserRateLimit;
const validateBusinessAccess = async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const clerkUserId = req.auth?.userId;
        if (!clerkUserId) {
            return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
        }
        if (!businessId) {
            return next(new AppError('Business ID is required', 400, 'BUSINESS_ID_REQUIRED'));
        }
        next();
    }
    catch (error) {
        next(new AppError('Failed to validate business access', 500, 'BUSINESS_ACCESS_VALIDATION_FAILED'));
    }
};
exports.validateBusinessAccess = validateBusinessAccess;
const validateRequestSize = (maxSizeKB = 1024) => {
    return (req, res, next) => {
        const contentLength = req.get('content-length');
        if (contentLength && parseInt(contentLength) > maxSizeKB * 1024) {
            return next(new AppError(`Request too large. Maximum size is ${maxSizeKB}KB`, 413, 'REQUEST_TOO_LARGE'));
        }
        next();
    };
};
exports.validateRequestSize = validateRequestSize;
const validateContentType = (allowedTypes = ['application/json']) => {
    return (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'DELETE') {
            const contentType = req.get('content-type');
            if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
                return next(new AppError(`Invalid content type. Allowed types: ${allowedTypes.join(', ')}`, 415, 'INVALID_CONTENT_TYPE'));
            }
        }
        next();
    };
};
exports.validateContentType = validateContentType;
//# sourceMappingURL=validation.js.map