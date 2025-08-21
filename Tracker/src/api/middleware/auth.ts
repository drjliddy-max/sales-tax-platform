import { Request, Response, NextFunction } from 'express';
import { auth0Service, Auth0User, UserRole } from '@/services/auth/Auth0Service';
import { auditLogService } from '@/services/auth/AuditLogService';
import { sentryService } from '@/services/monitoring/SentryService';
import { logger } from '@/utils';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      auth?: {
        payload: any;
        header: any;
        signature: string;
      };
      user?: Auth0User;
      businessId?: string;
      userId?: string;
    }
  }
}

// JWT validation middleware
export const requireAuth = auth0Service.getJWTMiddleware();

// User context middleware - enriches request with full user profile
export const enrichUserContext = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.auth?.payload?.sub) {
      return next();
    }

    const userId = req.auth.payload.sub;
    const user = await auth0Service.getUserProfile(userId);

    if (user) {
      req.user = user;
      req.userId = user.sub;
      req.businessId = user.app_metadata?.businessId;

      // Set Sentry user context
      sentryService.setUserContext({
        id: user.sub,
        email: user.email,
        businessId: user.app_metadata?.businessId,
        role: user.app_metadata?.role
      });

      // Log authentication success
      await auth0Service.logAuthEvent({
        type: 'token_refresh',
        userId: user.sub,
        businessId: user.app_metadata?.businessId,
        success: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          endpoint: req.path,
          method: req.method
        }
      });
    }

    next();

  } catch (error) {
    logger.error('Error enriching user context:', error);
    
    // Log authentication failure
    if (req.auth?.payload?.sub) {
      await auth0Service.logAuthEvent({
        type: 'token_refresh',
        userId: req.auth.payload.sub,
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

    // Continue without user context for non-critical failures
    next();
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: UserRole | UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Valid authentication token required to access this resource'
        });
        return;
      }

      const userRole = req.user.app_metadata?.role;
      if (!userRole) {
        sentryService.captureFinancialError(
          new Error('User has no assigned role'),
          {
            businessId: req.businessId,
            severity: 'medium'
          }
        );

        res.status(403).json({
          error: 'Access denied',
          message: 'No role assigned to user'
        });
        return;
      }

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      
      // Admin users always have access
      if (userRole === 'admin' || roles.includes(userRole)) {
        // Log successful authorization
        sentryService.addBreadcrumb(
          'authorization',
          `Role authorization success: ${userRole} accessing ${req.path}`,
          'info',
          {
            user_role: userRole,
            required_roles: roles,
            endpoint: req.path,
            business_id: req.businessId
          }
        );

        next();
        return;
      }

      // Log authorization failure
      sentryService.captureFinancialError(
        new Error(`Insufficient role permissions: ${userRole} attempted to access ${req.path}`),
        {
          businessId: req.businessId,
          severity: 'medium'
        }
      );

      await auth0Service.logAuthEvent({
        type: 'permission_check',
        userId: req.user.sub,
        businessId: req.businessId,
        success: false,
        ipAddress: req.ip,
        metadata: {
          required_roles: roles,
          user_role: userRole,
          endpoint: req.path
        }
      });

      res.status(403).json({
        error: 'Insufficient permissions',
        message: `Role '${userRole}' does not have access to this resource`,
        required_roles: roles
      });

    } catch (error) {
      logger.error('Error in role authorization:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Role authorization error'),
        {
          businessId: req.businessId,
          severity: 'high'
        }
      );

      res.status(500).json({
        error: 'Authorization error',
        message: 'An error occurred during authorization check'
      });
    }
  };
};

