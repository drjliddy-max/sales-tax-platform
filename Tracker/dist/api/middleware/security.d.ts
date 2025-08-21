import { Request, Response, NextFunction } from 'express';
export declare const createRateLimit: (windowMs: number, max: number, message?: string) => import("express-rate-limit").RateLimitRequestHandler;
export declare const rateLimits: {
    api: import("express-rate-limit").RateLimitRequestHandler;
    auth: import("express-rate-limit").RateLimitRequestHandler;
    transactions: import("express-rate-limit").RateLimitRequestHandler;
    reports: import("express-rate-limit").RateLimitRequestHandler;
    webhooks: import("express-rate-limit").RateLimitRequestHandler;
    taxCalculation: import("express-rate-limit").RateLimitRequestHandler;
};
export declare const securityHeaders: (req: Request, res: Response, next: NextFunction) => void;
export declare const requestId: (req: Request, res: Response, next: NextFunction) => void;
export declare const sqlInjectionProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const xssProtection: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireBusinessOwnership: (req: any, res: Response, next: NextFunction) => Promise<void>;
export declare const auditLogger: (action: string, entityType: string) => (req: any, res: Response, next: NextFunction) => Promise<void>;
export declare const sanitizeInput: (req: Request, res: Response, next: NextFunction) => void;
export declare const corsOptions: {
    origin: (origin: string | undefined, callback: Function) => void;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
};
export declare const validateEnvironment: () => void;
export declare const healthCheck: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=security.d.ts.map