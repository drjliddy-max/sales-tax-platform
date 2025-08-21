import { secureLogger } from './SecureLogger';

export class Logger {
  static info(message: string, data?: any) {
    secureLogger.info(message, data ? { data } : undefined);
  }
  
  static error(message: string, error?: any) {
    secureLogger.error(message, error ? { error } : undefined);
  }
  
  static debug(message: string, data?: any) {
    if (process.env.NODE_ENV === 'development') {
      secureLogger.debug(message, data ? { data } : undefined);
    }
  }
  
  static warn(message: string, data?: any) {
    secureLogger.warn(message, data ? { data } : undefined);
  }
}
