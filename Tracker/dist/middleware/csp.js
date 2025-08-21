"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNonce = exports.cspReportHandler = exports.productionCSP = exports.developmentCSP = exports.createCSPMiddleware = void 0;
const createCSPMiddleware = (config = {}) => {
    return (req, res, next) => {
        const nonce = config.nonce ? generateNonce() : null;
        if (nonce) {
            req.cspNonce = nonce;
        }
        const cspDirective = buildCSPDirective(config, nonce);
        if (config.reportOnly) {
            res.setHeader('Content-Security-Policy-Report-Only', cspDirective);
        }
        else {
            res.setHeader('Content-Security-Policy', cspDirective);
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        next();
    };
};
exports.createCSPMiddleware = createCSPMiddleware;
function buildCSPDirective(config, nonce) {
    const directives = [
        "default-src 'self'",
        `script-src 'self' https://cdn.tailwindcss.com${nonce ? ` 'nonce-${nonce}'` : ''}`,
        "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "media-src 'self'",
        "object-src 'none'",
        "worker-src 'self'",
        "frame-src 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        "child-src 'none'",
        "connect-src 'self' https://api.example.com",
        "manifest-src 'self'",
        "prefetch-src 'self'"
    ];
    if (config.reportUri) {
        directives.push(`report-uri ${config.reportUri}`);
    }
    return directives.join('; ');
}
function generateNonce() {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('base64');
}
exports.developmentCSP = (0, exports.createCSPMiddleware)({
    reportOnly: true,
    nonce: false
});
exports.productionCSP = (0, exports.createCSPMiddleware)({
    reportUri: '/api/csp-report',
    reportOnly: false,
    nonce: true
});
const cspReportHandler = (req, res) => {
    try {
        const report = req.body;
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
        res.status(204).send();
    }
    catch (error) {
        console.error('Error processing CSP report:', error);
        res.status(500).json({ error: 'Failed to process CSP report' });
    }
};
exports.cspReportHandler = cspReportHandler;
const getNonce = (req) => {
    return req.cspNonce;
};
exports.getNonce = getNonce;
//# sourceMappingURL=csp.js.map