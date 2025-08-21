import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}
export interface ApiError extends Error {
    statusCode: number;
    code?: string;
    details?: ValidationError[];
    isOperational: boolean;
}
export declare class AppError extends Error implements ApiError {
    statusCode: number;
    code?: string;
    details?: ValidationError[];
    isOperational: boolean;
    constructor(message: string, statusCode?: number, code?: string, details?: ValidationError[], isOperational?: boolean);
}
export declare const validateSchema: (schema: Joi.ObjectSchema, property?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => void;
export declare const commonSchemas: {
    pagination: Joi.ObjectSchema<any>;
    dateRange: Joi.ObjectSchema<any>;
    businessId: Joi.StringSchema<string>;
    mongoId: Joi.StringSchema<string>;
    email: Joi.StringSchema<string>;
    currency: Joi.ObjectSchema<any>;
    address: Joi.ObjectSchema<any>;
};
export declare const sanitizeInput: {
    stripHtml: (str: string) => string;
    normalizeEmail: (email: string) => string;
    normalizePhone: (phone: string) => string;
    capitalizeState: (state: string) => string;
    normalizeZipCode: (zipCode: string) => string;
};
export declare const createUserRateLimit: (windowMs: number, maxRequests: number) => (req: any, res: Response, next: NextFunction) => void;
export declare const validateBusinessAccess: (req: any, res: Response, next: NextFunction) => Promise<void>;
export declare const validateRequestSize: (maxSizeKB?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const validateContentType: (allowedTypes?: string[]) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map