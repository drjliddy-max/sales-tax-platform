interface LogContext {
    [key: string]: any;
}
declare class SecureLogger {
    private formatTimestamp;
    private sanitizeContext;
    private log;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
}
export declare const secureLogger: SecureLogger;
export {};
//# sourceMappingURL=SecureLogger.d.ts.map