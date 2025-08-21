/**
 * Secure structured logging utility to replace unsafe format string logging
 * Prevents format string injection attacks by using structured logging
 */

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  context?: LogContext;
}

class SecureLogger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private sanitizeContext(context: LogContext): LogContext {
    const sanitized: LogContext = {};
    
    for (const [key, value] of Object.entries(context)) {
      // Sanitize key to prevent injection
      const safeKey = key.replace(/[^\w.-]/g, '_');
      
      // Sanitize value based on type
      if (typeof value === 'string') {
        // Truncate long strings and escape dangerous characters
        sanitized[safeKey] = value.substring(0, 1000).replace(/[\r\n\t]/g, ' ');
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[safeKey] = value;
      } else if (value instanceof Date) {
        sanitized[safeKey] = value.toISOString();
      } else if (value instanceof Error) {
        sanitized[safeKey] = {
          name: value.name,
          message: value.message,
          stack: value.stack?.substring(0, 1000)
        };
      } else if (value !== null && typeof value === 'object') {
        // Serialize objects safely
        try {
          sanitized[safeKey] = JSON.stringify(value).substring(0, 1000);
        } catch {
          sanitized[safeKey] = '[Object]';
        }
      } else {
        sanitized[safeKey] = String(value).substring(0, 100);
      }
    }
    
    return sanitized;
  }

  private log(entry: LogEntry): void {
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

  info(message: string, context?: LogContext): void {
    this.log({
      level: 'info',
      message,
      timestamp: this.formatTimestamp(),
      context: context ? this.sanitizeContext(context) : undefined
    });
  }

  warn(message: string, context?: LogContext): void {
    this.log({
      level: 'warn',
      message,
      timestamp: this.formatTimestamp(),
      context: context ? this.sanitizeContext(context) : undefined
    });
  }

  error(message: string, context?: LogContext): void {
    this.log({
      level: 'error',
      message,
      timestamp: this.formatTimestamp(),
      context: context ? this.sanitizeContext(context) : undefined
    });
  }

  debug(message: string, context?: LogContext): void {
    this.log({
      level: 'debug',
      message,
      timestamp: this.formatTimestamp(),
      context: context ? this.sanitizeContext(context) : undefined
    });
  }
}

export const secureLogger = new SecureLogger();
