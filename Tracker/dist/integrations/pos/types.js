"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSIntegrationError = void 0;
class POSIntegrationError extends Error {
    constructor(message, code, posType, statusCode, retryable = false, details) {
        super(message);
        this.code = code;
        this.posType = posType;
        this.statusCode = statusCode;
        this.retryable = retryable;
        this.details = details;
        this.name = 'POSIntegrationError';
    }
}
exports.POSIntegrationError = POSIntegrationError;
//# sourceMappingURL=types.js.map