"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const models_1 = require("@/models");
const Auth0Service_1 = require("@/services/auth/Auth0Service");
const AuditLogService_1 = require("@/services/auth/AuditLogService");
const SentryService_1 = require("@/services/monitoring/SentryService");
const utils_1 = require("@/utils");
const crypto_1 = __importDefault(require("crypto"));
class UserController {
    async getBusinessUsers(req, res) {
        try {
            const { businessId } = req.params;
            const auth0Users = await Auth0Service_1.auth0Service.getBusinessUsers(businessId);
            const localUsers = await models_1.User.find({
                'businessAccesses.businessId': businessId,
                'businessAccesses.isActive': true
            }).select('-securityMetadata -businessAccesses.grantedBy');
            const users = auth0Users.map(auth0User => {
                const localUser = localUsers.find(lu => lu.auth0Id === auth0User.sub);
                return {
                    id: auth0User.sub,
                    email: auth0User.email,
                    name: auth0User.name,
                    role: auth0User.app_metadata?.role,
                    permissions: auth0User.app_metadata?.permissions || [],
                    emailVerified: auth0User.email_verified,
                    lastLogin: localUser?.lastLogin,
                    isActive: localUser?.isActive ?? true,
                    preferences: localUser?.preferences
                };
            });
            await AuditLogService_1.auditLogService.logEvent({
                entityType: 'user',
                entityId: businessId,
                action: 'accessed',
                userId: req.user.sub,
                businessId,
                userRole: req.user.app_metadata.role,
                userPermissions: req.user.app_metadata.permissions || [],
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    method: req.method,
                    operationType: 'user_list_access'
                }
            });
            res.json({ users, total: users.length });
        }
        catch (error) {
            utils_1.logger.error('Error getting business users:', error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to get business users'), { businessId: req.params.businessId, severity: 'medium' });
            res.status(500).json({
                error: 'Failed to retrieve users',
                message: 'An error occurred while retrieving business users'
            });
        }
    }
    async inviteUser(req, res) {
        try {
            const { businessId } = req.params;
            const { email, role, message } = req.body;
            if (!email || !role) {
                res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Email and role are required'
                });
                return;
            }
            const business = await models_1.Business.findOne({ businessId });
            if (!business) {
                return res.status(404).json({
                    error: 'Business not found',
                    message: 'The specified business does not exist'
                });
            }
            const existingUser = await models_1.User.findOne({
                email: email.toLowerCase(),
                'businessAccesses.businessId': businessId,
                'businessAccesses.isActive': true
            });
            if (existingUser) {
                return res.status(409).json({
                    error: 'User already exists',
                    message: 'User already has access to this business'
                });
            }
            const existingInvitation = await models_1.UserInvitation.findOne({
                email: email.toLowerCase(),
                businessId,
                status: 'pending'
            });
            if (existingInvitation) {
                return res.status(409).json({
                    error: 'Invitation already sent',
                    message: 'A pending invitation already exists for this user'
                });
            }
            const invitationToken = crypto_1.default.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            const permissions = Auth0Service_1.auth0Service.getPermissionsForRole(role);
            const invitation = new models_1.UserInvitation({
                email: email.toLowerCase(),
                businessId,
                role,
                permissions,
                invitedBy: req.user.sub,
                invitationToken,
                expiresAt,
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    invitationMessage: message
                }
            });
            await invitation.save();
            const auth0UserId = await Auth0Service_1.auth0Service.createBusinessUser(email, businessId, role, req.user.sub);
            if (!auth0UserId) {
                if (invitation.revoke) {
                    invitation.revoke(req.user.sub, 'Failed to create Auth0 user');
                    await invitation.save();
                }
                return res.status(500).json({
                    error: 'Failed to create user',
                    message: 'Could not create user account'
                });
            }
            const localUser = new models_1.User({
                auth0Id: auth0UserId,
                email: email.toLowerCase(),
                emailVerified: false,
                isActive: true,
                businessAccesses: [{
                        businessId,
                        role,
                        permissions,
                        isActive: true,
                        grantedAt: new Date(),
                        grantedBy: req.user.sub
                    }],
                preferences: {
                    emailNotifications: true,
                    securityAlerts: true
                },
                securityMetadata: {
                    mfaEnabled: false,
                    failedLoginAttempts: 0
                }
            });
            await localUser.save();
            await AuditLogService_1.auditLogService.logEvent({
                entityType: 'user',
                entityId: auth0UserId,
                action: 'created',
                userId: req.user.sub,
                businessId,
                userRole: req.user.app_metadata.role,
                userPermissions: req.user.app_metadata.permissions || [],
                changes: {
                    after: {
                        email,
                        role,
                        permissions,
                        businessId
                    }
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    method: req.method,
                    operationType: 'user_invitation'
                },
                severity: 'medium',
                compliance: {
                    isComplianceRelevant: true,
                    regulatoryCategory: 'user_management'
                }
            });
            res.status(201).json({
                message: 'User invited successfully',
                invitation: {
                    id: invitation._id,
                    email,
                    role,
                    businessId,
                    expiresAt,
                    invitationToken
                },
                user: {
                    id: auth0UserId,
                    email,
                    role,
                    permissions
                }
            });
        }
        catch (error) {
            utils_1.logger.error('Error inviting user:', error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to invite user'), { businessId: req.params.businessId, severity: 'high' });
            res.status(500).json({
                error: 'Failed to invite user',
                message: 'An error occurred while creating the user invitation'
            });
        }
    }
    async updateUserRole(req, res) {
        try {
            const { businessId, userId } = req.params;
            const { role, permissions } = req.body;
            if (!role) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Role is required'
                });
            }
            const currentUser = await models_1.User.findOne({ auth0Id: userId });
            if (!currentUser) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist in the system'
                });
            }
            const currentAccess = currentUser.businessAccesses.find(ba => ba.businessId === businessId && ba.isActive);
            if (!currentAccess) {
                return res.status(404).json({
                    error: 'User access not found',
                    message: 'User does not have access to this business'
                });
            }
            const defaultPermissions = Auth0Service_1.auth0Service.getPermissionsForRole(role);
            const finalPermissions = permissions || defaultPermissions;
            const success = await Auth0Service_1.auth0Service.updateUserRole(userId, businessId, role, finalPermissions);
            if (!success) {
                return res.status(500).json({
                    error: 'Failed to update user',
                    message: 'Could not update user role in Auth0'
                });
            }
            currentAccess.role = role;
            currentAccess.permissions = finalPermissions;
            await currentUser.save();
            await AuditLogService_1.auditLogService.logEvent({
                entityType: 'user',
                entityId: userId,
                action: 'updated',
                userId: req.user.sub,
                businessId,
                userRole: req.user.app_metadata.role,
                userPermissions: req.user.app_metadata.permissions || [],
                changes: {
                    before: {
                        role: currentAccess.role,
                        permissions: currentAccess.permissions
                    },
                    after: {
                        role,
                        permissions: finalPermissions
                    }
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    method: req.method,
                    operationType: 'user_role_update'
                },
                severity: 'high',
                compliance: {
                    isComplianceRelevant: true,
                    regulatoryCategory: 'user_management'
                }
            });
            res.json({
                message: 'User role updated successfully',
                user: {
                    id: userId,
                    email: currentUser.email,
                    role,
                    permissions: finalPermissions,
                    businessId
                }
            });
        }
        catch (error) {
            utils_1.logger.error('Error updating user role:', error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to update user role'), { businessId: req.params.businessId, severity: 'high' });
            res.status(500).json({
                error: 'Failed to update user',
                message: 'An error occurred while updating user role'
            });
        }
    }
    async revokeUserAccess(req, res) {
        try {
            const { businessId, userId } = req.params;
            const currentUser = await models_1.User.findOne({ auth0Id: userId });
            if (!currentUser) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist in the system'
                });
            }
            const success = await Auth0Service_1.auth0Service.revokeBusinessAccess(userId, businessId);
            if (!success) {
                return res.status(500).json({
                    error: 'Failed to revoke access',
                    message: 'Could not revoke user access in Auth0'
                });
            }
            if (currentUser.revokeBusinessAccess) {
                currentUser.revokeBusinessAccess(businessId, req.user.sub);
            }
            await currentUser.save();
            await AuditLogService_1.auditLogService.logEvent({
                entityType: 'user',
                entityId: userId,
                action: 'updated',
                userId: req.user.sub,
                businessId,
                userRole: req.user.app_metadata.role,
                userPermissions: req.user.app_metadata.permissions || [],
                changes: {
                    after: {
                        accessRevoked: true,
                        revokedBy: req.user.sub,
                        revokedAt: new Date()
                    }
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    endpoint: req.path,
                    method: req.method,
                    operationType: 'user_access_revocation'
                },
                severity: 'high',
                compliance: {
                    isComplianceRelevant: true,
                    regulatoryCategory: 'user_management'
                }
            });
            res.json({
                message: 'User access revoked successfully',
                userId,
                businessId,
                revokedBy: req.user.sub,
                revokedAt: new Date()
            });
        }
        catch (error) {
            utils_1.logger.error('Error revoking user access:', error);
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Failed to revoke user access'), { businessId: req.params.businessId, severity: 'high' });
            res.status(500).json({
                error: 'Failed to revoke access',
                message: 'An error occurred while revoking user access'
            });
        }
    }
    async getInvitations(req, res) {
        try {
            const { businessId } = req.params;
            const { status } = req.query;
            const query = { businessId };
            if (status && ['pending', 'accepted', 'expired', 'revoked'].includes(status)) {
                query.status = status;
            }
            const invitations = await models_1.UserInvitation.find(query)
                .sort({ createdAt: -1 })
                .populate('invitedBy', 'email name')
                .select('-invitationToken');
            res.json({ invitations, total: invitations.length });
        }
        catch (error) {
            utils_1.logger.error('Error getting invitations:', error);
            res.status(500).json({
                error: 'Failed to retrieve invitations',
                message: 'An error occurred while retrieving invitations'
            });
        }
    }
    async resendInvitation(req, res) {
        try {
            const { businessId, invitationId } = req.params;
            const invitation = await models_1.UserInvitation.findOne({
                _id: invitationId,
                businessId,
                status: 'pending'
            });
            if (!invitation) {
                return res.status(404).json({
                    error: 'Invitation not found',
                    message: 'No pending invitation found'
                });
            }
            if (invitation.isExpired && invitation.isExpired()) {
                invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                invitation.invitationToken = crypto_1.default.randomBytes(32).toString('hex');
                await invitation.save();
            }
            await AuditLogService_1.auditLogService.logEvent({
                entityType: 'user',
                entityId: invitation.email,
                action: 'updated',
                userId: req.user.sub,
                businessId,
                userRole: req.user.app_metadata.role,
                userPermissions: req.user.app_metadata.permissions || [],
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    operationType: 'invitation_resend'
                },
                severity: 'low'
            });
            res.json({
                message: 'Invitation resent successfully',
                invitation: {
                    id: invitation._id,
                    email: invitation.email,
                    role: invitation.role,
                    expiresAt: invitation.expiresAt
                }
            });
        }
        catch (error) {
            utils_1.logger.error('Error resending invitation:', error);
            res.status(500).json({
                error: 'Failed to resend invitation',
                message: 'An error occurred while resending the invitation'
            });
        }
    }
    async revokeInvitation(req, res) {
        try {
            const { businessId, invitationId } = req.params;
            const { reason } = req.body;
            const invitation = await models_1.UserInvitation.findOne({
                _id: invitationId,
                businessId,
                status: 'pending'
            });
            if (!invitation) {
                return res.status(404).json({
                    error: 'Invitation not found',
                    message: 'No pending invitation found'
                });
            }
            if (invitation.revoke) {
                invitation.revoke(req.user.sub, reason);
            }
            await invitation.save();
            await AuditLogService_1.auditLogService.logEvent({
                entityType: 'user',
                entityId: invitation.email,
                action: 'deleted',
                userId: req.user.sub,
                businessId,
                userRole: req.user.app_metadata.role,
                userPermissions: req.user.app_metadata.permissions || [],
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    operationType: 'invitation_revocation'
                },
                severity: 'medium'
            });
            res.json({
                message: 'Invitation revoked successfully',
                invitationId,
                revokedBy: req.user.sub,
                reason
            });
        }
        catch (error) {
            utils_1.logger.error('Error revoking invitation:', error);
            res.status(500).json({
                error: 'Failed to revoke invitation',
                message: 'An error occurred while revoking the invitation'
            });
        }
    }
    async getCurrentUser(req, res) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Authentication required',
                    message: 'User not authenticated'
                });
            }
            const localUser = await models_1.User.findOne({ auth0Id: req.user.sub })
                .select('-securityMetadata.failedLoginAttempts -securityMetadata.lockedUntil');
            const userProfile = {
                id: req.user.sub,
                email: req.user.email,
                name: req.user.name,
                emailVerified: req.user.email_verified,
                role: req.user.app_metadata?.role,
                businessId: req.user.app_metadata?.businessId,
                permissions: req.user.app_metadata?.permissions || [],
                preferences: localUser?.preferences,
                lastLogin: localUser?.lastLogin,
                businessAccesses: localUser?.businessAccesses.filter(ba => ba.isActive) || []
            };
            res.json({ user: userProfile });
        }
        catch (error) {
            utils_1.logger.error('Error getting current user:', error);
            res.status(500).json({
                error: 'Failed to get user profile',
                message: 'An error occurred while retrieving user profile'
            });
        }
    }
    async updateUserPreferences(req, res) {
        try {
            const { timezone, currency, language, emailNotifications, securityAlerts } = req.body;
            const user = await models_1.User.findOne({ auth0Id: req.user.sub });
            if (!user) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User profile not found'
                });
            }
            const oldPreferences = { ...user.preferences };
            if (timezone !== undefined)
                user.preferences.timezone = timezone;
            if (currency !== undefined)
                user.preferences.currency = currency;
            if (language !== undefined)
                user.preferences.language = language;
            if (emailNotifications !== undefined)
                user.preferences.emailNotifications = emailNotifications;
            if (securityAlerts !== undefined)
                user.preferences.securityAlerts = securityAlerts;
            await user.save();
            await AuditLogService_1.auditLogService.logEvent({
                entityType: 'user',
                entityId: req.user.sub,
                action: 'updated',
                userId: req.user.sub,
                businessId: req.user.app_metadata?.businessId || 'system',
                userRole: req.user.app_metadata.role,
                userPermissions: req.user.app_metadata.permissions || [],
                changes: {
                    before: oldPreferences,
                    after: user.preferences
                },
                metadata: {
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    operationType: 'user_preferences_update'
                },
                severity: 'low'
            });
            res.json({
                message: 'Preferences updated successfully',
                preferences: user.preferences
            });
        }
        catch (error) {
            utils_1.logger.error('Error updating user preferences:', error);
            res.status(500).json({
                error: 'Failed to update preferences',
                message: 'An error occurred while updating preferences'
            });
        }
    }
}
exports.UserController = UserController;
//# sourceMappingURL=UserController.js.map