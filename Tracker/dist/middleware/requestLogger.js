"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const Logger_1 = require("../utils/Logger");
const requestLogger = (req, res, next) => {
    const start = Date.now();
    Logger_1.Logger.info(`${req.method} ${req.originalUrl} - Started`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.method === 'POST' ? req.body : undefined
    });
    res.on('finish', () => {
        const duration = Date.now() - start;
        Logger_1.Logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=requestLogger.js.map