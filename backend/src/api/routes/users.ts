import express from 'express';
import { UserController } from '@/api/controllers/UserController';
import { 
  requireAuth, 
  enrichUserContext, 
  requireRole, 
  requirePermission,
  requireBusinessAccess,
  requireBusinessOwner,
  auditSecurityEvent,
  authRateLimit 
} from '@/api/middleware/auth';

const router = express.Router();
const userController = new UserController();

// Apply base authentication and rate limiting to all routes
router.use(authRateLimit(10, 15 * 60 * 1000)); // 10 requests per 15 minutes
router.use(requireAuth);
router.use(enrichUserContext);

// Get current user profile
router.get('/me', 
  auditSecurityEvent('user_profile_access'),
  userController.getCurrentUser.bind(userController)
);

// Update current user preferences
router.put('/me/preferences',
  auditSecurityEvent('user_preferences_update'),
  userController.updateUserPreferences.bind(userController)
);

// Business-specific user management routes
router.use('/business/:businessId', requireBusinessAccess);

// Get all users for a business (business owners and admins only)
router.get('/business/:businessId',
  requireRole(['business_owner', 'admin']),
  auditSecurityEvent('user_list_access'),
  userController.getBusinessUsers.bind(userController)
);

// Invite new user to business (business owners only)
router.post('/business/:businessId/invite',
  requireBusinessOwner,
  requirePermission(['write:users', 'manage:business']),
  auditSecurityEvent('user_invitation'),
  userController.inviteUser.bind(userController)
);

// Update user role (business owners only)
router.put('/business/:businessId/users/:userId/role',
  requireBusinessOwner,
  requirePermission(['write:users', 'manage:business']),
  auditSecurityEvent('user_role_update'),
  userController.updateUserRole.bind(userController)
);

// Revoke user access (business owners only)
router.delete('/business/:businessId/users/:userId',
  requireBusinessOwner,
  requirePermission(['write:users', 'manage:business']),
  auditSecurityEvent('user_access_revocation'),
  userController.revokeUserAccess.bind(userController)
);

// Invitation management routes
router.get('/business/:businessId/invitations',
  requireRole(['business_owner', 'admin']),
  requirePermission(['read:users']),
  auditSecurityEvent('invitation_list_access'),
  userController.getInvitations.bind(userController)
);

router.post('/business/:businessId/invitations/:invitationId/resend',
  requireBusinessOwner,
  requirePermission(['write:users']),
  auditSecurityEvent('invitation_resend'),
  userController.resendInvitation.bind(userController)
);

router.delete('/business/:businessId/invitations/:invitationId',
  requireBusinessOwner,
  requirePermission(['write:users']),
  auditSecurityEvent('invitation_revocation'),
  userController.revokeInvitation.bind(userController)
);

export default router;