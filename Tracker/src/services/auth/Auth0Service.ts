import { expressjwt, GetVerificationKey } from 'express-jwt';
import jwksClient, { SigningKey } from 'jwks-rsa';
import jwt from 'jsonwebtoken';
import { ManagementClient, AuthenticationClient } from 'auth0';
import { config } from '@/config';
import { logger } from '@/utils';
import { sentryService } from '@/services/monitoring/SentryService';

export type UserRole = 'business_owner' | 'accountant' | 'bookkeeper' | 'auditor' | 'admin';

export interface Auth0User {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
  app_metadata?: {
    role: UserRole;
    businessId: string;
    permissions: string[];
  };
  user_metadata?: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
  };
}

export interface BusinessAccess {
  businessId: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  grantedAt: Date;
  grantedBy: string;
}

export class Auth0Service {
  private static instance: Auth0Service;
  private managementClient: ManagementClient;
  private authClient: AuthenticationClient;
  private initialized = false;

  private constructor() {
    this.managementClient = new ManagementClient({
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      clientSecret: config.auth0.clientSecret
    });

    this.authClient = new AuthenticationClient({
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      clientSecret: config.auth0.clientSecret
    });

    this.initialize();
  }

  public static getInstance(): Auth0Service {
    if (!Auth0Service.instance) {
      Auth0Service.instance = new Auth0Service();
    }
    return Auth0Service.instance;
  }

