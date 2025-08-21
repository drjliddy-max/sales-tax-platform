import { ManagementClient, AuthenticationClient } from 'auth0';
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
export declare class Auth0Service {
    private static instance;
    private managementClient;
    private authClient;
    private initialized;
    private constructor();
    static getInstance(): Auth0Service;
    private initialize;
    getJWTMiddleware(): {
        (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction): Promise<void>;
        unless: typeof import("express-unless").unless;
    };
    getUserProfile(userId: string): Promise<Auth0User | null>;
    updateUserRole(userId: string, businessId: string, role: UserRole, permissions: string[]): Promise<boolean>;
    createBusinessUser(email: string, businessId: string, role: UserRole, invitedBy: string): Promise<string | null>;
    revokeBusinessAccess(userId: string, businessId: string): Promise<boolean>;
    getPermissionsForRole(role: UserRole): string[];
    validateBusinessAccess(user: Auth0User, businessId: string): boolean;
    hasPermission(user: Auth0User, permission: string): boolean;
    getBusinessUsers(businessId: string): Promise<Auth0User[]>;
    logAuthEvent(event: {
        type: 'login' | 'logout' | 'token_refresh' | 'permission_check' | 'role_update';
        userId: string;
        businessId?: string;
        success: boolean;
        metadata?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
    }): Promise<void>;
    validateToken(token: string): Promise<Auth0User | null>;
    private testConnection;
    private generateTemporaryPassword;
    isServiceInitialized(): boolean;
    getManagementClient(): ManagementClient;
    getAuthClient(): AuthenticationClient;
}
export declare const auth0Service: Auth0Service;
//# sourceMappingURL=Auth0Service.d.ts.map