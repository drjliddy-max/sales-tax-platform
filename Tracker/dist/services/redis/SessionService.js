"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionService = exports.SessionService = void 0;
const RedisConnectionService_1 = require("./RedisConnectionService");
const utils_1 = require("@/utils");
const config_1 = require("@/config");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
class SessionService {
    constructor() {
        this.SESSION_PREFIX = 'session:';
        this.USER_SESSIONS_PREFIX = 'user_sessions:';
        this.DEFAULT_SESSION_TTL = 24 * 60 * 60;
        this.ACTIVITY_UPDATE_INTERVAL = 5 * 60;
        this.cleanupInterval = null;
        this.redisConnection = RedisConnectionService_1.RedisConnectionService.getInstance();
        this.startSessionCleanup();
    }
    static getInstance() {
        if (!SessionService.instance) {
            SessionService.instance = new SessionService();
        }
        return SessionService.instance;
    }
    generateSessionKey(sessionId) {
        return `${this.SESSION_PREFIX}${sessionId}`;
    }
    generateUserSessionsKey(userId) {
        return `${this.USER_SESSIONS_PREFIX}${userId}`;
    }
    async createSession(userData) {
        try {
            const client = await this.redisConnection.getClient();
            const sessionId = this.generateSessionId();
            const sessionKey = this.generateSessionKey(sessionId);
            const userSessionsKey = this.generateUserSessionsKey(userData.userId);
            const sessionData = {
                ...userData,
                loginTime: new Date(),
                lastActivity: new Date()
            };
            await client.setex(sessionKey, this.DEFAULT_SESSION_TTL, JSON.stringify(sessionData));
            await client.sadd(userSessionsKey, sessionId);
            await client.expire(userSessionsKey, this.DEFAULT_SESSION_TTL);
            const token = jsonwebtoken_1.default.sign({
                sessionId,
                userId: userData.userId,
                businessId: userData.businessId,
                role: userData.role
            }, config_1.config.auth.jwtSecret, { expiresIn: '24h' });
            utils_1.logger.info(`Session created for user ${userData.userId}:`, {
                sessionId: sessionId.substring(0, 8) + '...',
                businessId: userData.businessId
            });
            return { sessionId, token };
        }
        catch (error) {
            utils_1.logger.error('Error creating session:', error);
            throw error;
        }
    }
    async getSession(sessionId) {
        try {
            const client = await this.redisConnection.getClient();
            const sessionKey = this.generateSessionKey(sessionId);
            const sessionData = await client.get(sessionKey);
            if (sessionData) {
                const parsed = JSON.parse(sessionData);
                return {
                    ...parsed,
                    loginTime: new Date(parsed.loginTime),
                    lastActivity: new Date(parsed.lastActivity)
                };
            }
            return null;
        }
        catch (error) {
            utils_1.logger.error('Error retrieving session:', error);
            return null;
        }
    }
    async updateSessionActivity(sessionId, metadata) {
        try {
            const client = await this.redisConnection.getClient();
            const sessionKey = this.generateSessionKey(sessionId);
            const sessionData = await this.getSession(sessionId);
            if (sessionData) {
                const now = new Date();
                const timeSinceLastUpdate = now.getTime() - sessionData.lastActivity.getTime();
                if (timeSinceLastUpdate > this.ACTIVITY_UPDATE_INTERVAL * 1000) {
                    const updatedData = {
                        ...sessionData,
                        lastActivity: now,
                        metadata: { ...sessionData.metadata, ...metadata }
                    };
                    await client.setex(sessionKey, this.DEFAULT_SESSION_TTL, JSON.stringify(updatedData));
                    utils_1.logger.debug(`Updated session activity for ${sessionId.substring(0, 8)}...`);
                }
                return true;
            }
            return false;
        }
        catch (error) {
            utils_1.logger.error('Error updating session activity:', error);
            return false;
        }
    }
    async destroySession(sessionId) {
        try {
            const client = await this.redisConnection.getClient();
            const sessionKey = this.generateSessionKey(sessionId);
            const sessionData = await this.getSession(sessionId);
            if (sessionData) {
                const userSessionsKey = this.generateUserSessionsKey(sessionData.userId);
                await client.srem(userSessionsKey, sessionId);
                const deleted = await client.del(sessionKey);
                utils_1.logger.info(`Session destroyed for user ${sessionData.userId}:`, {
                    sessionId: sessionId.substring(0, 8) + '...'
                });
                return deleted > 0;
            }
            return false;
        }
        catch (error) {
            utils_1.logger.error('Error destroying session:', error);
            return false;
        }
    }
    async destroyAllUserSessions(userId, exceptSessionId) {
        try {
            const client = await this.redisConnection.getClient();
            const userSessionsKey = this.generateUserSessionsKey(userId);
            const sessionIds = await client.smembers(userSessionsKey);
            let destroyedCount = 0;
            for (const sessionId of sessionIds) {
                if (exceptSessionId && sessionId === exceptSessionId) {
                    continue;
                }
                const destroyed = await this.destroySession(sessionId);
                if (destroyed) {
                    destroyedCount++;
                }
            }
            utils_1.logger.info(`Destroyed ${destroyedCount} sessions for user ${userId}`);
            return destroyedCount;
        }
        catch (error) {
            utils_1.logger.error('Error destroying user sessions:', error);
            throw error;
        }
    }
    async getUserSessions(userId) {
        try {
            const client = await this.redisConnection.getClient();
            const userSessionsKey = this.generateUserSessionsKey(userId);
            const sessionIds = await client.smembers(userSessionsKey);
            const sessions = [];
            for (const sessionId of sessionIds) {
                const sessionData = await this.getSession(sessionId);
                if (sessionData) {
                    sessions.push(sessionData);
                }
            }
            return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
        }
        catch (error) {
            utils_1.logger.error('Error retrieving user sessions:', error);
            return [];
        }
    }
    async extendSession(sessionId, additionalTtl) {
        try {
            const client = await this.redisConnection.getClient();
            const sessionKey = this.generateSessionKey(sessionId);
            const ttl = additionalTtl || this.DEFAULT_SESSION_TTL;
            const extended = await client.expire(sessionKey, ttl);
            if (extended) {
                utils_1.logger.debug(`Extended session ${sessionId.substring(0, 8)}... by ${ttl} seconds`);
            }
            return extended === 1;
        }
        catch (error) {
            utils_1.logger.error('Error extending session:', error);
            return false;
        }
    }
    async getSessionMetrics() {
        try {
            const client = await this.redisConnection.getClient();
            const sessionKeys = await client.keys(`${this.SESSION_PREFIX}*`);
            const activeSessions = sessionKeys.length;
            const statsKey = 'session:stats';
            const stats = await client.hgetall(statsKey);
            const totalSessions = parseInt(stats.totalSessions) || activeSessions;
            const expiredSessions = parseInt(stats.expiredSessions) || 0;
            const lastCleanup = stats.lastCleanup ? new Date(stats.lastCleanup) : new Date();
            return {
                activeSessions,
                totalSessions,
                expiredSessions,
                lastCleanup
            };
        }
        catch (error) {
            utils_1.logger.error('Error getting session metrics:', error);
            return {
                activeSessions: 0,
                totalSessions: 0,
                expiredSessions: 0,
                lastCleanup: new Date()
            };
        }
    }
    generateSessionId() {
        return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
    startSessionCleanup() {
        this.cleanupInterval = setInterval(async () => {
            await this.cleanupExpiredSessions();
        }, 60 * 60 * 1000);
    }
    async cleanupExpiredSessions() {
        try {
            const client = await this.redisConnection.getClient();
            const userSessionKeys = await client.keys(`${this.USER_SESSIONS_PREFIX}*`);
            let cleanedSessions = 0;
            for (const userSessionKey of userSessionKeys) {
                const sessionIds = await client.smembers(userSessionKey);
                for (const sessionId of sessionIds) {
                    const sessionKey = this.generateSessionKey(sessionId);
                    const exists = await client.exists(sessionKey);
                    if (!exists) {
                        await client.srem(userSessionKey, sessionId);
                        cleanedSessions++;
                    }
                }
                const remainingSessions = await client.scard(userSessionKey);
                if (remainingSessions === 0) {
                    await client.del(userSessionKey);
                }
            }
            const statsKey = 'session:stats';
            await client.hmset(statsKey, {
                expiredSessions: cleanedSessions,
                lastCleanup: new Date().toISOString()
            });
            if (cleanedSessions > 0) {
                utils_1.logger.info(`Session cleanup completed: removed ${cleanedSessions} expired sessions`);
            }
        }
        catch (error) {
            utils_1.logger.error('Error during session cleanup:', error);
        }
    }
    async shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        utils_1.logger.info('Session service shutdown completed');
    }
    createSessionMiddleware() {
        return async (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader?.startsWith('Bearer ')) {
                    return next();
                }
                const token = authHeader.split(' ')[1];
                const decoded = jsonwebtoken_1.default.verify(token, config_1.config.auth.jwtSecret);
                if (decoded.sessionId) {
                    const sessionData = await this.getSession(decoded.sessionId);
                    if (sessionData) {
                        req.session = sessionData;
                        req.sessionId = decoded.sessionId;
                        await this.updateSessionActivity(decoded.sessionId, {
                            endpoint: req.path,
                            method: req.method,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                next();
            }
            catch (error) {
                utils_1.logger.warn('Session middleware error:', error);
                next();
            }
        };
    }
    createAuthRequiredMiddleware() {
        return (req, res, next) => {
            if (!req.session) {
                res.status(401).json({
                    error: 'Authentication required',
                    message: 'Valid session required to access this resource'
                });
                return;
            }
            next();
        };
    }
    createPermissionMiddleware(requiredPermissions) {
        return (req, res, next) => {
            const session = req.session;
            if (!session) {
                res.status(401).json({
                    error: 'Authentication required'
                });
                return;
            }
            const hasPermission = requiredPermissions.every(permission => session.permissions.includes(permission) || session.role === 'admin');
            if (!hasPermission) {
                res.status(403).json({
                    error: 'Insufficient permissions',
                    required: requiredPermissions,
                    current: session.permissions
                });
                return;
            }
            next();
        };
    }
}
exports.SessionService = SessionService;
exports.sessionService = SessionService.getInstance();
//# sourceMappingURL=SessionService.js.map