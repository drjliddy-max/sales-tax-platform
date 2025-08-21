/**
 * Enhanced Logging System for POS Integration
 * Provides comprehensive logging with different levels and outputs
 */

import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  component: string;
  message: string;
  metadata?: any;
  userId?: string;
  requestId?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logFile?: string;

  private constructor() {
    this.logLevel = this.parseLogLevel(config.logging.level);
    
    if (config.logging.enableFile && config.logging.logFile) {
      this.logFile = config.logging.logFile;
      this.ensureLogDirectory();
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: return LogLevel.INFO;
    }
  }

  private ensureLogDirectory(): void {
    if (!this.logFile) return;
    
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, component, message, metadata, userId, requestId } = entry;
    
    let logLine = `[${timestamp}] ${level.toUpperCase()} [${component}]`;
    
    if (requestId) logLine += ` [req:${requestId}]`;
    if (userId) logLine += ` [user:${userId}]`;
    
    logLine += ` ${message}`;
    
    if (metadata) {
      logLine += ` | ${JSON.stringify(metadata)}`;
    }
    
    return logLine;
  }

  private writeLog(entry: LogEntry): void {
    const formattedEntry = this.formatLogEntry(entry);
    
    // Console output
    if (config.logging.enableConsole) {
      const levelColor = this.getColorForLevel(entry.level);
      console.log(levelColor + formattedEntry + '\x1b[0m');
    }
    
    // File output
    if (this.logFile && config.logging.enableFile) {
      fs.appendFileSync(this.logFile, formattedEntry + '\n');
    }
  }

  private getColorForLevel(level: string): string {
    switch (level.toLowerCase()) {
      case 'error': return '\x1b[31m'; // Red
      case 'warn': return '\x1b[33m';  // Yellow
      case 'info': return '\x1b[36m';  // Cyan
      case 'debug': return '\x1b[37m'; // White
      default: return '\x1b[0m';       // Reset
    }
  }

  private log(level: LogLevel, component: string, message: string, metadata?: any, userId?: string, requestId?: string): void {
    if (level > this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level].toLowerCase(),
      component,
      message,
      metadata,
      userId,
      requestId
    };

    this.writeLog(entry);
  }

  // Public logging methods
  error(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void {
    this.log(LogLevel.ERROR, component, message, metadata, userId, requestId);
  }

  warn(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void {
    this.log(LogLevel.WARN, component, message, metadata, userId, requestId);
  }

  info(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void {
    this.log(LogLevel.INFO, component, message, metadata, userId, requestId);
  }

  debug(component: string, message: string, metadata?: any, userId?: string, requestId?: string): void {
    this.log(LogLevel.DEBUG, component, message, metadata, userId, requestId);
  }

  // POS-specific logging methods
  posOperation(operation: string, posId: string, status: 'start' | 'success' | 'error', metadata?: any, userId?: string, requestId?: string): void {
    const message = `POS ${operation} for ${posId}: ${status}`;
    const logMetadata = { operation, posId, status, ...metadata };
    
    if (status === 'error') {
      this.error('POS', message, logMetadata, userId, requestId);
    } else {
      this.info('POS', message, logMetadata, userId, requestId);
    }
  }

  apiRequest(method: string, path: string, statusCode: number, duration: number, userId?: string, requestId?: string): void {
    const message = `${method} ${path} - ${statusCode} (${duration}ms)`;
    const metadata = { method, path, statusCode, duration };
    
    if (statusCode >= 500) {
      this.error('API', message, metadata, userId, requestId);
    } else if (statusCode >= 400) {
      this.warn('API', message, metadata, userId, requestId);
    } else {
      this.info('API', message, metadata, userId, requestId);
    }
  }

  authentication(event: 'login' | 'logout' | 'token_refresh' | 'auth_failure', userId?: string, metadata?: any, requestId?: string): void {
    const message = `Authentication event: ${event}`;
    const logMetadata = { event, ...metadata };
    
    if (event === 'auth_failure') {
      this.warn('AUTH', message, logMetadata, userId, requestId);
    } else {
      this.info('AUTH', message, logMetadata, userId, requestId);
    }
  }

  database(operation: string, table: string, duration: number, error?: any, requestId?: string): void {
    const message = `DB ${operation} on ${table} (${duration}ms)`;
    const metadata = { operation, table, duration };
    
    if (error) {
      this.error('DB', `${message} - Error: ${error.message}`, { ...metadata, error: error.stack }, undefined, requestId);
    } else {
      this.debug('DB', message, metadata, undefined, requestId);
    }
  }

  // Log rotation and cleanup
  rotateLogs(): void {
    if (!this.logFile || !fs.existsSync(this.logFile)) return;

    const stats = fs.statSync(this.logFile);
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (stats.size > maxSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = `${this.logFile}.${timestamp}`;
      
      fs.renameSync(this.logFile, rotatedFile);
      this.info('LOGGER', `Log rotated to ${rotatedFile}`);
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export middleware for Express
export const loggingMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Log incoming request
  logger.info('API', `Incoming ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent']
  }, req.user?.id, requestId);

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const duration = Date.now() - startTime;
    logger.apiRequest(req.method, req.path, res.statusCode, duration, req.user?.id, requestId);
    originalEnd.call(res, chunk, encoding);
  };

  next();
};
