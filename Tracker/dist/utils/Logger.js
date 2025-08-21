"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const SecureLogger_1 = require("./SecureLogger");
class Logger {
    static info(message, data) {
        SecureLogger_1.secureLogger.info(message, data ? { data } : undefined);
    }
    static error(message, error) {
        SecureLogger_1.secureLogger.error(message, error ? { error } : undefined);
    }
    static debug(message, data) {
        if (process.env.NODE_ENV === 'development') {
            SecureLogger_1.secureLogger.debug(message, data ? { data } : undefined);
        }
    }
    static warn(message, data) {
        SecureLogger_1.secureLogger.warn(message, data ? { data } : undefined);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=Logger.js.map