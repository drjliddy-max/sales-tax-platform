import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            businessId?: string;
            userId?: string;
            sentryTransaction?: any;
        }
    }
}
export declare const sentryRequestHandler: () => (req: Request, res: Response, next: NextFunction) => void;
export declare const sentryTracingHandler: () => (req: Request, res: Response, next: NextFunction) => void;
export declare const sentryErrorHandler: () => (error: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const businessContextMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const financialOperationMiddleware: (operationType: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const auditMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const performanceMonitoringMiddleware: (req: Request, res: Response, next: NextFunction) => void;
export declare const financialErrorBoundary: (error: Error, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=sentry.d.ts.map