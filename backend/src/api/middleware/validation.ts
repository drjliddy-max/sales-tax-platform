import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: ValidationError[];
  isOperational: boolean;
}

export class AppError extends Error implements ApiError {
  public statusCode: number;
  public code?: string;
  public details?: ValidationError[];
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: ValidationError[],
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation middleware factory
export const validateSchema = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return next(new AppError(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        validationErrors
      ));
    }

    // Replace request property with validated and sanitized value
    req[property] = value;
    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  dateRange: Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional()
  }).custom((value, helpers) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      return helpers.error('custom.dateRange');
    }
    return value;
  }).messages({
    'custom.dateRange': 'startDate must be before endDate'
  }),

  businessId: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).required(),
  
  mongoId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  
  email: Joi.string().email().required(),
  
  currency: Joi.object({
    amount: Joi.number().positive().required(),
    currency: Joi.string().length(3).default('USD')
  }),

  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().length(2).required(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/).required(),
    country: Joi.string().length(2).default('US')
  })
};

// Sanitization helpers
export const sanitizeInput = {
  stripHtml: (str: string): string => {
    return str.replace(/<[^>]*>/g, '');
  },

  normalizeEmail: (email: string): string => {
    return email.toLowerCase().trim();
  },

  normalizePhone: (phone: string): string => {
    return phone.replace(/\D/g, '');
  },

  capitalizeState: (state: string): string => {
    return state.toUpperCase();
  },

  normalizeZipCode: (zipCode: string): string => {
    return zipCode.replace(/\D/g, '').slice(0, 5);
  }
};

// Rate limiting by user ID
export const createUserRateLimit = (windowMs: number, maxRequests: number) => {
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: any, res: Response, next: NextFunction) => {
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
      return next(new AppError(
        'Too many requests. Please try again later.',
        429,
        'RATE_LIMIT_EXCEEDED'
      ));
    }

    userLimit.count++;
    next();
  };
};

// Business access validation
export const validateBusinessAccess = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    }

    if (!businessId) {
      return next(new AppError('Business ID is required', 400, 'BUSINESS_ID_REQUIRED'));
    }

    // This would be implemented in each route - keeping as a template
    next();
  } catch (error) {
    next(new AppError('Failed to validate business access', 500, 'BUSINESS_ACCESS_VALIDATION_FAILED'));
  }
};

// Request size validation
export const validateRequestSize = (maxSizeKB: number = 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSizeKB * 1024) {
      return next(new AppError(
        `Request too large. Maximum size is ${maxSizeKB}KB`,
        413,
        'REQUEST_TOO_LARGE'
      ));
    }
    next();
  };
};

// Content type validation
export const validateContentType = (allowedTypes: string[] = ['application/json']) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      const contentType = req.get('content-type');
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return next(new AppError(
          `Invalid content type. Allowed types: ${allowedTypes.join(', ')}`,
          415,
          'INVALID_CONTENT_TYPE'
        ));
      }
    }
    next();
  };
};