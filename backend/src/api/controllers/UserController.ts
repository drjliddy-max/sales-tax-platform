import { Request, Response } from 'express';
import { User, UserInvitation, Business } from '@/models';
import { auth0Service, UserRole } from '@/services/auth/Auth0Service';
import { auditLogService } from '@/services/auth/AuditLogService';
import { sentryService } from '@/services/monitoring/SentryService';
import { logger } from '@/utils';
import crypto from 'crypto';

export class UserController {
  
  // Get all users for a business
  public async getBusinessUsers(req: Request, res: Response): Promise<any> {
    try {
      const { businessId } = req.params;
      
      // Get users from Auth0
      const auth0Users = await auth0Service.getBusinessUsers(businessId);
      
      // Get local user records
      const localUsers = await User.find({
        'businessAccesses.businessId': businessId,
        'businessAccesses.isActive': true
      }).select('-securityMetadata -businessAccesses.grantedBy');

      // Combine Auth0 and local data
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

      await auditLogService.logEvent({
        entityType: 'user',
        entityId: businessId,
        action: 'accessed',
        userId: req.user!.sub,
        businessId,
        userRole: req.user!.app_metadata!.role,
        userPermissions: req.user!.app_metadata!.permissions || [],
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path,
          method: req.method,
          operationType: 'user_list_access'
        }
      });

      res.json({ users, total: users.length });

    } catch (error) {
      logger.error('Error getting business users:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to get business users'),
        { businessId: req.params.businessId, severity: 'medium' }
      );
      res.status(500).json({
        error: 'Failed to retrieve users',
        message: 'An error occurred while retrieving business users'
      });
    }
  }

  // Invite a new user to a business
  public async inviteUser(req: Request, res: Response): Promise<any> {
    try {
      const { businessId } = req.params;
      const { email, role, message } = req.body;

      // Validate input
      if (!email || !role) {
        res.status(400).json({
          error: 'Missing required fields',
          message: 'Email and role are required'
        });
        return;
      }

      // Check if business exists
      const business = await Business.findOne({ businessId });
      if (!business) {
        return res.status(404).json({
          error: 'Business not found',
          message: 'The specified business does not exist'
        });
      }

      // Check if user already exists for this business
      const existingUser = await User.findOne({
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

      // Check for existing pending invitation
      const existingInvitation = await UserInvitation.findOne({
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

      // Generate invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Get permissions for role
      const permissions = auth0Service.getPermissionsForRole(role as UserRole);

      // Create invitation record
      const invitation = new UserInvitation({
        email: email.toLowerCase(),
        businessId,
        role,
        permissions,
        invitedBy: req.user!.sub,
        invitationToken,
        expiresAt,
        metadata: {
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          invitationMessage: message
        }
      });

      await invitation.save();

      // Create Auth0 user (they'll need to set password on first login)
      const auth0UserId = await auth0Service.createBusinessUser(
        email,
        businessId,
        role as UserRole,
        req.user!.sub
      );

      if (!auth0UserId) {
        if (invitation.revoke) {
          invitation.revoke(req.user!.sub, 'Failed to create Auth0 user');
          await invitation.save();
        }
        return res.status(500).json({
          error: 'Failed to create user',
          message: 'Could not create user account'
        });
      }

      // Create local user record
      const localUser = new User({
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
          grantedBy: req.user!.sub
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

      await auditLogService.logEvent({
        entityType: 'user',
        entityId: auth0UserId,
        action: 'created',
        userId: req.user!.sub,
        businessId,
        userRole: req.user!.app_metadata!.role,
        userPermissions: req.user!.app_metadata!.permissions || [],
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

    } catch (error) {
      logger.error('Error inviting user:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to invite user'),
        { businessId: req.params.businessId, severity: 'high' }
      );
      res.status(500).json({
        error: 'Failed to invite user',
        message: 'An error occurred while creating the user invitation'
      });
    }
  }

  // Update user role and permissions
  public async updateUserRole(req: Request, res: Response): Promise<any> {
    try {
      const { businessId, userId } = req.params;
      const { role, permissions } = req.body;

      // Validate input
      if (!role) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Role is required'
        });
      }

      // Get current user data for audit trail
      const currentUser = await User.findOne({ auth0Id: userId });
      if (!currentUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in the system'
        });
      }

      const currentAccess = currentUser.businessAccesses.find(
        ba => ba.businessId === businessId && ba.isActive
      );

      if (!currentAccess) {
        return res.status(404).json({
          error: 'User access not found',
          message: 'User does not have access to this business'
        });
      }

      // Update Auth0 user metadata
      const defaultPermissions = auth0Service.getPermissionsForRole(role as UserRole);
      const finalPermissions = permissions || defaultPermissions;

      const success = await auth0Service.updateUserRole(
        userId,
        businessId,
        role as UserRole,
        finalPermissions
      );

      if (!success) {
        return res.status(500).json({
          error: 'Failed to update user',
          message: 'Could not update user role in Auth0'
        });
      }

      // Update local user record
      currentAccess.role = role;
      currentAccess.permissions = finalPermissions;
      await currentUser.save();

      await auditLogService.logEvent({
        entityType: 'user',
        entityId: userId,
        action: 'updated',
        userId: req.user!.sub,
        businessId,
        userRole: req.user!.app_metadata!.role,
        userPermissions: req.user!.app_metadata!.permissions || [],
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

    } catch (error) {
      logger.error('Error updating user role:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to update user role'),
        { businessId: req.params.businessId, severity: 'high' }
      );
      res.status(500).json({
        error: 'Failed to update user',
        message: 'An error occurred while updating user role'
      });
    }
  }

  // Revoke user access to a business
  public async revokeUserAccess(req: Request, res: Response): Promise<any> {
    try {
      const { businessId, userId } = req.params;

      // Get current user data for audit trail
      const currentUser = await User.findOne({ auth0Id: userId });
      if (!currentUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in the system'
        });
      }

      // Revoke Auth0 access
      const success = await auth0Service.revokeBusinessAccess(userId, businessId);
      if (!success) {
        return res.status(500).json({
          error: 'Failed to revoke access',
          message: 'Could not revoke user access in Auth0'
        });
      }

      // Update local user record
      if (currentUser.revokeBusinessAccess) {
        currentUser.revokeBusinessAccess(businessId, req.user!.sub);
      }
      await currentUser.save();

      await auditLogService.logEvent({
        entityType: 'user',
        entityId: userId,
        action: 'updated',
        userId: req.user!.sub,
        businessId,
        userRole: req.user!.app_metadata!.role,
        userPermissions: req.user!.app_metadata!.permissions || [],
        changes: {
          after: {
            accessRevoked: true,
            revokedBy: req.user!.sub,
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
        revokedBy: req.user!.sub,
        revokedAt: new Date()
      });

    } catch (error) {
      logger.error('Error revoking user access:', error);
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Failed to revoke user access'),
        { businessId: req.params.businessId, severity: 'high' }
      );
      res.status(500).json({
        error: 'Failed to revoke access',
        message: 'An error occurred while revoking user access'
      });
    }
  }

  // Get user invitations for a business
  public async getInvitations(req: Request, res: Response): Promise<any> {
    try {
      const { businessId } = req.params;
      const { status } = req.query;

      const query: any = { businessId };
      if (status && ['pending', 'accepted', 'expired', 'revoked'].includes(status as string)) {
        query.status = status;
      }

      const invitations = await UserInvitation.find(query)
        .sort({ createdAt: -1 })
        .populate('invitedBy', 'email name')
        .select('-invitationToken'); // Don't expose token

      res.json({ invitations, total: invitations.length });

    } catch (error) {
      logger.error('Error getting invitations:', error);
      res.status(500).json({
        error: 'Failed to retrieve invitations',
        message: 'An error occurred while retrieving invitations'
      });
    }
  }

  // Resend user invitation
  public async resendInvitation(req: Request, res: Response): Promise<any> {
    try {
      const { businessId, invitationId } = req.params;

      const invitation = await UserInvitation.findOne({
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
        // Update expiration and regenerate token
        invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        invitation.invitationToken = crypto.randomBytes(32).toString('hex');
        await invitation.save();
      }

      await auditLogService.logEvent({
        entityType: 'user',
        entityId: invitation.email,
        action: 'updated',
        userId: req.user!.sub,
        businessId,
        userRole: req.user!.app_metadata!.role,
        userPermissions: req.user!.app_metadata!.permissions || [],
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

    } catch (error) {
      logger.error('Error resending invitation:', error);
      res.status(500).json({
        error: 'Failed to resend invitation',
        message: 'An error occurred while resending the invitation'
      });
    }
  }

  // Revoke user invitation
  public async revokeInvitation(req: Request, res: Response): Promise<any> {
    try {
      const { businessId, invitationId } = req.params;
      const { reason } = req.body;

      const invitation = await UserInvitation.findOne({
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
        invitation.revoke(req.user!.sub, reason);
      }
      await invitation.save();

      await auditLogService.logEvent({
        entityType: 'user',
        entityId: invitation.email,
        action: 'deleted',
        userId: req.user!.sub,
        businessId,
        userRole: req.user!.app_metadata!.role,
        userPermissions: req.user!.app_metadata!.permissions || [],
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
        revokedBy: req.user!.sub,
        reason
      });

    } catch (error) {
      logger.error('Error revoking invitation:', error);
      res.status(500).json({
        error: 'Failed to revoke invitation',
        message: 'An error occurred while revoking the invitation'
      });
    }
  }

  // Get current user profile
  public async getCurrentUser(req: Request, res: Response): Promise<any> {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
      }

      // Get local user data
      const localUser = await User.findOne({ auth0Id: req.user.sub })
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

    } catch (error) {
      logger.error('Error getting current user:', error);
      res.status(500).json({
        error: 'Failed to get user profile',
        message: 'An error occurred while retrieving user profile'
      });
    }
  }

  // Update user preferences
  public async updateUserPreferences(req: Request, res: Response): Promise<any> {
    try {
      const { timezone, currency, language, emailNotifications, securityAlerts } = req.body;

      const user = await User.findOne({ auth0Id: req.user!.sub });
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User profile not found'
        });
      }

      const oldPreferences = { ...user.preferences };

      // Update preferences
      if (timezone !== undefined) user.preferences.timezone = timezone;
      if (currency !== undefined) user.preferences.currency = currency;
      if (language !== undefined) user.preferences.language = language;
      if (emailNotifications !== undefined) user.preferences.emailNotifications = emailNotifications;
      if (securityAlerts !== undefined) user.preferences.securityAlerts = securityAlerts;

      await user.save();

      await auditLogService.logEvent({
        entityType: 'user',
        entityId: req.user!.sub,
        action: 'updated',
        userId: req.user!.sub,
        businessId: req.user!.app_metadata?.businessId || 'system',
        userRole: req.user!.app_metadata!.role,
        userPermissions: req.user!.app_metadata!.permissions || [],
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

    } catch (error) {
      logger.error('Error updating user preferences:', error);
      res.status(500).json({
        error: 'Failed to update preferences',
        message: 'An error occurred while updating preferences'
      });
    }
  }
}