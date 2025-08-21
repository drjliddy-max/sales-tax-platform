import { Request, Response, NextFunction } from 'express';
import { AppError, ApiError } from './validation';
export interface ErrorResponse {
    error: {
        message: string;
        code?: string;
        details?: any[];
        timestamp: string;
        path: string;
        requestId?: string;
    };
}
export declare const errorHandler: (err: Error | ApiError, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const handleDatabaseError: (err: Error) => AppError;
export declare const BusinessErrors: {
    NotFound: () => AppError;
    AccessDenied: () => AppError;
    InactiveAccount: () => AppError;
    InvalidNexus: (state: string) => AppError;
};
export declare const TransactionErrors: {
    NotFound: () => AppError;
    InvalidAmount: () => AppError;
    RefundExceedsOriginal: () => AppError;
    AlreadyRefunded: () => AppError;
    TaxCalculationFailed: () => AppError;
};
export declare const IntegrationErrors: {
    NotFound: () => AppError;
    ConnectionFailed: (provider: string) => AppError;
    SyncInProgress: () => AppError;
    InvalidCredentials: (provider: string) => AppError;
    WebhookVerificationFailed: () => AppError;
};
export declare const AuthErrors: {
    Unauthorized: () => AppError;
    Forbidden: () => AppError;
    InvalidToken: () => AppError;
    TokenExpired: () => AppError;
    UserNotFound: () => AppError;
};
export declare const timeoutHandler: (timeoutMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map