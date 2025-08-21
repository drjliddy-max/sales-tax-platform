"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = exports.requireClient = exports.requireAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Access token required'
            });
            return;
        }
        if (token === 'mock_admin_token') {
            req.user = {
                id: 'app_owner_1',
                email: 'admin@salestaxtracker.com',
                role: 'ADMIN',
                isActive: true,
                permissions: [
                    'manage_pos_registry',
                    'verify_client_contributions',
                    'manage_plugins',
                    'admin_access'
                ]
            };
            next();
            return;
        }
        if (token === 'mock_client_token') {
            req.user = {
                id: 'client_user_1',
                email: 'client@example.com',
                role: 'CLIENT',
                isActive: true,
                businessId: 'demo_business_1',
                permissions: [
                    'use_pos_registry',
                    'contribute_pos_systems',
                    'manage_own_integrations'
                ]
            };
            next();
            return;
        }
        const jwtSecret = process.env.JWT_SECRET || 'development_secret';
        try {
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            req.user = {
                id: decoded.sub || decoded.id || 'unknown',
                email: decoded.email || 'unknown@example.com',
                role: decoded.role || 'CLIENT',
                isActive: decoded.active !== false,
                businessId: decoded.businessId,
                permissions: decoded.permissions || []
            };
            next();
        }
        catch (jwtError) {
            res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};
exports.authenticateToken = authenticateToken;
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    if (req.user.role !== 'ADMIN') {
        res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
const requireClient = (req, res, next) => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
        return;
    }
    if (!req.user.isActive) {
        res.status(403).json({
            success: false,
            error: 'Account not active'
        });
        return;
    }
    next();
};
exports.requireClient = requireClient;
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
            return;
        }
        const hasPermission = req.user.permissions?.includes(permission) ||
            req.user.role === 'ADMIN';
        if (!hasPermission) {
            res.status(403).json({
                success: false,
                error: `Permission required: ${permission}`
            });
            return;
        }
        next();
    };
};
exports.requirePermission = requirePermission;
//# sourceMappingURL=auth.js.map