  private async initialize(): Promise<void> {
    try {
      if (!config.auth0.domain || !config.auth0.clientId) {
        logger.warn('Auth0 configuration incomplete, authentication disabled');
        return;
      }

      // Test connection to Auth0
      await this.testConnection();
      this.initialized = true;

      logger.info('Auth0 service initialized successfully', {
        domain: config.auth0.domain,
        audience: config.auth0.audience
      });

    } catch (error) {
      logger.error('Failed to initialize Auth0 service:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Auth0 initialization failed'),
        { severity: 'high' }
      );
    }
  }

  public getJWTMiddleware() {
    const client = jwksClient({
      jwksUri: `https://${config.auth0.domain}/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5
    });

    const getKey = (header: any, callback: any) => {
      client.getSigningKey(header.kid, (err: any, key: any) => {
        if (err) {
          logger.error('Error getting JWKS key:', err);
          return callback(err);
        }
        const signingKey = key?.getPublicKey();
        callback(null, signingKey);
      });
    };

    return expressjwt({
      secret: getKey as any,
      audience: config.auth0.audience,
      issuer: `https://${config.auth0.domain}/`,
      algorithms: ['RS256'],
      credentialsRequired: true,
      getToken: (req: any) => {
        // Extract token from Authorization header or query parameter
        if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
          return req.headers.authorization.split(' ')[1];
        } else if (req.query && req.query.token) {
          return req.query.token as string;
        }
        return undefined;
      }
    });
  }

  public async getUserProfile(userId: string): Promise<Auth0User | null> {
    try {
      if (!this.initialized) {
        throw new Error('Auth0 service not initialized');
      }

      const user = await this.managementClient.users.get({ id: userId });
      
      sentryService.addBreadcrumb(
        'auth0_operation',
        `Retrieved user profile: ${userId}`,
        'info',
        { user_id: userId }
      );

      return user.data as unknown as Auth0User;

    } catch (error) {
      logger.error(`Failed to get user profile for ${userId}:`, error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to get user profile'),
        { severity: 'medium' }
      );
      return null;
    }
  }

  public async updateUserRole(
    userId: string, 
    businessId: string, 
    role: UserRole, 
    permissions: string[]
  ): Promise<boolean> {
    try {
      const appMetadata = {
        role,
        businessId,
        permissions,
        updatedAt: new Date().toISOString()
      };

      await this.managementClient.users.update(
        { id: userId },
        { app_metadata: appMetadata }
      );

      sentryService.addBreadcrumb(
        'auth0_operation',
        `Updated user role: ${userId} -> ${role} for business ${businessId}`,
        'info',
        {
          user_id: userId,
          business_id: businessId,
          role,
          permissions_count: permissions.length
        }
      );

      logger.info('User role updated successfully', {
        userId,
        businessId,
        role,
        permissions
      });

      return true;

    } catch (error) {
      logger.error(`Failed to update user role for ${userId}:`, error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to update user role'),
        {
          businessId,
          severity: 'medium'
        }
      );
      return false;
    }
  }

  public async createBusinessUser(
    email: string,
    businessId: string,
    role: UserRole,
    invitedBy: string
  ): Promise<string | null> {
    try {
      const permissions = this.getPermissionsForRole(role);
      
      const userData = {
        email,
        password: this.generateTemporaryPassword(),
        app_metadata: {
          role,
          businessId,
          permissions,
          invitedBy,
          createdAt: new Date().toISOString()
        },
        user_metadata: {
          businessInvitation: true,
          mustChangePassword: true
        },
        verify_email: true,
        connection: 'Username-Password-Authentication'
      };

      const user = await this.managementClient.users.create(userData);

      sentryService.addBreadcrumb(
        'auth0_operation',
        `Created business user: ${email} for business ${businessId}`,
        'info',
        {
          business_id: businessId,
          role,
          invited_by: invitedBy
        }
      );

      logger.info('Business user created successfully', {
        userId: user.data.user_id,
        email,
        businessId,
        role
      });

      return user.data.user_id || null;

    } catch (error) {
      logger.error(`Failed to create business user ${email}:`, error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to create business user'),
        {
          businessId,
          severity: 'medium'
        }
      );
      return null;
    }
  }

  public async revokeBusinessAccess(userId: string, businessId: string): Promise<boolean> {
    try {
      // Remove business access by updating app_metadata
      const user = await this.managementClient.users.get({ id: userId });
      const currentMetadata = user.data.app_metadata || {};

      const updatedMetadata = {
        ...currentMetadata,
        businessId: null,
        role: null,
        permissions: [],
        accessRevokedAt: new Date().toISOString()
      };

      await this.managementClient.users.update(
        { id: userId },
        { app_metadata: updatedMetadata }
      );

      sentryService.addBreadcrumb(
        'auth0_operation',
        `Revoked business access: ${userId} from business ${businessId}`,
        'warning',
        {
          user_id: userId,
          business_id: businessId
        }
      );

      logger.warn('Business access revoked', {
        userId,
        businessId
      });

      return true;

    } catch (error) {
      logger.error(`Failed to revoke business access for ${userId}:`, error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to revoke business access'),
        {
          businessId,
          severity: 'high'
        }
      );
      return false;
    }
  }

  public getPermissionsForRole(role: UserRole): string[] {
    const permissions: Record<UserRole, string[]> = {
      'business_owner': [
        'read:transactions',
        'write:transactions',
        'read:tax_rates',
        'write:tax_rates',
        'read:business_settings',
        'write:business_settings',
        'read:integrations',
        'write:integrations',
        'read:reports',
        'write:reports',
        'read:users',
        'write:users',
        'read:audit_logs',
        'manage:business'
      ],
      'accountant': [
        'read:transactions',
        'write:transactions',
        'read:tax_rates',
        'read:business_settings',
        'read:integrations',
        'read:reports',
        'write:reports',
        'read:audit_logs',
        'prepare:filings'
      ],
      'bookkeeper': [
        'read:transactions',
        'write:transactions',
        'read:tax_rates',
        'read:business_settings',
        'read:integrations',
        'read:reports'
      ],
      'auditor': [
        'read:transactions',
        'read:tax_rates',
        'read:business_settings',
        'read:integrations',
        'read:reports',
        'read:audit_logs',
        'audit:compliance'
      ],
      'admin': [
        'read:*',
        'write:*',
        'manage:*',
        'admin:system'
      ]
    };

    return permissions[role] || [];
  }

  public validateBusinessAccess(user: Auth0User, businessId: string): boolean {
    if (!user.app_metadata) {
      return false;
    }

    const userBusinessId = user.app_metadata.businessId;
    
    // Admin users have access to all businesses
    if (user.app_metadata.role === 'admin') {
      return true;
    }

    // Regular users can only access their assigned business
    return userBusinessId === businessId;
  }

  public hasPermission(user: Auth0User, permission: string): boolean {
    if (!user.app_metadata?.permissions) {
      return false;
    }

    // Admin users have all permissions
    if (user.app_metadata.role === 'admin') {
      return true;
    }

    // Check for wildcard permissions
    if (user.app_metadata.permissions.includes('read:*') && permission.startsWith('read:')) {
      return true;
    }
    if (user.app_metadata.permissions.includes('write:*') && permission.startsWith('write:')) {
      return true;
    }

    return user.app_metadata.permissions.includes(permission);
  }

  public async getBusinessUsers(businessId: string): Promise<Auth0User[]> {
    try {
      // Search for users with this business ID in app_metadata
      const users = await this.managementClient.users.getAll({
        q: `app_metadata.businessId:"${businessId}"`,
        search_engine: 'v3'
      });

      sentryService.addBreadcrumb(
        'auth0_operation',
        `Retrieved ${users.data.length} users for business ${businessId}`,
        'info',
        { business_id: businessId, user_count: users.data.length }
      );

      return users.data as unknown as Auth0User[];

    } catch (error) {
      logger.error(`Failed to get business users for ${businessId}:`, error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to get business users'),
        {
          businessId,
          severity: 'medium'
        }
      );
      return [];
    }
  }

  public async logAuthEvent(event: {
    type: 'login' | 'logout' | 'token_refresh' | 'permission_check' | 'role_update';
    userId: string;
    businessId?: string;
    success: boolean;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      // Log to Sentry for monitoring
      sentryService.addBreadcrumb(
        'authentication',
        `Auth event: ${event.type} for ${event.userId}`,
        event.success ? 'info' : 'warning',
        {
          auth_event_type: event.type,
          user_id: event.userId,
          business_id: event.businessId,
          success: event.success,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          ...event.metadata
        }
      );

      // Alert on failed authentication attempts
      if (!event.success) {
        sentryService.captureFinancialError(
          new Error(`Authentication failed: ${event.type}`),
          {
            businessId: event.businessId,
            severity: event.type === 'login' ? 'medium' : 'low'
          }
        );
      }

      logger.info('Auth event logged', {
        type: event.type,
        userId: event.userId,
        businessId: event.businessId,
        success: event.success
      });

    } catch (error) {
      logger.error('Failed to log auth event:', error);
    }
  }

  public async validateToken(token: string): Promise<Auth0User | null> {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return null;
      }

      const payload = decoded.payload as any;
      
      // Get full user profile from Auth0
      const user = await this.getUserProfile(payload.sub);
      
      if (user) {
        await this.logAuthEvent({
          type: 'token_refresh',
          userId: user.sub,
          businessId: user.app_metadata?.businessId,
          success: true
        });
      }

      return user;

    } catch (error) {
      logger.error('Token validation failed:', error);
      return null;
    }
  }

  private async testConnection(): Promise<void> {
    try {
      // Test Auth0 Management API connection
      await this.managementClient.users.getAll({ per_page: 1 });
      logger.info('Auth0 Management API connection successful');
    } catch (error) {
      logger.error('Auth0 connection test failed:', error);
      throw new Error('Failed to connect to Auth0 Management API');
    }
  }

  private generateTemporaryPassword(): string {
    const length = 12;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }

  public isServiceInitialized(): boolean {
    return this.initialized;
  }

  public getManagementClient(): ManagementClient {
    return this.managementClient;
  }

  public getAuthClient(): AuthenticationClient {
    return this.authClient;
  }
}

// Export singleton instance
export const auth0Service = Auth0Service.getInstance();