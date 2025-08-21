"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.protectRoute = exports.requireAuth = void 0;
const backend_1 = require("@clerk/backend");
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
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid authorization token' });
    }
};
exports.requireAuth = requireAuth;
const protectRoute = (req, res, next) => {
    (0, exports.requireAuth)(req, res, next);
};
exports.protectRoute = protectRoute;
//# sourceMappingURL=clerk.js.map