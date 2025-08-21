import { Request, Response, NextFunction } from 'express';
import { RedisConnectionService } from './RedisConnectionService';
import { logger } from '@/utils';
import { config } from '@/config';
import jwt from 'jsonwebtoken';

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

export class SessionService {
  private static instance: SessionService;
  private redisConnection: RedisConnectionService;
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly DEFAULT_SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly ACTIVITY_UPDATE_INTERVAL = 5 * 60; // Update activity every 5 minutes
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.redisConnection = RedisConnectionService.getInstance();
    this.startSessionCleanup();
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  private generateSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  private generateUserSessionsKey(userId: string): string {
    return `${this.USER_SESSIONS_PREFIX}${userId}`;
  }

  public async createSession(userData: {
    userId: string;
    email: string;
    businessId?: string;
    role: string;
    permissions: string[];
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<{ sessionId: string; token: string }> {
    try {
      const client = await this.redisConnection.getClient();
      
      // Generate session ID
      const sessionId = this.generateSessionId();
      const sessionKey = this.generateSessionKey(sessionId);
      const userSessionsKey = this.generateUserSessionsKey(userData.userId);
      
      const sessionData: SessionData = {
        ...userData,
        loginTime: new Date(),
        lastActivity: new Date()
      };

      // Store session data
      await client.setex(
        sessionKey,
        this.DEFAULT_SESSION_TTL,
        JSON.stringify(sessionData)
      );

      // Add session to user's session list
      await client.sadd(userSessionsKey, sessionId);
      await client.expire(userSessionsKey, this.DEFAULT_SESSION_TTL);

      // Generate JWT token
      const token = jwt.sign(
        { 
          sessionId, 
          userId: userData.userId,
          businessId: userData.businessId,
          role: userData.role 
        },
        config.auth.jwtSecret,
        { expiresIn: '24h' }
      );

      logger.info(`Session created for user ${userData.userId}:`, { 
        sessionId: sessionId.substring(0, 8) + '...',
        businessId: userData.businessId 
      });

      return { sessionId, token };
      
    } catch (error) {
      logger.error('Error creating session:', error);
      throw error;
    }
  }

  public async getSession(sessionId: string): Promise<SessionData | null> {
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
      
    } catch (error) {
      logger.error('Error retrieving session:', error);
      return null;
    }
  }

  public async updateSessionActivity(sessionId: string, metadata?: Record<string, any>): Promise<boolean> {
    try {
      const client = await this.redisConnection.getClient();
      const sessionKey = this.generateSessionKey(sessionId);
      
      const sessionData = await this.getSession(sessionId);
      
      if (sessionData) {
        const now = new Date();
        const timeSinceLastUpdate = now.getTime() - sessionData.lastActivity.getTime();
        
        // Only update if enough time has passed to avoid excessive Redis calls
        if (timeSinceLastUpdate > this.ACTIVITY_UPDATE_INTERVAL * 1000) {
          const updatedData: SessionData = {
            ...sessionData,
            lastActivity: now,
            metadata: { ...sessionData.metadata, ...metadata }
          };

          await client.setex(
            sessionKey,
            this.DEFAULT_SESSION_TTL,
            JSON.stringify(updatedData)
          );
          
          logger.debug(`Updated session activity for ${sessionId.substring(0, 8)}...`);
        }
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error('Error updating session activity:', error);
      return false;
    }
  }

  public async destroySession(sessionId: string): Promise<boolean> {
    try {
      const client = await this.redisConnection.getClient();
      const sessionKey = this.generateSessionKey(sessionId);
      
      // Get session data to remove from user sessions list
      const sessionData = await this.getSession(sessionId);
      
      if (sessionData) {
        const userSessionsKey = this.generateUserSessionsKey(sessionData.userId);
        
        // Remove from user sessions list
        await client.srem(userSessionsKey, sessionId);
        
        // Delete session data
        const deleted = await client.del(sessionKey);
        
        logger.info(`Session destroyed for user ${sessionData.userId}:`, { 
          sessionId: sessionId.substring(0, 8) + '...' 
        });
        
        return deleted > 0;
      }
      
      return false;
      
    } catch (error) {
      logger.error('Error destroying session:', error);
      return false;
    }
  }

  public async destroyAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
    try {
      const client = await this.redisConnection.getClient();
      const userSessionsKey = this.generateUserSessionsKey(userId);
      
      const sessionIds = await client.smembers(userSessionsKey);
      let destroyedCount = 0;
      
      for (const sessionId of sessionIds) {
        if (exceptSessionId && sessionId === exceptSessionId) {
          continue; // Skip the current session
        }
        
        const destroyed = await this.destroySession(sessionId);
        if (destroyed) {
          destroyedCount++;
        }
      }
      
      logger.info(`Destroyed ${destroyedCount} sessions for user ${userId}`);
      return destroyedCount;
      
    } catch (error) {
      logger.error('Error destroying user sessions:', error);
      throw error;
    }
  }

  public async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const client = await this.redisConnection.getClient();
      const userSessionsKey = this.generateUserSessionsKey(userId);
      
      const sessionIds = await client.smembers(userSessionsKey);
      const sessions: SessionData[] = [];
      
      for (const sessionId of sessionIds) {
        const sessionData = await this.getSession(sessionId);
        if (sessionData) {
          sessions.push(sessionData);
        }
      }
      
      return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      
    } catch (error) {
      logger.error('Error retrieving user sessions:', error);
      return [];
    }
  }

  public async extendSession(sessionId: string, additionalTtl?: number): Promise<boolean> {
    try {
      const client = await this.redisConnection.getClient();
      const sessionKey = this.generateSessionKey(sessionId);
      
      const ttl = additionalTtl || this.DEFAULT_SESSION_TTL;
      const extended = await client.expire(sessionKey, ttl);
      
      if (extended) {
        logger.debug(`Extended session ${sessionId.substring(0, 8)}... by ${ttl} seconds`);
      }
      
      return extended === 1;
      
    } catch (error) {
      logger.error('Error extending session:', error);
      return false;
    }
  }

  public async getSessionMetrics(): Promise<SessionMetrics> {
    try {
      const client = await this.redisConnection.getClient();
      
      // Get all session keys
      const sessionKeys = await client.keys(`${this.SESSION_PREFIX}*`);
      const activeSessions = sessionKeys.length;
      
      // Get total sessions from stats (if available)
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
      
    } catch (error) {
      logger.error('Error getting session metrics:', error);
      return {
        activeSessions: 0,
        totalSessions: 0,
        expiredSessions: 0,
        lastCleanup: new Date()
      };
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private startSessionCleanup(): void {
    // Clean up expired sessions every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const client = await this.redisConnection.getClient();
      
      // Get all user session lists
      const userSessionKeys = await client.keys(`${this.USER_SESSIONS_PREFIX}*`);
      let cleanedSessions = 0;
      
      for (const userSessionKey of userSessionKeys) {
        const sessionIds = await client.smembers(userSessionKey);
        
        for (const sessionId of sessionIds) {
          const sessionKey = this.generateSessionKey(sessionId);
          const exists = await client.exists(sessionKey);
          
          if (!exists) {
            // Session expired, remove from user sessions list
            await client.srem(userSessionKey, sessionId);
            cleanedSessions++;
          }
        }
        
        // Clean up empty user session lists
        const remainingSessions = await client.scard(userSessionKey);
        if (remainingSessions === 0) {
          await client.del(userSessionKey);
        }
      }
      
      // Update cleanup stats
      const statsKey = 'session:stats';
      await client.hmset(statsKey, {
        expiredSessions: cleanedSessions,
        lastCleanup: new Date().toISOString()
      });
      
      if (cleanedSessions > 0) {
        logger.info(`Session cleanup completed: removed ${cleanedSessions} expired sessions`);
      }
      
    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }

  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    logger.info('Session service shutdown completed');
  }

  // Middleware for Express.js
  public createSessionMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader?.startsWith('Bearer ')) {
          return next();
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
        
        if (decoded.sessionId) {
          const sessionData = await this.getSession(decoded.sessionId);
          
          if (sessionData) {
            // Attach session data to request
            (req as any).session = sessionData;
            (req as any).sessionId = decoded.sessionId;
            
            // Update activity
            await this.updateSessionActivity(decoded.sessionId, {
              endpoint: req.path,
              method: req.method,
              timestamp: new Date().toISOString()
            });
          }
        }
        
        next();
        
      } catch (error) {
        logger.warn('Session middleware error:', error);
        next(); // Continue without session
      }
    };
  }

  // Middleware to require active session
  public createAuthRequiredMiddleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!(req as any).session) {
        res.status(401).json({ 
          error: 'Authentication required',
          message: 'Valid session required to access this resource'
        });
        return;
      }
      
      next();
    };
  }

  // Middleware to require specific permissions
  public createPermissionMiddleware(requiredPermissions: string[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const session = (req as any).session as SessionData;
      
      if (!session) {
        res.status(401).json({ 
          error: 'Authentication required' 
        });
        return;
      }
      
      const hasPermission = requiredPermissions.every(permission => 
        session.permissions.includes(permission) || session.role === 'admin'
      );
      
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

// Export singleton instance
export const sessionService = SessionService.getInstance();