import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { AppError, ApiError } from './validation';

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: any[];
    timestamp: string;
    path: string;
    requestId?: string;
  };
}

// Main error handler
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Set default error values
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: any[] = [];

  // Log error for debugging
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

  // Handle different error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'APP_ERROR';
    details = err.details || [];
  } else if (err instanceof PrismaClientKnownRequestError) {
    const prismaError = handlePrismaError(err);
    statusCode = prismaError.statusCode;
    message = prismaError.message;
    code = prismaError.code;
  } else if (err instanceof PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
    details = [{ field: 'general', message: 'Data validation failed' }];
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    // Handle Joi validation errors if needed
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
    code = 'INVALID_ID';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    code = 'TOKEN_EXPIRED';
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    error: {
      message,
      code,
      details: details.length > 0 ? details : undefined,
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId: req.get('x-request-id')
    }
  };

  // Don't expose sensitive information in production
  if (process.env.NODE_ENV === 'production') {
    // Remove stack trace and internal error details
    if (statusCode === 500) {
      errorResponse.error.message = 'Internal server error';
    }
  } else {
    // Include stack trace in development
    (errorResponse.error as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Handle Prisma-specific errors
function handlePrismaError(err: PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  code: string;
} {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      const target = err.meta?.target as string[] | undefined;
      const field = target?.[0] || 'field';
      return {
        statusCode: 409,
        message: `${field} already exists`,
        code: 'DUPLICATE_ENTRY'
      };

    case 'P2025':
      // Record not found
      return {
        statusCode: 404,
        message: 'Record not found',
        code: 'NOT_FOUND'
      };

    case 'P2003':
      // Foreign key constraint violation
      return {
        statusCode: 400,
        message: 'Referenced record does not exist',
        code: 'FOREIGN_KEY_VIOLATION'
      };

    case 'P2014':
      // Required relation missing
      return {
        statusCode: 400,
        message: 'Required relationship is missing',
        code: 'MISSING_RELATION'
      };

    case 'P2021':
      // Table does not exist
      return {
        statusCode: 500,
        message: 'Database configuration error',
        code: 'DATABASE_ERROR'
      };

    case 'P2024':
      // Connection timeout
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

// 404 handler for undefined routes
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Database connection error handler
export const handleDatabaseError = (err: Error): AppError => {
  if (err.message.includes('ECONNREFUSED')) {
    return new AppError(
      'Database connection failed',
      503,
      'DATABASE_CONNECTION_FAILED'
    );
  }
  
  if (err.message.includes('authentication failed')) {
    return new AppError(
      'Database authentication failed',
      503,
      'DATABASE_AUTH_FAILED'
    );
  }

  return new AppError(
    'Database operation failed',
    500,
    'DATABASE_ERROR'
  );
};

// Business logic error handlers
export const BusinessErrors = {
  NotFound: () => new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND'),
  AccessDenied: () => new AppError('Access denied to this business', 403, 'BUSINESS_ACCESS_DENIED'),
  InactiveAccount: () => new AppError('Business account is inactive', 403, 'BUSINESS_INACTIVE'),
  InvalidNexus: (state: string) => new AppError(
    `Business does not have nexus in ${state}`,
    400,
    'INVALID_NEXUS'
  )
};

export const TransactionErrors = {
  NotFound: () => new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND'),
  InvalidAmount: () => new AppError('Transaction amount must be positive', 400, 'INVALID_AMOUNT'),
  RefundExceedsOriginal: () => new AppError(
    'Refund amount cannot exceed original transaction amount',
    400,
    'REFUND_EXCEEDS_ORIGINAL'
  ),
  AlreadyRefunded: () => new AppError(
    'Transaction has already been fully refunded',
    400,
    'ALREADY_REFUNDED'
  ),
  TaxCalculationFailed: () => new AppError(
    'Failed to calculate tax for transaction',
    500,
    'TAX_CALCULATION_FAILED'
  )
};

export const IntegrationErrors = {
  NotFound: () => new AppError('Integration not found', 404, 'INTEGRATION_NOT_FOUND'),
  ConnectionFailed: (provider: string) => new AppError(
    `Failed to connect to ${provider}`,
    400,
    'INTEGRATION_CONNECTION_FAILED'
  ),
  SyncInProgress: () => new AppError(
    'Sync operation already in progress',
    409,
    'SYNC_IN_PROGRESS'
  ),
  InvalidCredentials: (provider: string) => new AppError(
    `Invalid credentials for ${provider}`,
    401,
    'INVALID_CREDENTIALS'
  ),
  WebhookVerificationFailed: () => new AppError(
    'Webhook signature verification failed',
    401,
    'WEBHOOK_VERIFICATION_FAILED'
  )
};

export const AuthErrors = {
  Unauthorized: () => new AppError('Authentication required', 401, 'UNAUTHORIZED'),
  Forbidden: () => new AppError('Access forbidden', 403, 'FORBIDDEN'),
  InvalidToken: () => new AppError('Invalid authentication token', 401, 'INVALID_TOKEN'),
  TokenExpired: () => new AppError('Authentication token expired', 401, 'TOKEN_EXPIRED'),
  UserNotFound: () => new AppError('User not found', 404, 'USER_NOT_FOUND')
};

// Request timeout handler
export const timeoutHandler = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = new AppError(
          'Request timeout',
          408,
          'REQUEST_TIMEOUT'
        );
        next(error);
      }
    }, timeoutMs);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
};