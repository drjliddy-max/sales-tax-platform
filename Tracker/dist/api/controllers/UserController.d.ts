import { Request, Response } from 'express';
export declare class UserController {
    getBusinessUsers(req: Request, res: Response): Promise<any>;
    inviteUser(req: Request, res: Response): Promise<any>;
    updateUserRole(req: Request, res: Response): Promise<any>;
    revokeUserAccess(req: Request, res: Response): Promise<any>;
    getInvitations(req: Request, res: Response): Promise<any>;
    resendInvitation(req: Request, res: Response): Promise<any>;
    revokeInvitation(req: Request, res: Response): Promise<any>;
    getCurrentUser(req: Request, res: Response): Promise<any>;
    updateUserPreferences(req: Request, res: Response): Promise<any>;
}
//# sourceMappingURL=UserController.d.ts.map