import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/Logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  Logger.info(`${req.method} ${req.originalUrl} - Started`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method === 'POST' ? req.body : undefined
  });
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    Logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
};