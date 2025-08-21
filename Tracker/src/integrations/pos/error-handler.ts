/**
 * Error Handling and Recovery System
 * Comprehensive error management, logging, and recovery for POS integrations
 */

import { EventEmitter } from 'events';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import {
  POSSystemType,
  POSIntegrationError,
  RetryConfig,
  AuthCredentials,
  POSEvent
} from './types';
import { RateLimitManager } from './rate-limiter';
import { ConfigurationManager } from './configuration';

interface ErrorContext {
  businessId?: string;
  locationId?: string;
  operation: string;
  posType: POSSystemType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface ErrorPattern {
  code: string;
  posType?: POSSystemType;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  resolutionStrategy?: string;
}

interface RecoveryAction {
  id: string;
  type: 'retry' | 'refresh_token' | 'reset_connection' | 'disable_integration' | 'manual_intervention';
  businessId: string;
  posType: POSSystemType;
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: Date;
  success?: boolean;
  error?: string;
}

interface HealthMetrics {
  posType: POSSystemType;
  businessId: string;
  successRate: number;
  errorRate: number;
  avgResponseTime: number;
  lastError?: POSIntegrationError;
  connectionStatus: 'healthy' | 'degraded' | 'unhealthy' | 'disconnected';
  lastHealthCheck: Date;
}

export class ErrorHandler extends EventEmitter {
  private static instance: ErrorHandler;
  private rateLimitManager: RateLimitManager;
  private recoveryQueue: RecoveryAction[] = [];
  private isProcessingRecovery = false;
  private healthMetrics: Map<string, HealthMetrics> = new Map();

  private static readonly ERROR_RETENTION_DAYS = 30;
  private static readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static readonly RECOVERY_INTERVALS = {
    retry: [1000, 5000, 15000, 60000, 300000], // Progressive retry delays
    refresh_token: [60000], // 1 minute
    reset_connection: [300000], // 5 minutes
    disable_integration: [0] // Immediate
  };

