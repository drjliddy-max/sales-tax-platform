"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureLogger = void 0;
class SecureLogger {
    formatTimestamp() {
        return new Date().toISOString();
    }
    sanitizeContext(context) {
        const sanitized = {};
        for (const [key, value] of Object.entries(context)) {
            const safeKey = key.replace(/[^\w.-]/g, '_');
            if (typeof value === 'string') {
                sanitized[safeKey] = value.substring(0, 1000).replace(/[\r\n\t]/g, ' ');
            }
            else if (typeof value === 'number' || typeof value === 'boolean') {
                sanitized[safeKey] = value;
            }
            else if (value instanceof Date) {
                sanitized[safeKey] = value.toISOString();
            }
            else if (value instanceof Error) {
                sanitized[safeKey] = {
                    name: value.name,
                    message: value.message,
                    stack: value.stack?.substring(0, 1000)
                };
            }
            else if (value !== null && typeof value === 'object') {
                try {
                    sanitized[safeKey] = JSON.stringify(value).substring(0, 1000);
                }
                catch {
                    sanitized[safeKey] = '[Object]';
                }
            }
            else {
                sanitized[safeKey] = String(value).substring(0, 100);
            }
        }
        return sanitized;
    }
    log(entry) {
        const logLine = JSON.stringify({
            timestamp: entry.timestamp,
            level: entry.level.toUpperCase(),
            message: entry.message,
            ...entry.context
        });
        switch (entry.level) {
            case 'error':
                console.error(logLine);
                break;
            case 'warn':
                console.warn(logLine);
                break;
            case 'debug':
                console.debug(logLine);
                break;
            default:
                console.log(logLine);
                break;
        }
    }
    info(message, context) {
        this.log({
            level: 'info',
            message,
            timestamp: this.formatTimestamp(),
            context: context ? this.sanitizeContext(context) : undefined
        });
    }
    warn(message, context) {
        this.log({
            level: 'warn',
            message,
            timestamp: this.formatTimestamp(),
            context: context ? this.sanitizeContext(context) : undefined
        });
    }
    error(message, context) {
        this.log({
            level: 'error',
            message,
            timestamp: this.formatTimestamp(),
            context: context ? this.sanitizeContext(context) : undefined
        });
    }
    debug(message, context) {
        this.log({
            level: 'debug',
            message,
            timestamp: this.formatTimestamp(),
            context: context ? this.sanitizeContext(context) : undefined
        });
    }
}
exports.secureLogger = new SecureLogger();
//# sourceMappingURL=SecureLogger.js.map