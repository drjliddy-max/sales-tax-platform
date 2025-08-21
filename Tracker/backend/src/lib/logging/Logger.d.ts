export declare enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}
export declare class Logger {
    private static instance;
    private logLevel;
    private logFile?;
    private constructor();
    static getInstance(): Logger;
    private parseLogLevel;
    private ensureLogDirectory;
    private formatLogEntry;
    private writeLog;
    private getColorForLevel;
    private log;
    error(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void;
    warn(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void;
    info(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void;
    debug(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void;
    posOperation(operation: string, posId: string, status: 'start' | 'success' | 'error', metadata?: any, userId?: string, requestId?: string): void;
    apiRequest(method: string, path: string, statusCode: number, duration: number, userId?: string, requestId?: string): void;
    authentication(event: 'login' | 'logout' | 'token_refresh' | 'auth_failure', userId?: string, metadata?: any, requestId?: string): void;
    database(operation: string, table: string, duration: number, error?: any, requestId?: string): void;
    rotateLogs(): void;
}
export declare const logger: Logger;
export declare const loggingMiddleware: (req: any, res: any, next: any) => void;
//# sourceMappingURL=Logger.d.ts.map