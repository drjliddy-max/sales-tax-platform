// Re-export all middleware
export * from './cache';
export * from './validation';
export * from './errorHandler';
export { 
  securityHeaders, 
  requestId, 
  sqlInjectionProtection,
  xssProtection,
  corsOptions,
  rateLimits,
  healthCheck,
  validateEnvironment,
  requireBusinessOwnership,
  auditLogger,
  sanitizeInput as sanitizeInputMiddleware
} from './security';

// Legacy validateRequest for backward compatibility
export { validateSchema as validateRequest } from './validation';