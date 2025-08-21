import { Request, Response, NextFunction } from 'express';
interface SessionData {
    userId: string;
    email: string;
    businessId?: string;
    role: string;
    permissions: string[];
    loginTime: Date;
    lastActivity: Date;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
}
interface SessionMetrics {
    activeSessions: number;
    totalSessions: number;
    expiredSessions: number;
    lastCleanup: Date;
}
export declare class SessionService {
    private static instance;
    private redisConnection;
    private readonly SESSION_PREFIX;
    private readonly USER_SESSIONS_PREFIX;
    private readonly DEFAULT_SESSION_TTL;
    private readonly ACTIVITY_UPDATE_INTERVAL;
    private cleanupInterval;
    private constructor();
    static getInstance(): SessionService;
    private generateSessionKey;
    private generateUserSessionsKey;
    createSession(userData: {
        userId: string;
        email: string;
        businessId?: string;
        role: string;
        permissions: string[];
        ipAddress: string;
        userAgent: string;
        metadata?: Record<string, any>;
    }): Promise<{
        sessionId: string;
        token: string;
    }>;
    getSession(sessionId: string): Promise<SessionData | null>;
    updateSessionActivity(sessionId: string, metadata?: Record<string, any>): Promise<boolean>;
    destroySession(sessionId: string): Promise<boolean>;
    destroyAllUserSessions(userId: string, exceptSessionId?: string): Promise<number>;
    getUserSessions(userId: string): Promise<SessionData[]>;
    extendSession(sessionId: string, additionalTtl?: number): Promise<boolean>;
    getSessionMetrics(): Promise<SessionMetrics>;
    private generateSessionId;
    private startSessionCleanup;
    private cleanupExpiredSessions;
    shutdown(): Promise<void>;
    createSessionMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    createAuthRequiredMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    createPermissionMiddleware(requiredPermissions: string[]): (req: Request, res: Response, next: NextFunction) => void;
}
export declare const sessionService: SessionService;
export {};
//# sourceMappingURL=SessionService.d.ts.map