  private constructor() {
    super();
    this.rateLimitManager = RateLimitManager.getInstance();
    this.startHealthChecking();
    this.startRecoveryProcessing();
    this.setupErrorPatternDetection();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle POS integration error
   */
  public async handleError(
    error: POSIntegrationError,
    context: ErrorContext,
    retryConfig?: RetryConfig
  ): Promise<void> {
    try {
      // Log the error
      await this.logError(error, context);

      // Update health metrics
      await this.updateHealthMetrics(error, context);

      // Detect error patterns
      await this.detectErrorPatterns(error, context);

      // Determine recovery strategy
      const recoveryAction = await this.determineRecoveryStrategy(error, context, retryConfig);

      if (recoveryAction) {
        await this.scheduleRecoveryAction(recoveryAction);
      }

      // Emit error event
      const errorEvent: POSEvent = {
        type: 'sync.failed',
        posType: context.posType,
        locationId: context.locationId,
        timestamp: new Date(),
        error: error,
        data: context
      };

      this.emit('pos:error', errorEvent);

      console.error(`POS Error [${context.posType}:${context.operation}]:`, error.message);
    } catch (handlingError) {
      console.error('Error handler failed:', handlingError);
      // Prevent infinite error loops
    }
  }

  /**
   * Log error to database and monitoring systems
   */
  private async logError(error: POSIntegrationError, context: ErrorContext): Promise<void> {
    try {
      const errorLog = {
        id: crypto.randomUUID(),
        businessId: context.businessId || 'unknown',
        posType: context.posType,
        operation: context.operation,
        errorCode: error.code,
        errorMessage: error.message,
        statusCode: error.statusCode,
        retryable: error.retryable,
        locationId: context.locationId,
        metadata: JSON.stringify({
          ...context.metadata,
          stack: error.stack,
          details: error.details
        }),
        timestamp: context.timestamp,
        createdAt: new Date()
      };

      await prisma.posErrorLog.create({ data: errorLog });

      // Also log to Redis for real-time monitoring
      const redisKey = `pos_errors:${context.posType}:${context.businessId || 'global'}`;
      await redis.lpush(redisKey, JSON.stringify(errorLog));
      await redis.ltrim(redisKey, 0, 99); // Keep last 100 errors
      await redis.expire(redisKey, 86400); // 24 hours
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Update health metrics for POS integration
   */
  private async updateHealthMetrics(error: POSIntegrationError, context: ErrorContext): Promise<void> {
    const key = `${context.posType}:${context.businessId || 'global'}`;
    let metrics = this.healthMetrics.get(key);

    if (!metrics) {
      metrics = {
        posType: context.posType,
        businessId: context.businessId || 'global',
        successRate: 0,
        errorRate: 0,
        avgResponseTime: 0,
        connectionStatus: 'healthy',
        lastHealthCheck: new Date()
      };
    }

    // Update error metrics
    metrics.errorRate = await this.calculateErrorRate(context.posType, context.businessId);
    metrics.successRate = 100 - metrics.errorRate;
    metrics.lastError = error;
    metrics.lastHealthCheck = new Date();

    // Determine connection status
    if (metrics.errorRate > 50) {
      metrics.connectionStatus = 'unhealthy';
    } else if (metrics.errorRate > 25) {
      metrics.connectionStatus = 'degraded';
    } else if (error.code === 'CONNECTION_ERROR' || error.code === 'AUTH_ERROR') {
      metrics.connectionStatus = 'disconnected';
    } else {
      metrics.connectionStatus = 'healthy';
    }

    this.healthMetrics.set(key, metrics);

    // Persist to Redis for monitoring
    const redisKey = `health_metrics:${key}`;
    await redis.setex(redisKey, 3600, JSON.stringify(metrics));
  }

  /**
   * Calculate error rate for the last hour
   */
  private async calculateErrorRate(posType: POSSystemType, businessId?: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const totalRequests = await this.getTotalRequests(posType, businessId, oneHourAgo);
      const errorRequests = await prisma.posErrorLog.count({
        where: {
          posType,
          businessId: businessId || 'unknown',
          timestamp: { gte: oneHourAgo }
        }
      });

      if (totalRequests === 0) return 0;
      return (errorRequests / totalRequests) * 100;
    } catch (error) {
      console.error('Failed to calculate error rate:', error);
      return 0;
    }
  }

  /**
   * Get total requests from rate limiter metrics
   */
  private async getTotalRequests(posType: POSSystemType, businessId?: string, since: Date): Promise<number> {
    try {
      const status = await this.rateLimitManager.getRateLimitStatus(posType, businessId);
      // This is a simplified calculation - in practice, you'd track actual request counts
      return Math.max(100, status.remaining); // Placeholder
    } catch (error) {
      return 100; // Default assumption
    }
  }

  /**
   * Detect error patterns for proactive management
   */
  private async detectErrorPatterns(error: POSIntegrationError, context: ErrorContext): Promise<void> {
    try {
      const patternKey = `${error.code}:${context.posType}`;
      const redisKey = `error_patterns:${patternKey}`;
      
      let pattern = await redis.get(redisKey);
      let patternData: ErrorPattern;

      if (pattern) {
        patternData = JSON.parse(pattern);
        patternData.count++;
        patternData.lastSeen = new Date();
      } else {
        patternData = {
          code: error.code,
          posType: context.posType,
          count: 1,
          firstSeen: new Date(),
          lastSeen: new Date()
        };
      }

      // Detect pattern thresholds
      if (patternData.count >= 10) {
        patternData.resolutionStrategy = this.suggestResolutionStrategy(error, patternData);
        
        // Emit pattern detected event
        this.emit('error:pattern_detected', {
          pattern: patternData,
          error,
          context
        });
      }

      await redis.setex(redisKey, 86400, JSON.stringify(patternData)); // 24 hours
    } catch (error) {
      console.error('Failed to detect error patterns:', error);
    }
  }

  /**
   * Suggest resolution strategy based on error patterns
   */
  private suggestResolutionStrategy(error: POSIntegrationError, pattern: ErrorPattern): string {
    switch (error.code) {
      case 'AUTH_ERROR':
        return 'refresh_credentials';
      case 'RATE_LIMITED':
        return 'implement_backoff';
      case 'CONNECTION_ERROR':
        return 'check_network_connectivity';
      case 'VALIDATION_ERROR':
        return 'review_data_format';
      default:
        return `investigate_${error.code.toLowerCase()}`;
    }
  }

  /**
   * Determine recovery strategy for an error
   */
  private async determineRecoveryStrategy(
    error: POSIntegrationError,
    context: ErrorContext,
    retryConfig?: RetryConfig
  ): Promise<RecoveryAction | null> {
    if (!error.retryable && !this.isRecoverableError(error)) {
      return null;
    }

    const recoveryType = this.getRecoveryType(error);
    if (!recoveryType) return null;

    const existingAction = this.findExistingRecoveryAction(context.businessId, context.posType, recoveryType);
    if (existingAction && existingAction.attempts >= existingAction.maxAttempts) {
      return null; // Max attempts reached
    }

    const action: RecoveryAction = {
      id: crypto.randomUUID(),
      type: recoveryType,
      businessId: context.businessId || 'unknown',
      posType: context.posType,
      scheduledAt: new Date(Date.now() + this.getRecoveryDelay(recoveryType, existingAction?.attempts || 0)),
      attempts: (existingAction?.attempts || 0) + 1,
      maxAttempts: this.getMaxAttempts(recoveryType, retryConfig)
    };

    return action;
  }

  /**
   * Check if error is recoverable through automated actions
   */
  private isRecoverableError(error: POSIntegrationError): boolean {
    const recoverableCodes = [
      'AUTH_ERROR', 'RATE_LIMITED', 'CONNECTION_ERROR', 
      'SERVER_ERROR', 'TIMEOUT', 'TEMPORARY_ERROR'
    ];
    return recoverableCodes.includes(error.code);
  }

  /**
   * Get recovery type for error
   */
  private getRecoveryType(error: POSIntegrationError): RecoveryAction['type'] | null {
    switch (error.code) {
      case 'AUTH_ERROR':
        return 'refresh_token';
      case 'RATE_LIMITED':
      case 'CONNECTION_ERROR':
      case 'TIMEOUT':
        return 'retry';
      case 'SERVER_ERROR':
        return 'reset_connection';
      default:
        return error.retryable ? 'retry' : null;
    }
  }

  /**
   * Get recovery delay based on attempt count
   */
  private getRecoveryDelay(type: RecoveryAction['type'], attemptCount: number): number {
    const delays = this.RECOVERY_INTERVALS[type] || this.RECOVERY_INTERVALS.retry;
    const delayIndex = Math.min(attemptCount, delays.length - 1);
    return delays[delayIndex];
  }

  /**
   * Get maximum attempts for recovery type
   */
  private getMaxAttempts(type: RecoveryAction['type'], retryConfig?: RetryConfig): number {
    if (retryConfig?.maxAttempts) {
      return retryConfig.maxAttempts;
    }
    
    switch (type) {
      case 'retry': return 5;
      case 'refresh_token': return 3;
      case 'reset_connection': return 2;
      case 'disable_integration': return 1;
      default: return 3;
    }
  }

  /**
   * Find existing recovery action
   */
  private findExistingRecoveryAction(
    businessId?: string,
    posType?: POSSystemType,
    type?: RecoveryAction['type']
  ): RecoveryAction | undefined {
    return this.recoveryQueue.find(action => 
      action.businessId === (businessId || 'unknown') &&
      action.posType === posType &&
      (!type || action.type === type) &&
      !action.success
    );
  }

  /**
   * Schedule recovery action
   */
  private async scheduleRecoveryAction(action: RecoveryAction): Promise<void> {
    this.recoveryQueue.push(action);
    
    // Persist to database for durability
    await prisma.recoveryAction.create({
      data: {
        id: action.id,
        type: action.type,
        businessId: action.businessId,
        posType: action.posType,
        scheduledAt: action.scheduledAt,
        attempts: action.attempts,
        maxAttempts: action.maxAttempts,
        createdAt: new Date()
      }
    });

    console.log(`Scheduled ${action.type} recovery for ${action.posType}:${action.businessId} in ${action.scheduledAt.getTime() - Date.now()}ms`);
  }

  /**
   * Start recovery processing loop
   */
  private startRecoveryProcessing(): void {
    setInterval(async () => {
      if (this.isProcessingRecovery) return;
      
      this.isProcessingRecovery = true;
      
      try {
        const now = new Date();
        const dueActions = this.recoveryQueue.filter(action => 
          action.scheduledAt <= now && !action.success
        );

        for (const action of dueActions) {
          try {
            await this.executeRecoveryAction(action);
          } catch (error) {
            console.error(`Recovery action failed: ${action.type}`, error);
            action.error = error.message;
          }
        }

        // Remove completed or failed actions
        this.recoveryQueue = this.recoveryQueue.filter(action => 
          !action.success && action.attempts < action.maxAttempts
        );
      } finally {
        this.isProcessingRecovery = false;
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Execute recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction): Promise<void> {
    action.lastAttempt = new Date();

    try {
      switch (action.type) {
        case 'refresh_token':
          await this.refreshToken(action.businessId, action.posType);
          break;
        case 'reset_connection':
          await this.resetConnection(action.businessId, action.posType);
          break;
        case 'disable_integration':
          await this.disableIntegration(action.businessId, action.posType);
          break;
        case 'retry':
          // For retry, we just mark as successful - the operation will be retried naturally
          break;
      }

      action.success = true;
      
      // Update database
      await prisma.recoveryAction.update({
        where: { id: action.id },
        data: {
          lastAttempt: action.lastAttempt,
          success: true,
          updatedAt: new Date()
        }
      });

      this.emit('recovery:success', action);
      console.log(`Recovery action successful: ${action.type} for ${action.posType}:${action.businessId}`);
    } catch (error) {
      action.attempts++;
      
      // Update database
      await prisma.recoveryAction.update({
        where: { id: action.id },
        data: {
          lastAttempt: action.lastAttempt,
          attempts: action.attempts,
          error: error.message,
          updatedAt: new Date()
        }
      });

      if (action.attempts >= action.maxAttempts) {
        this.emit('recovery:failed', action);
        console.error(`Recovery action failed permanently: ${action.type} for ${action.posType}:${action.businessId}`);
      }

      throw error;
    }
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(businessId: string, posType: POSSystemType): Promise<void> {
    const config = await ConfigurationManager.loadConfiguration(businessId, posType);
    if (!config || !config.credentials.refreshToken) {
      throw new Error('No refresh token available');
    }

    // This would be implemented based on the specific POS system's OAuth flow
    // For now, we'll just log the attempt
    console.log(`Refreshing token for ${posType}:${businessId}`);
    
    // TODO: Implement actual token refresh logic for each POS system
  }

  /**
   * Reset connection to POS system
   */
  private async resetConnection(businessId: string, posType: POSSystemType): Promise<void> {
    // Clear any cached connection data
    const cacheKey = `pos_connection:${businessId}:${posType}`;
    await redis.del(cacheKey);
    
    // Reset rate limiter for this POS/business combination
    await this.rateLimitManager.clearAllQueues();
    
    console.log(`Reset connection for ${posType}:${businessId}`);
  }

  /**
   * Disable integration temporarily
   */
  private async disableIntegration(businessId: string, posType: POSSystemType): Promise<void> {
    await ConfigurationManager.toggleActive(businessId, posType, false);
    console.log(`Disabled integration for ${posType}:${businessId}`);
  }

  /**
   * Start health checking process
   */
  private startHealthChecking(): void {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health checks for all active integrations
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const activeConfigs = await prisma.posConfiguration.findMany({
        where: { isActive: true }
      });

      for (const config of activeConfigs) {
        try {
          await this.checkIntegrationHealth(config.businessId, config.posType as POSSystemType);
        } catch (error) {
          console.error(`Health check failed for ${config.posType}:${config.businessId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to perform health checks:', error);
    }
  }

  /**
   * Check health of specific integration
   */
  private async checkIntegrationHealth(businessId: string, posType: POSSystemType): Promise<void> {
    const key = `${posType}:${businessId}`;
    let metrics = this.healthMetrics.get(key);

    if (!metrics) {
      metrics = {
        posType,
        businessId,
        successRate: 100,
        errorRate: 0,
        avgResponseTime: 0,
        connectionStatus: 'healthy',
        lastHealthCheck: new Date()
      };
    }

    // Update metrics based on recent performance
    metrics.errorRate = await this.calculateErrorRate(posType, businessId);
    metrics.successRate = 100 - metrics.errorRate;
    metrics.lastHealthCheck = new Date();

    // Update connection status
    if (metrics.errorRate > 75) {
      metrics.connectionStatus = 'unhealthy';
    } else if (metrics.errorRate > 50) {
      metrics.connectionStatus = 'degraded';
    } else {
      metrics.connectionStatus = 'healthy';
    }

    this.healthMetrics.set(key, metrics);

    // Emit health status change events
    this.emit('health:updated', { businessId, posType, metrics });
  }

  /**
   * Setup error pattern detection
   */
  private setupErrorPatternDetection(): void {
    // Clean up old error patterns every hour
    setInterval(async () => {
      try {
        const keys = await redis.keys('error_patterns:*');
        for (const key of keys) {
          const pattern = await redis.get(key);
          if (pattern) {
            const patternData = JSON.parse(pattern);
            const ageHours = (Date.now() - new Date(patternData.lastSeen).getTime()) / (1000 * 60 * 60);
            
            if (ageHours > 24) {
              await redis.del(key);
            }
          }
        }
      } catch (error) {
        console.error('Failed to clean up error patterns:', error);
      }
    }, 3600000); // Every hour
  }

  /**
   * Get error statistics for monitoring
   */
  public async getErrorStats(): Promise<{
    totalErrors: number;
    errorsByPOS: Record<POSSystemType, number>;
    errorsByCode: Record<string, number>;
    recoveryActions: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const totalErrors = await prisma.posErrorLog.count({
        where: { timestamp: { gte: oneDayAgo } }
      });

      const byPOS = await prisma.posErrorLog.groupBy({
        by: ['posType'],
        where: { timestamp: { gte: oneDayAgo } },
        _count: true
      });

      const byCode = await prisma.posErrorLog.groupBy({
        by: ['errorCode'],
        where: { timestamp: { gte: oneDayAgo } },
        _count: true
      });

      const recoveryStats = await prisma.recoveryAction.aggregate({
        where: { createdAt: { gte: oneDayAgo } },
        _count: { id: true },
        _sum: {
          success: true
        }
      });

      const errorsByPOS = byPOS.reduce((acc, item) => {
        acc[item.posType as POSSystemType] = item._count;
        return acc;
      }, {} as Record<POSSystemType, number>);

      const errorsByCode = byCode.reduce((acc, item) => {
        acc[item.errorCode] = item._count;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalErrors,
        errorsByPOS,
        errorsByCode,
        recoveryActions: {
          total: recoveryStats._count.id || 0,
          successful: recoveryStats._sum.success || 0,
          failed: (recoveryStats._count.id || 0) - (recoveryStats._sum.success || 0)
        }
      };
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return {
        totalErrors: 0,
        errorsByPOS: {} as Record<POSSystemType, number>,
        errorsByCode: {},
        recoveryActions: { total: 0, successful: 0, failed: 0 }
      };
    }
  }

  /**
   * Get health metrics for all integrations
   */
  public getHealthMetrics(): HealthMetrics[] {
    return Array.from(this.healthMetrics.values());
  }
}
