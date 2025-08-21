"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const UserController_1 = require("@/api/controllers/UserController");
const auth_1 = require("@/api/middleware/auth");
const router = express_1.default.Router();
const userController = new UserController_1.UserController();
router.use((0, auth_1.authRateLimit)(10, 15 * 60 * 1000));
router.use(auth_1.requireAuth);
router.use(auth_1.enrichUserContext);
router.get('/me', (0, auth_1.auditSecurityEvent)('user_profile_access'), userController.getCurrentUser.bind(userController));
router.put('/me/preferences', (0, auth_1.auditSecurityEvent)('user_preferences_update'), userController.updateUserPreferences.bind(userController));
router.use('/business/:businessId', auth_1.requireBusinessAccess);
router.get('/business/:businessId', (0, auth_1.requireRole)(['business_owner', 'admin']), (0, auth_1.auditSecurityEvent)('user_list_access'), userController.getBusinessUsers.bind(userController));
router.post('/business/:businessId/invite', auth_1.requireBusinessOwner, (0, auth_1.requirePermission)(['write:users', 'manage:business']), (0, auth_1.auditSecurityEvent)('user_invitation'), userController.inviteUser.bind(userController));
router.put('/business/:businessId/users/:userId/role', auth_1.requireBusinessOwner, (0, auth_1.requirePermission)(['write:users', 'manage:business']), (0, auth_1.auditSecurityEvent)('user_role_update'), userController.updateUserRole.bind(userController));
router.delete('/business/:businessId/users/:userId', auth_1.requireBusinessOwner, (0, auth_1.requirePermission)(['write:users', 'manage:business']), (0, auth_1.auditSecurityEvent)('user_access_revocation'), userController.revokeUserAccess.bind(userController));
router.get('/business/:businessId/invitations', (0, auth_1.requireRole)(['business_owner', 'admin']), (0, auth_1.requirePermission)(['read:users']), (0, auth_1.auditSecurityEvent)('invitation_list_access'), userController.getInvitations.bind(userController));
router.post('/business/:businessId/invitations/:invitationId/resend', auth_1.requireBusinessOwner, (0, auth_1.requirePermission)(['write:users']), (0, auth_1.auditSecurityEvent)('invitation_resend'), userController.resendInvitation.bind(userController));
router.delete('/business/:businessId/invitations/:invitationId', auth_1.requireBusinessOwner, (0, auth_1.requirePermission)(['write:users']), (0, auth_1.auditSecurityEvent)('invitation_revocation'), userController.revokeInvitation.bind(userController));
exports.default = router;
//# sourceMappingURL=users.js.map