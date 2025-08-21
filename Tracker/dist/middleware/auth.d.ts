export interface AuthRequest extends Request {
    auth: {
        userId: string;
        sessionClaims?: any;
    };
    user?: {
        id: string;
        clerkUserId: string;
        email: string;
        firstName?: string;
        lastName?: string;
        role: string;
        isActive: boolean;
        businesses?: any[];
    };
}
export declare const requireAuth: (req: any, res: any, next: any) => Promise<any>;
export declare const requireUser: (req: any, res: any, next: any) => Promise<any>;
export declare const requireAdmin: (req: any, res: any, next: any) => Promise<any>;
export declare const requireClient: (req: any, res: any, next: any) => Promise<any>;
export declare const requireBusinessOwner: (req: any, res: any, next: any) => Promise<any>;
export declare const protectRoute: ((req: any, res: any, next: any) => Promise<any>)[];
export declare const protectAdminRoute: ((req: any, res: any, next: any) => Promise<any>)[];
export declare const protectClientRoute: ((req: any, res: any, next: any) => Promise<any>)[];
export declare const protectBusinessRoute: ((req: any, res: any, next: any) => Promise<any>)[];
export declare const protectRouteOld: (req: any, res: any, next: any) => void;
//# sourceMappingURL=auth.d.ts.map