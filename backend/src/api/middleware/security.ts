import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError } from './validation';
import prisma from '@/lib/prisma';

// IP-based rate limiting
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
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

// Different rate limits for different endpoints
export const rateLimits = {
  // General API rate limit
  api: createRateLimit(15 * 60 * 1000, 1000), // 1000 requests per 15 minutes
  
  // Authentication endpoints
  auth: createRateLimit(15 * 60 * 1000, 50, 'Too many authentication attempts'), // 50 per 15 minutes
  
  // Transaction creation (more restrictive)
  transactions: createRateLimit(60 * 1000, 30), // 30 transactions per minute
  
  // Report generation
  reports: createRateLimit(60 * 60 * 1000, 10), // 10 reports per hour
  
  // Webhook endpoints
  webhooks: createRateLimit(60 * 1000, 100), // 100 webhooks per minute
  
  // Tax calculation (for previews)
  taxCalculation: createRateLimit(60 * 1000, 100) // 100 calculations per minute
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server identification
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
};

// Request ID middleware for tracking
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.get('x-request-id') || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

// SQL injection protection for query parameters
export const sqlInjectionProtection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /('|(\\')|(;)|(\\;))/gi,
    /((\s|%20)+(or|and|union|select|insert|update|delete|drop|create|alter|exec|execute)(\s|%20)+)/gi,
    /(script\s*(<|&lt;))/gi
  ];

  const checkForSQLInjection = (obj: any, path: string = ''): boolean => {
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

  // Check query parameters, body, and params
  const suspicious = [
    checkForSQLInjection(req.query, 'query'),
    checkForSQLInjection(req.body, 'body'),
    checkForSQLInjection(req.params, 'params')
  ].some(Boolean);

  if (suspicious) {
    return next(new AppError(
      'Invalid characters detected in request',
      400,
      'INVALID_INPUT'
    ));
  }

  next();
};

// XSS protection for request data
export const xssProtection = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      return xssPatterns.reduce((str, pattern) => str.replace(pattern, ''), value);
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = Array.isArray(value) ? [] : {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  };

  // Sanitize request data
  req.body = sanitizeValue(req.body);
  req.query = sanitizeValue(req.query);
  
  next();
};

// Business ownership validation middleware
export const requireBusinessOwnership = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { businessId } = req.params;
    const clerkUserId = req.auth?.userId;

    if (!clerkUserId) {
      return next(new AppError('Authentication required', 401, 'AUTHENTICATION_REQUIRED'));
    }

    if (!businessId) {
      return next(new AppError('Business ID is required', 400, 'BUSINESS_ID_REQUIRED'));
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
    }

    const business = await prisma.business.findUnique({
      where: {
        id: businessId,
        ownerId: user.id,
        isActive: true
      },
      select: { id: true, name: true }
    });

    if (!business) {
      return next(new AppError('Business not found or access denied', 404, 'BUSINESS_NOT_FOUND'));
    }

    // Add business to request for downstream use
    req.business = business;
    req.userId = user.id;
    
    next();
  } catch (error) {
    next(new AppError('Failed to validate business ownership', 500, 'OWNERSHIP_VALIDATION_FAILED'));
  }
};

// Audit logging middleware
export const auditLogger = (action: string, entityType: string) => {
  return async (req: any, res: Response, next: NextFunction) => {
    const originalSend = res.json;
    
    res.json = function(body: any) {
      // Log successful operations
      if (res.statusCode < 400 && req.userId) {
        setImmediate(async () => {
          try {
            await prisma.auditLog.create({
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
          } catch (error) {
            console.error('Audit logging failed:', error);
          }
        });
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = Array.isArray(obj) ? [] : {};
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

// CORS configuration
export const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? (process.env.ALLOWED_ORIGINS || '').split(',')
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
    
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new AppError('Not allowed by CORS', 403, 'CORS_BLOCKED'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  exposedHeaders: ['x-request-id', 'x-total-count']
};

// Generate request ID
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Environment validation
export const validateEnvironment = () => {
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

// Health check with database connectivity
export const healthCheck = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
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
  } catch (error) {
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        api: 'running'
      },
      error: process.env.NODE_ENV === 'production' ? 'Service unavailable' : (error as Error).message
    };

    res.status(503).json(health);
  }
};