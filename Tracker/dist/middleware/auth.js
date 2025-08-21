"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectRouteOld = exports.protectBusinessRoute = exports.protectClientRoute = exports.protectAdminRoute = exports.protectRoute = exports.requireBusinessOwner = exports.requireClient = exports.requireAdmin = exports.requireUser = exports.requireAuth = void 0;
const backend_1 = require("@clerk/backend");
const prisma_1 = __importDefault(require("@/lib/prisma"));
const requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }
        const payload = await (0, backend_1.verifyToken)(token, {
            secretKey: process.env.CLERK_SECRET_KEY
        });
        req.auth = payload;
        if (payload.userId) {
            await prisma_1.default.user.updateMany({
                where: { clerkUserId: payload.userId },
                data: { lastLoginAt: new Date() }
            });
        }
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid authorization token' });
    }
};
exports.requireAuth = requireAuth;
const requireUser = async (req, res, next) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (!user.isActive) {
            return res.status(403).json({ error: 'User account is disabled' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: 'Failed to fetch user data' });
    }
};
exports.requireUser = requireUser;
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        return res.status(400).json({ error: 'User data not available' });
    }
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};
exports.requireAdmin = requireAdmin;
const requireClient = async (req, res, next) => {
    if (!req.user) {
        return res.status(400).json({ error: 'User data not available' });
    }
    if (req.user.role !== 'CLIENT' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Client access required' });
    }
    next();
};
exports.requireClient = requireClient;
const requireBusinessOwner = async (req, res, next) => {
    try {
        const businessId = req.params.businessId || req.body.businessId || req.query.businessId;
        if (!businessId) {
            return res.status(400).json({ error: 'Business ID required' });
        }
        if (req.user.role === 'ADMIN') {
            return next();
        }
        const business = await prisma_1.default.business.findFirst({
            where: {
                id: businessId,
                ownerId: req.user.id,
                isActive: true
            }
        });
        if (!business) {
            return res.status(403).json({ error: 'Access denied to this business' });
        }
        req.business = business;
        next();
    }
    catch (error) {
        console.error('Error checking business ownership:', error);
        return res.status(500).json({ error: 'Failed to verify business access' });
    }
};
exports.requireBusinessOwner = requireBusinessOwner;
exports.protectRoute = [exports.requireAuth, exports.requireUser];
exports.protectAdminRoute = [exports.requireAuth, exports.requireUser, exports.requireAdmin];
exports.protectClientRoute = [exports.requireAuth, exports.requireUser, exports.requireClient];
exports.protectBusinessRoute = [exports.requireAuth, exports.requireUser, exports.requireBusinessOwner];
const protectRouteOld = (req, res, next) => {
    (0, exports.requireAuth)(req, res, next);
};
exports.protectRouteOld = protectRouteOld;
//# sourceMappingURL=auth.js.map