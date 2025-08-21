import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { sentryService } from '@/services/monitoring/SentryService';
// import { complianceMonitoring } from '@/services/monitoring/ComplianceMonitoringService'; // Temporarily disabled
import { logger } from '@/utils';

// Extend Request interface to include business context
declare global {
  namespace Express {
    interface Request {
      businessId?: string;
      userId?: string;
      sentryTransaction?: any;
    }
  }
}

export const sentryRequestHandler = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Simple request tracking without complex Sentry handlers
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

export const sentryTracingHandler = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Simple tracing without complex handlers
    next();
  };
};

export const sentryErrorHandler = () => {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    // Capture error in Sentry
    Sentry.captureException(error);
    next(error);
  };
};

export const businessContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Extract business context from various sources
    const businessId = req.headers['x-business-id'] as string ||
                      req.query.businessId as string ||
                      (req as any).session?.businessId ||
                      (req as any).user?.businessId;

    const userId = req.headers['x-user-id'] as string ||
                   (req as any).session?.userId ||
                   (req as any).user?.id;

    // Set business context for the request
    if (businessId) {
      req.businessId = businessId;
      sentryService.setUserContext({
        id: userId || 'anonymous',
        businessId,
        email: (req as any).user?.email,
        role: (req as any).user?.role
      });
    }

    if (userId) {
      req.userId = userId;
    }

    next();
  } catch (error) {
    logger.error('Error setting business context:', error);
    next(); // Continue without context
  }
};

export const financialOperationMiddleware = (operationType: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Start transaction for financial operations
      const transaction = sentryService.startTransaction(
        `${operationType}_${req.method.toLowerCase()}`,
        `financial.${operationType}`,
        {
          businessId: req.businessId,
          userId: req.userId,
          endpoint: req.path
        }
      );

      req.sentryTransaction = transaction;

      // Track request details
      sentryService.addBreadcrumb(
        'financial_operation',
        `${operationType}: ${req.method} ${req.path}`,
        'info',
        {
          operation_type: operationType,
          method: req.method,
          path: req.path,
          business_id: req.businessId,
          user_id: req.userId
        }
      );

      // Override res.json to capture response data
      const originalJson = res.json;
      res.json = function(data: any) {
        try {
          // Track successful financial operation
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Extract financial metrics from response
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

        } catch (error) {
          logger.error('Error tracking financial operation response:', error);
          transaction.setAttribute('error', 'true');
          transaction.end();
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Error in financial operation middleware:', error);
      next();
    }
  };
};

export const auditMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Capture the original request data for audit logging
    const originalJson = res.json;
    res.json = function(data: any) {
      try {
        // Log audit trail for state-changing operations
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

          // complianceMonitoring.logAuditEvent(auditEvent); // Temporarily disabled
        }
      } catch (error) {
        logger.error('Error logging audit event:', error);
      }

      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    logger.error('Error in audit middleware:', error);
    next();
  }
};

export const performanceMonitoringMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  res.on('finish', () => {
    try {
      const duration = Date.now() - startTime;
      
      // Track slow requests
      if (duration > 5000) { // Requests taking more than 5 seconds
        sentryService.captureMessage(
          `Slow request detected: ${req.method} ${req.path}`,
          'warning',
          {
            method: req.method,
            path: req.path,
            duration,
            status_code: res.statusCode,
            business_id: req.businessId
          }
        );
      }

      // Track critical financial operations
      if (req.path.includes('/tax/calculate') || req.path.includes('/transactions')) {
        sentryService.addBreadcrumb(
          'performance',
          `${req.method} ${req.path} - ${duration}ms`,
          duration > 2000 ? 'warning' : 'info',
          {
            duration,
            status_code: res.statusCode,
            business_id: req.businessId
          }
        );
      }

    } catch (error) {
      logger.error('Error in performance monitoring:', error);
    }
  });

  next();
};

// Helper functions
function extractEntityType(path: string): 'transaction' | 'tax_rate' | 'business' | 'filing' {
  if (path.includes('/transactions')) return 'transaction';
  if (path.includes('/tax') || path.includes('/rates')) return 'tax_rate';
  if (path.includes('/business')) return 'business';
  if (path.includes('/filing')) return 'filing';
  return 'transaction'; // default
}

function mapMethodToAction(method: string): 'created' | 'updated' | 'deleted' | 'calculated' {
  switch (method) {
    case 'POST': return 'created';
    case 'PUT':
    case 'PATCH': return 'updated';
    case 'DELETE': return 'deleted';
    default: return 'calculated';
  }
}

function extractJurisdiction(body: any): string | undefined {
  if (body?.address?.state) {
    return `${body.address.city || 'Unknown'}, ${body.address.state}`;
  }
  if (body?.state) {
    return body.state;
  }
  return undefined;
}

// Error boundary for critical financial operations
export const financialErrorBoundary = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const isFinancialOperation = req.path.includes('/tax') || 
                               req.path.includes('/transactions') ||
                               req.path.includes('/pos') ||
                               req.path.includes('/calculate');

  if (isFinancialOperation) {
    // Capture financial errors with high priority
    sentryService.captureFinancialError(error, {
      businessId: req.businessId,
      transactionId: req.params.transactionId,
      severity: 'high'
    });

    // Return structured error response
    res.status(500).json({
      error: 'Financial operation failed',
      message: 'A critical error occurred during financial processing',
      requestId: res.getHeader('X-Request-ID'),
      timestamp: new Date().toISOString(),
      support: 'Please contact support if this error persists'
    });
  } else {
    // Handle non-financial errors normally
    next(error);
  }
};