// Permission-based authorization middleware
export const requirePermission = (permission: string | string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Valid authentication token required to access this resource'
        });
        return;
      }

      const permissions = Array.isArray(permission) ? permission : [permission];
      const hasPermission = permissions.some(perm => auth0Service.hasPermission(req.user!, perm));

      if (hasPermission) {
        sentryService.addBreadcrumb(
          'authorization',
          `Permission check success: ${req.user.sub} has ${permissions.join(', ')}`,
          'info',
          {
            user_id: req.user.sub,
            required_permissions: permissions,
            endpoint: req.path,
            business_id: req.businessId
          }
        );

        next();
        return;
      }

      // Log permission denial
      sentryService.captureFinancialError(
        new Error(`Permission denied: user lacks ${permissions.join(', ')}`),
        {
          businessId: req.businessId,
          severity: 'medium'
        }
      );

      await auth0Service.logAuthEvent({
        type: 'permission_check',
        userId: req.user.sub,
        businessId: req.businessId,
        success: false,
        ipAddress: req.ip,
        metadata: {
          required_permissions: permissions,
          user_permissions: req.user.app_metadata?.permissions || [],
          endpoint: req.path
        }
      });

      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires one of: ${permissions.join(', ')}`,
        user_permissions: req.user.app_metadata?.permissions || []
      });

    } catch (error) {
      logger.error('Error in permission check:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Permission check error'),
        {
          businessId: req.businessId,
          severity: 'high'
        }
      );

      res.status(500).json({
        error: 'Authorization error',
        message: 'An error occurred during permission check'
      });
    }
  };
};

// Multi-tenant business isolation middleware
export const requireBusinessAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'Valid authentication token required'
      });
      return;
    }

    // Extract business ID from request (URL params, query, or body)
    const requestedBusinessId = req.params.businessId || 
                               req.query.businessId as string || 
                               req.body.businessId;

    if (!requestedBusinessId) {
      res.status(400).json({
        error: 'Business ID required',
        message: 'Business ID must be provided in request'
      });
      return;
    }

    // Validate business access
    const hasAccess = auth0Service.validateBusinessAccess(req.user, requestedBusinessId);

    if (!hasAccess) {
      // Log unauthorized business access attempt
      sentryService.captureFinancialError(
        new Error(`Unauthorized business access attempt: ${req.user.sub} -> ${requestedBusinessId}`),
        {
          businessId: requestedBusinessId,
          severity: 'high'
        }
      );

      await auth0Service.logAuthEvent({
        type: 'permission_check',
        userId: req.user.sub,
        businessId: requestedBusinessId,
        success: false,
        ipAddress: req.ip,
        metadata: {
          attempted_business_access: requestedBusinessId,
          user_business_id: req.user.app_metadata?.businessId,
          endpoint: req.path
        }
      });

      res.status(403).json({
        error: 'Business access denied',
        message: 'You do not have access to this business',
        user_business_id: req.user.app_metadata?.businessId
      });
      return;
    }

    // Set validated business ID for downstream middleware
    req.businessId = requestedBusinessId;

    // Log successful business access
    sentryService.addBreadcrumb(
      'business_access',
      `Business access granted: ${req.user.sub} -> ${requestedBusinessId}`,
      'info',
      {
        user_id: req.user.sub,
        business_id: requestedBusinessId,
        user_role: req.user.app_metadata?.role,
        endpoint: req.path
      }
    );

    next();

  } catch (error) {
    logger.error('Error in business access check:', error);
    sentryService.captureFinancialError(
      error instanceof Error ? error : new Error('Business access check error'),
      {
        businessId: req.businessId,
        severity: 'high'
      }
    );

    res.status(500).json({
      error: 'Access validation error',
      message: 'An error occurred during business access validation'
    });
  }
};

// Business owner verification for critical operations
export const requireBusinessOwner = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || req.user.app_metadata?.role !== 'business_owner') {
      sentryService.captureFinancialError(
        new Error(`Business owner access required: ${req.user?.sub} attempted ${req.path}`),
        {
          businessId: req.businessId,
          severity: 'high'
        }
      );

      res.status(403).json({
        error: 'Business owner access required',
        message: 'This operation requires business owner privileges',
        user_role: req.user?.app_metadata?.role
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error in business owner check:', error);
    res.status(500).json({
      error: 'Authorization error',
      message: 'Error validating business owner access'
    });
  }
};

// Financial operation authorization with enhanced security
export const requireFinancialAccess = (operation: 'read' | 'write' | 'calculate' | 'report') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'Financial operations require authentication'
        });
        return;
      }

      const userRole = req.user.app_metadata?.role;
      const requiredPermission = `${operation}:transactions`;

      // Check role-based access for financial operations
      const hasAccess = auth0Service.hasPermission(req.user, requiredPermission) ||
                       auth0Service.hasPermission(req.user, 'manage:business');

      if (!hasAccess) {
        sentryService.captureFinancialError(
          new Error(`Financial operation denied: ${userRole} lacks ${requiredPermission}`),
          {
            businessId: req.businessId,
            severity: 'high'
          }
        );

        await auth0Service.logAuthEvent({
          type: 'permission_check',
          userId: req.user.sub,
          businessId: req.businessId,
          success: false,
          ipAddress: req.ip,
          metadata: {
            operation,
            required_permission: requiredPermission,
            user_role: userRole,
            endpoint: req.path
          }
        });

        res.status(403).json({
          error: 'Financial access denied',
          message: `Role '${userRole}' cannot perform '${operation}' operations`,
          required_permission: requiredPermission
        });
        return;
      }

      // Log successful financial access
      sentryService.addBreadcrumb(
        'financial_authorization',
        `Financial ${operation} access granted to ${userRole}`,
        'info',
        {
          operation,
          user_role: userRole,
          business_id: req.businessId,
          endpoint: req.path
        }
      );

      next();

    } catch (error) {
      logger.error('Error in financial authorization:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Financial authorization error'),
        {
          businessId: req.businessId,
          severity: 'high'
        }
      );

      res.status(500).json({
        error: 'Authorization error',
        message: 'Error validating financial access'
      });
    }
  };
};

// Multi-tenant data isolation middleware
export const enforceDataIsolation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || !req.businessId) {
      return next();
    }

    // Validate that user can access the requested business data
    const hasBusinessAccess = auth0Service.validateBusinessAccess(req.user, req.businessId);

    if (!hasBusinessAccess) {
      sentryService.captureFinancialError(
        new Error(`Data isolation violation: ${req.user.sub} attempted access to business ${req.businessId}`),
        {
          businessId: req.businessId,
          severity: 'critical'
        }
      );

      res.status(403).json({
        error: 'Data access violation',
        message: 'Access to this business data is not permitted',
        user_business_id: req.user.app_metadata?.businessId,
        requested_business_id: req.businessId
      });
      return;
    }

    // Add business filter to query/body for database operations
    if (req.method === 'GET' && req.query) {
      (req.query as any).businessId = req.businessId;
    } else if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      req.body.businessId = req.businessId;
    }

    // Log data access for audit trail
    sentryService.addBreadcrumb(
      'data_isolation',
      `Data access granted: ${req.user.sub} -> business ${req.businessId}`,
      'info',
      {
        user_id: req.user.sub,
        business_id: req.businessId,
        endpoint: req.path,
        method: req.method
      }
    );

    next();

  } catch (error) {
    logger.error('Error in data isolation enforcement:', error);
    sentryService.captureFinancialError(
      error instanceof Error ? error : new Error('Data isolation error'),
      {
        businessId: req.businessId,
        severity: 'critical'
      }
    );

    res.status(500).json({
      error: 'Data isolation error',
      message: 'Error enforcing data access controls'
    });
  }
};

// Audit logging middleware for sensitive operations
export const auditSecurityEvent = (operationType: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      try {
        // Log audit event for sensitive operations
        if (req.user && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
          const auditEventData = {
            entityType: extractEntityTypeFromPath(req.path),
            entityId: req.params.id || req.params.businessId || 'unknown',
            action: mapMethodToSecurityAction(req.method),
            userId: req.user.sub,
            businessId: req.businessId || 'system',
            userRole: req.user.app_metadata?.role || 'admin' as UserRole,
            userPermissions: req.user.app_metadata?.permissions || [],
            changes: {
              after: req.body || {}
            },
            metadata: {
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              jurisdiction: extractJurisdiction(req.body || {}),
              operationType,
              endpoint: req.path,
              method: req.method
            },
            compliance: {
              isComplianceRelevant: true,
              regulatoryCategory: mapOperationToRegulatory(operationType)
            }
          };

          // Log to audit service (fire and forget)
          auditLogService.logEvent(auditEventData).catch(error => {
            logger.error('Failed to log audit event:', error);
          });

          // Log to Sentry for security monitoring
          sentryService.addBreadcrumb(
            'security_audit',
            `${operationType}: ${req.method} ${req.path} by ${req.user.sub}`,
            'info',
            {
              operation_type: operationType,
              user_id: req.user.sub,
              business_id: req.businessId,
              entity_type: auditEventData.entityType,
              action: auditEventData.action,
              user_role: req.user.app_metadata?.role
            }
          );
        }
      } catch (error) {
        logger.error('Error logging security audit event:', error);
      }

      return originalJson.call(this, data);
    };

    next();
  };
};

// Helper functions
function extractEntityTypeFromPath(path: string): 'transaction' | 'tax_rate' | 'business' | 'filing' | 'user' | 'integration' {
  if (path.includes('/transactions')) return 'transaction';
  if (path.includes('/tax') || path.includes('/rates')) return 'tax_rate';
  if (path.includes('/business')) return 'business';
  if (path.includes('/filing')) return 'filing';
  if (path.includes('/users') || path.includes('/auth')) return 'user';
  if (path.includes('/integrations')) return 'integration';
  return 'transaction'; // default
}

function mapMethodToSecurityAction(method: string): 'created' | 'updated' | 'deleted' | 'accessed' {
  switch (method) {
    case 'POST': return 'created';
    case 'PUT':
    case 'PATCH': return 'updated';
    case 'DELETE': return 'deleted';
    default: return 'accessed';
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

function mapOperationToRegulatory(operationType?: string): 'tax_calculation' | 'user_management' | 'data_retention' | 'financial_reporting' {
  if (operationType?.includes('tax') || operationType?.includes('calculation')) {
    return 'tax_calculation';
  }
  if (operationType?.includes('user') || operationType?.includes('auth')) {
    return 'user_management';
  }
  if (operationType?.includes('report') || operationType?.includes('filing')) {
    return 'financial_reporting';
  }
  return 'data_retention';
}

// Rate limiting for authentication endpoints
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.ip + (req.body?.email || req.auth?.payload?.sub || '');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [key, value] of attempts.entries()) {
      if (value.resetTime < windowStart) {
        attempts.delete(key);
      }
    }

    const current = attempts.get(identifier) || { count: 0, resetTime: now + windowMs };

    if (current.count >= maxAttempts && current.resetTime > now) {
      sentryService.captureFinancialError(
        new Error(`Rate limit exceeded for authentication: ${identifier}`),
        { severity: 'medium' }
      );

      res.status(429).json({
        error: 'Too many attempts',
        message: 'Too many authentication attempts, please try again later',
        retry_after: Math.ceil((current.resetTime - now) / 1000)
      });
      return;
    }

    current.count++;
    attempts.set(identifier, current);

    // Track failed attempts
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        sentryService.addBreadcrumb(
          'auth_rate_limit',
          `Failed auth attempt ${current.count}/${maxAttempts}`,
          'warning',
          {
            identifier: identifier.substring(0, 20), // Truncate for privacy
            attempt_count: current.count,
            status_code: res.statusCode
          }
        );
      } else {
        // Reset on successful authentication
        attempts.delete(identifier);
      }
    });

    next();
  };
};