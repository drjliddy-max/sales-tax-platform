"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth0Service = exports.Auth0Service = void 0;
const express_jwt_1 = require("express-jwt");
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth0_1 = require("auth0");
const config_1 = require("@/config");
const utils_1 = require("@/utils");
const SentryService_1 = require("@/services/monitoring/SentryService");
class Auth0Service {
    constructor() {
        this.initialized = false;
        this.managementClient = new auth0_1.ManagementClient({
            domain: config_1.config.auth0.domain,
            clientId: config_1.config.auth0.clientId,
            clientSecret: config_1.config.auth0.clientSecret
        });
        this.authClient = new auth0_1.AuthenticationClient({
            domain: config_1.config.auth0.domain,
            clientId: config_1.config.auth0.clientId,
            clientSecret: config_1.config.auth0.clientSecret
        });
        this.initialize();
    }
    static getInstance() {
        if (!Auth0Service.instance) {
            Auth0Service.instance = new Auth0Service();
        }
        return Auth0Service.instance;
    }
    async initialize() {
        try {
            if (!config_1.config.auth0.domain || !config_1.config.auth0.clientId) {
                utils_1.logger.warn('Auth0 configuration incomplete, authentication disabled');
                return;
            }
            await this.testConnection();
            this.initialized = true;
            utils_1.logger.info('Auth0 service initialized successfully', {
                domain: config_1.config.auth0.domain,
                audience: config_1.config.auth0.audience
            });
        }
        catch (error) {
            utils_1.logger.error('Failed to initialize Auth0 service:', error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Auth0 initialization failed'), { severity: 'high' });
        }
    }
    getJWTMiddleware() {
        const client = (0, jwks_rsa_1.default)({
            jwksUri: `https://${config_1.config.auth0.domain}/.well-known/jwks.json`,
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5
        });
        const getKey = (header, callback) => {
            client.getSigningKey(header.kid, (err, key) => {
                if (err) {
                    utils_1.logger.error('Error getting JWKS key:', err);
                    return callback(err);
                }
                const signingKey = key?.getPublicKey();
                callback(null, signingKey);
            });
        };
        return (0, express_jwt_1.expressjwt)({
            secret: getKey,
            audience: config_1.config.auth0.audience,
            issuer: `https://${config_1.config.auth0.domain}/`,
            algorithms: ['RS256'],
            credentialsRequired: true,
            getToken: (req) => {
                if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
                    return req.headers.authorization.split(' ')[1];
                }
                else if (req.query && req.query.token) {
                    return req.query.token;
                }
                return undefined;
            }
        });
    }
    async getUserProfile(userId) {
        try {
            if (!this.initialized) {
                throw new Error('Auth0 service not initialized');
            }
            const user = await this.managementClient.users.get({ id: userId });
            SentryService_1.sentryService.addBreadcrumb('auth0_operation', `Retrieved user profile: ${userId}`, 'info', { user_id: userId });
            return user.data;
        }
        catch (error) {
            utils_1.logger.error(`Failed to get user profile for ${userId}:`, error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to get user profile'), { severity: 'medium' });
            return null;
        }
    }
    async updateUserRole(userId, businessId, role, permissions) {
        try {
            const appMetadata = {
                role,
                businessId,
                permissions,
                updatedAt: new Date().toISOString()
            };
            await this.managementClient.users.update({ id: userId }, { app_metadata: appMetadata });
            SentryService_1.sentryService.addBreadcrumb('auth0_operation', `Updated user role: ${userId} -> ${role} for business ${businessId}`, 'info', {
                user_id: userId,
                business_id: businessId,
                role,
                permissions_count: permissions.length
            });
            utils_1.logger.info('User role updated successfully', {
                userId,
                businessId,
                role,
                permissions
            });
            return true;
        }
        catch (error) {
            utils_1.logger.error(`Failed to update user role for ${userId}:`, error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to update user role'), {
                businessId,
                severity: 'medium'
            });
            return false;
        }
    }
    async createBusinessUser(email, businessId, role, invitedBy) {
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
            SentryService_1.sentryService.addBreadcrumb('auth0_operation', `Created business user: ${email} for business ${businessId}`, 'info', {
                business_id: businessId,
                role,
                invited_by: invitedBy
            });
            utils_1.logger.info('Business user created successfully', {
                userId: user.data.user_id,
                email,
                businessId,
                role
            });
            return user.data.user_id || null;
        }
        catch (error) {
            utils_1.logger.error(`Failed to create business user ${email}:`, error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to create business user'), {
                businessId,
                severity: 'medium'
            });
            return null;
        }
    }
    async revokeBusinessAccess(userId, businessId) {
        try {
            const user = await this.managementClient.users.get({ id: userId });
            const currentMetadata = user.data.app_metadata || {};
            const updatedMetadata = {
                ...currentMetadata,
                businessId: null,
                role: null,
                permissions: [],
                accessRevokedAt: new Date().toISOString()
            };
            await this.managementClient.users.update({ id: userId }, { app_metadata: updatedMetadata });
            SentryService_1.sentryService.addBreadcrumb('auth0_operation', `Revoked business access: ${userId} from business ${businessId}`, 'warning', {
                user_id: userId,
                business_id: businessId
            });
            utils_1.logger.warn('Business access revoked', {
                userId,
                businessId
            });
            return true;
        }
        catch (error) {
            utils_1.logger.error(`Failed to revoke business access for ${userId}:`, error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to revoke business access'), {
                businessId,
                severity: 'high'
            });
            return false;
        }
    }
    getPermissionsForRole(role) {
        const permissions = {
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
    validateBusinessAccess(user, businessId) {
        if (!user.app_metadata) {
            return false;
        }
        const userBusinessId = user.app_metadata.businessId;
        if (user.app_metadata.role === 'admin') {
            return true;
        }
        return userBusinessId === businessId;
    }
    hasPermission(user, permission) {
        if (!user.app_metadata?.permissions) {
            return false;
        }
        if (user.app_metadata.role === 'admin') {
            return true;
        }
        if (user.app_metadata.permissions.includes('read:*') && permission.startsWith('read:')) {
            return true;
        }
        if (user.app_metadata.permissions.includes('write:*') && permission.startsWith('write:')) {
            return true;
        }
        return user.app_metadata.permissions.includes(permission);
    }
    async getBusinessUsers(businessId) {
        try {
            const users = await this.managementClient.users.getAll({
                q: `app_metadata.businessId:"${businessId}"`,
                search_engine: 'v3'
            });
            SentryService_1.sentryService.addBreadcrumb('auth0_operation', `Retrieved ${users.data.length} users for business ${businessId}`, 'info', { business_id: businessId, user_count: users.data.length });
            return users.data;
        }
        catch (error) {
            utils_1.logger.error(`Failed to get business users for ${businessId}:`, error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to get business users'), {
                businessId,
                severity: 'medium'
            });
            return [];
        }
    }
    async logAuthEvent(event) {
        try {
            SentryService_1.sentryService.addBreadcrumb('authentication', `Auth event: ${event.type} for ${event.userId}`, event.success ? 'info' : 'warning', {
                auth_event_type: event.type,
                user_id: event.userId,
                business_id: event.businessId,
                success: event.success,
                ip_address: event.ipAddress,
                user_agent: event.userAgent,
                ...event.metadata
            });
            if (!event.success) {
                SentryService_1.sentryService.captureFinancialError(new Error(`Authentication failed: ${event.type}`), {
                    businessId: event.businessId,
                    severity: event.type === 'login' ? 'medium' : 'low'
                });
            }
            utils_1.logger.info('Auth event logged', {
                type: event.type,
                userId: event.userId,
                businessId: event.businessId,
                success: event.success
            });
        }
        catch (error) {
            utils_1.logger.error('Failed to log auth event:', error);
        }
    }
    async validateToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
            if (!decoded || typeof decoded === 'string') {
                return null;
            }
            const payload = decoded.payload;
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
        }
        catch (error) {
            utils_1.logger.error('Token validation failed:', error);
            return null;
        }
    }
    async testConnection() {
        try {
            await this.managementClient.users.getAll({ per_page: 1 });
            utils_1.logger.info('Auth0 Management API connection successful');
        }
        catch (error) {
            utils_1.logger.error('Auth0 connection test failed:', error);
            throw new Error('Failed to connect to Auth0 Management API');
        }
    }
    generateTemporaryPassword() {
        const length = 12;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }
    isServiceInitialized() {
        return this.initialized;
    }
    getManagementClient() {
        return this.managementClient;
    }
    getAuthClient() {
        return this.authClient;
    }
}
exports.Auth0Service = Auth0Service;
exports.auth0Service = Auth0Service.getInstance();
//# sourceMappingURL=Auth0Service.js.map