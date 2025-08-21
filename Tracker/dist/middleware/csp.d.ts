import { Request, Response, NextFunction } from 'express';
interface CSPConfig {
    reportUri?: string;
    reportOnly?: boolean;
    nonce?: boolean;
}
export declare const createCSPMiddleware: (config?: CSPConfig) => (req: Request, res: Response, next: NextFunction) => void;
export declare const developmentCSP: (req: Request, res: Response, next: NextFunction) => void;
export declare const productionCSP: (req: Request, res: Response, next: NextFunction) => void;
export declare const cspReportHandler: (req: Request, res: Response) => void;
export declare const getNonce: (req: Request) => string | undefined;
export {};
//# sourceMappingURL=csp.d.ts.map