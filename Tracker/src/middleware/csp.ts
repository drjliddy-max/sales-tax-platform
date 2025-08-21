import { Request, Response, NextFunction } from 'express';

/**
 * Content Security Policy middleware to prevent XSS attacks
 * Implements strict CSP headers with secure defaults
 */

interface CSPConfig {
  reportUri?: string;
  reportOnly?: boolean;
  nonce?: boolean;
}

export const createCSPMiddleware = (config: CSPConfig = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate nonce for scripts if enabled
    const nonce = config.nonce ? generateNonce() : null;
    if (nonce) {
      (req as any).cspNonce = nonce;
    }

    // Build CSP directive
    const cspDirective = buildCSPDirective(config, nonce);
    
    // Set CSP header
    if (config.reportOnly) {
      res.setHeader('Content-Security-Policy-Report-Only', cspDirective);
    } else {
      res.setHeader('Content-Security-Policy', cspDirective);
    }

    // Additional security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    
    next();
  };
};

function buildCSPDirective(config: CSPConfig, nonce?: string): string {
  const directives = [
    // Default fallback for all resource types
    "default-src 'self'",
    
    // Scripts - only allow from self and specific CDNs with integrity checks
    `script-src 'self' https://cdn.tailwindcss.com${nonce ? ` 'nonce-${nonce}'` : ''}`,
    
    // Stylesheets - allow self and inline styles (for Tailwind CSS)
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
    
    // Images - allow self and data URIs for charts/graphics
    "img-src 'self' data: blob:",
    
    // Fonts - allow self and common font CDNs
    "font-src 'self'",
    
    // Media - only allow from self
    "media-src 'self'",
    
    // Objects - block all plugins
    "object-src 'none'",
    
    // Workers - only allow from self
    "worker-src 'self'",
    
    // Frames - block all iframes
    "frame-src 'none'",
    
    // Forms - only allow posting to self
    "form-action 'self'",
    
    // Base URI - restrict to self
    "base-uri 'self'",
    
    // Child sources - block all
    "child-src 'none'",
    
    // Connect sources - allow self and specific APIs
    "connect-src 'self' https://api.example.com",
    
    // Manifest - allow self
    "manifest-src 'self'",
    
    // Prefetch - allow self
    "prefetch-src 'self'"
  ];

  // Add report URI if specified
  if (config.reportUri) {
    directives.push(`report-uri ${config.reportUri}`);
  }

  return directives.join('; ');
}

function generateNonce(): string {
  // Generate cryptographically secure random nonce
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('base64');
}

// Development-friendly CSP (more permissive)
export const developmentCSP = createCSPMiddleware({
  reportOnly: true,
  nonce: false
});

// Production CSP (strict)
export const productionCSP = createCSPMiddleware({
  reportUri: '/api/csp-report',
  reportOnly: false,
  nonce: true
});

// CSP violation reporting endpoint
export const cspReportHandler = (req: Request, res: Response) => {
  try {
    const report = req.body;
    
    // Log CSP violation
    console.warn('CSP Violation Report:', {
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer'),
      violation: {
        documentUri: report['csp-report']?.['document-uri'],
        referrer: report['csp-report']?.referrer,
        blockedUri: report['csp-report']?.['blocked-uri'],
        violatedDirective: report['csp-report']?.['violated-directive'],
        originalPolicy: report['csp-report']?.['original-policy']
      }
    });

    // In production, you might want to:
    // 1. Store violations in a database for analysis
    // 2. Alert on unusual patterns
    // 3. Use violations to refine CSP policy

    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error processing CSP report:', error);
    res.status(500).json({ error: 'Failed to process CSP report' });
  }
};

// Helper function to get nonce from request
export const getNonce = (req: Request): string | undefined => {
  return (req as any).cspNonce;
};
