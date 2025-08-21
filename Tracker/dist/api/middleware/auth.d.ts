import { Request, Response, NextFunction } from 'express';
import { Auth0User, UserRole } from '@/services/auth/Auth0Service';
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
export declare const requireAuth: {
    (req: Request, res: Response, next: NextFunction): Promise<void>;
    unless: typeof import("express-unless").unless;
};
export declare const enrichUserContext: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (allowedRoles: UserRole | UserRole[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requirePermission: (permission: string | string[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireBusinessAccess: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireBusinessOwner: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireFinancialAccess: (operation: "read" | "write" | "calculate" | "report") => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const enforceDataIsolation: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const auditSecurityEvent: (operationType: string) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const authRateLimit: (maxAttempts?: number, windowMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map