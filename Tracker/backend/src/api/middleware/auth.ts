/**
 * Authentication middleware for API routes
 * Provides token validation and user context
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

// Extend Express Request to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: 'ADMIN' | 'CLIENT';
        isActive: boolean;
        businessId?: string;
        permissions?: string[];
      };
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    // For development/demo purposes, we'll use a simple token validation
    // In production, this should validate against your actual JWT secret
    if (token === 'mock_admin_token') {
      req.user = {
        id: 'app_owner_1',
        email: 'admin@salestaxtracker.com',
        role: 'ADMIN',
        isActive: true,
        permissions: [
          'manage_pos_registry',
          'verify_client_contributions',
          'manage_plugins',
          'admin_access'
        ]
      };
      next();
      return;
    }

    if (token === 'mock_client_token') {
      req.user = {
        id: 'client_user_1',
        email: 'client@example.com',
        role: 'CLIENT',
        isActive: true,
        businessId: 'demo_business_1',
        permissions: [
          'use_pos_registry',
          'contribute_pos_systems',
          'manage_own_integrations'
        ]
      };
      next();
      return;
    }

    // Try to decode the token (if it's a real JWT)
    const jwtSecret = process.env.JWT_SECRET || 'development_secret';
    
    try {
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      // Mock user data based on JWT payload
      req.user = {
        id: decoded.sub || decoded.id || 'unknown',
        email: decoded.email || 'unknown@example.com',
        role: decoded.role || 'CLIENT',
        isActive: decoded.active !== false,
        businessId: decoded.businessId,
        permissions: decoded.permissions || []
      };
      
      next();
    } catch (jwtError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'ADMIN') {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }

  next();
};

/**
 * Middleware to require client role or higher
 */
export const requireClient = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (!req.user.isActive) {
    res.status(403).json({
      success: false,
      error: 'Account not active'
    });
    return;
  }

  next();
};

/**
 * Middleware to check specific permissions
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const hasPermission = req.user.permissions?.includes(permission) || 
                         req.user.role === 'ADMIN'; // Admins have all permissions

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        error: `Permission required: ${permission}`
      });
      return;
    }

    next();
  };
};
