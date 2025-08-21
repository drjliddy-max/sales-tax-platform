"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loggingMiddleware = exports.logger = exports.Logger = exports.LogLevel = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../../config");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.logLevel = this.parseLogLevel(config_1.config.logging.level);
        if (config_1.config.logging.enableFile && config_1.config.logging.logFile) {
            this.logFile = config_1.config.logging.logFile;
            this.ensureLogDirectory();
        }
    }
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    parseLogLevel(level) {
        switch (level.toLowerCase()) {
            case 'error': return LogLevel.ERROR;
            case 'warn': return LogLevel.WARN;
            case 'info': return LogLevel.INFO;
            case 'debug': return LogLevel.DEBUG;
            default: return LogLevel.INFO;
        }
    }
    ensureLogDirectory() {
        if (!this.logFile)
            return;
        const logDir = path_1.default.dirname(this.logFile);
        if (!fs_1.default.existsSync(logDir)) {
            fs_1.default.mkdirSync(logDir, { recursive: true });
        }
    }
    formatLogEntry(entry) {
        const { timestamp, level, component, message, metadata, userId, requestId } = entry;
        let logLine = `[${timestamp}] ${level.toUpperCase()} [${component}]`;
        if (requestId)
            logLine += ` [req:${requestId}]`;
        if (userId)
            logLine += ` [user:${userId}]`;
        logLine += ` ${message}`;
        if (metadata) {
            logLine += ` | ${JSON.stringify(metadata)}`;
        }
        return logLine;
    }
    writeLog(entry) {
        const formattedEntry = this.formatLogEntry(entry);
        if (config_1.config.logging.enableConsole) {
            const levelColor = this.getColorForLevel(entry.level);
            console.log(levelColor + formattedEntry + '\x1b[0m');
        }
        if (this.logFile && config_1.config.logging.enableFile) {
            fs_1.default.appendFileSync(this.logFile, formattedEntry + '\n');
        }
    }
    getColorForLevel(level) {
        switch (level.toLowerCase()) {
            case 'error': return '\x1b[31m';
            case 'warn': return '\x1b[33m';
            case 'info': return '\x1b[36m';
            case 'debug': return '\x1b[37m';
            default: return '\x1b[0m';
        }
    }
    log(level, component, message, metadata, userId, requestId) {
        if (level > this.logLevel)
            return;
        const entry = {
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
    error(component, message, metadata, userId, requestId) {
        this.log(LogLevel.ERROR, component, message, metadata, userId, requestId);
    }
    warn(component, message, metadata, userId, requestId) {
        this.log(LogLevel.WARN, component, message, metadata, userId, requestId);
    }
    info(component, message, metadata, userId, requestId) {
        this.log(LogLevel.INFO, component, message, metadata, userId, requestId);
    }
    debug(component, message, metadata, userId, requestId) {
        this.log(LogLevel.DEBUG, component, message, metadata, userId, requestId);
    }
    posOperation(operation, posId, status, metadata, userId, requestId) {
        const message = `POS ${operation} for ${posId}: ${status}`;
        const logMetadata = { operation, posId, status, ...metadata };
        if (status === 'error') {
            this.error('POS', message, logMetadata, userId, requestId);
        }
        else {
            this.info('POS', message, logMetadata, userId, requestId);
        }
    }
    apiRequest(method, path, statusCode, duration, userId, requestId) {
        const message = `${method} ${path} - ${statusCode} (${duration}ms)`;
        const metadata = { method, path, statusCode, duration };
        if (statusCode >= 500) {
            this.error('API', message, metadata, userId, requestId);
        }
        else if (statusCode >= 400) {
            this.warn('API', message, metadata, userId, requestId);
        }
        else {
            this.info('API', message, metadata, userId, requestId);
        }
    }
    authentication(event, userId, metadata, requestId) {
        const message = `Authentication event: ${event}`;
        const logMetadata = { event, ...metadata };
        if (event === 'auth_failure') {
            this.warn('AUTH', message, logMetadata, userId, requestId);
        }
        else {
            this.info('AUTH', message, logMetadata, userId, requestId);
        }
    }
    database(operation, table, duration, error, requestId) {
        const message = `DB ${operation} on ${table} (${duration}ms)`;
        const metadata = { operation, table, duration };
        if (error) {
            this.error('DB', `${message} - Error: ${error.message}`, { ...metadata, error: error.stack }, undefined, requestId);
        }
        else {
            this.debug('DB', message, metadata, undefined, requestId);
        }
    }
    rotateLogs() {
        if (!this.logFile || !fs_1.default.existsSync(this.logFile))
            return;
        const stats = fs_1.default.statSync(this.logFile);
        const maxSize = 10 * 1024 * 1024;
        if (stats.size > maxSize) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedFile = `${this.logFile}.${timestamp}`;
            fs_1.default.renameSync(this.logFile, rotatedFile);
            this.info('LOGGER', `Log rotated to ${rotatedFile}`);
        }
    }
}
exports.Logger = Logger;
exports.logger = Logger.getInstance();
const loggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substr(2, 9);
    req.requestId = requestId;
    exports.logger.info('API', `Incoming ${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        query: req.query,
        userAgent: req.headers['user-agent']
    }, req.user?.id, requestId);
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const duration = Date.now() - startTime;
        exports.logger.apiRequest(req.method, req.path, res.statusCode, duration, req.user?.id, requestId);
        originalEnd.call(res, chunk, encoding);
    };
    next();
};
exports.loggingMiddleware = loggingMiddleware;
//# sourceMappingURL=Logger.js.map