import { Request, Response, NextFunction } from 'express';
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
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireClient: (req: Request, res: Response, next: NextFunction) => void;
export declare const requirePermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map