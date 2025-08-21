import * as Sentry from '@sentry/node';
import { config } from '@/config';
import { logger } from '@/utils';

interface ComplianceAlert {
  type: 'accuracy' | 'threshold' | 'filing' | 'rate_change' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  businessId: string;
  jurisdiction: string;
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

interface ComplianceWorkflow {
  type: 'tax_filing' | 'rate_update' | 'audit_trail' | 'compliance_check';
  businessId: string;
  jurisdiction: string;
  status: 'completed' | 'failed';
  complianceScore?: number;
}

interface POSIntegrationHealth {
  type: 'square' | 'shopify' | 'clover';
  businessId: string;
  status: 'healthy' | 'degraded' | 'failed';
  errorCount: number;
  responseTime: number;
  transactionsSynced?: number;
}

interface RedisPerformance {
  operation: string;
  latency: number;
  success: boolean;
  error?: Error;
}

export class SentryService {
  private static instance: SentryService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): SentryService {
    if (!SentryService.instance) {
      SentryService.instance = new SentryService();
    }
    return SentryService.instance;
  }

  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    if (!config.monitoring.sentryDsn) {
      logger.warn('Sentry DSN not configured, monitoring disabled');
      return;
    }

    try {
      Sentry.init({
        dsn: config.monitoring.sentryDsn,
        environment: config.monitoring.sentryEnvironment,
        release: config.monitoring.sentryRelease,
        integrations: [
          Sentry.httpIntegration(),
          Sentry.expressIntegration(),
          Sentry.mongooseIntegration()
          // Sentry.redisIntegration() // Temporarily disabled due to Redis connection issues
        ],
        beforeSend: (event, hint) => {
          return this.filterErrorEvent(event, hint);
        },
        tracesSampleRate: config.server.env === 'production' ? 0.1 : 1.0
      });

      this.isInitialized = true;
      logger.info('Sentry initialized successfully', {
        environment: config.monitoring.sentryEnvironment,
        release: config.monitoring.sentryRelease
      });

    } catch (error) {
      logger.error('Failed to initialize Sentry:', error);
      throw error;
    }
  }

  private filterErrorEvent(event: Sentry.ErrorEvent, hint?: Sentry.EventHint): Sentry.ErrorEvent | null {
    // Filter out non-critical errors in development
    if (config.server.env === 'development') {
      const error = hint?.originalException;
      if (error instanceof Error) {
        // Skip Redis connection errors in development
        if (error.message.includes('ECONNREFUSED') && error.message.includes('redis')) {
          return null;
        }
      }
    }

    // Remove sensitive financial data
    if (event.extra) {
      delete event.extra.creditCardNumber;
      delete event.extra.ssn;
      delete event.extra.taxId;
      delete event.extra.bankAccount;
    }

    return event;
  }

  public captureFinancialError(error: Error, context: {
    businessId?: string;
    transactionId?: string;
    calculationType?: string;
    jurisdiction?: string;
    amount?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }): string {
    return Sentry.withScope(scope => {
      scope.setTag('error_type', 'financial');
      scope.setTag('severity', context.severity || 'medium');
      
      if (context.businessId) {
        scope.setTag('business_id', context.businessId);
      }
      
      if (context.transactionId) {
        scope.setTag('transaction_id', context.transactionId);
      }
      
      if (context.jurisdiction) {
        scope.setTag('jurisdiction', context.jurisdiction);
      }
      
      if (context.calculationType) {
        scope.setTag('calculation_type', context.calculationType);
      }
      
      if (context.amount !== undefined) {
        scope.setTag('transaction_amount', context.amount.toString());
      }

      scope.setContext('financial_operation', context);

      return Sentry.captureException(error);
    });
  }

  public addBreadcrumb(
    category: string,
    message: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      category,
      message,
      level,
      data,
      timestamp: Date.now() / 1000
    });
  }

  public captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: Record<string, any>
  ): string {
    return Sentry.withScope(scope => {
      if (context) {
        scope.setContext('message_context', context);
        Object.entries(context).forEach(([key, value]) => {
          scope.setTag(key, String(value));
        });
      }
      
      return Sentry.captureMessage(message, level);
    });
  }

  public trackTaxCalculationAccuracy(data: {
    businessId: string;
    calculatedTax: number;
    confidence: number;
    jurisdiction: string;
    calculationTime: number;
  }): void {
    Sentry.withScope(scope => {
      scope.setTag('event_type', 'tax_calculation');
      scope.setTag('business_id', data.businessId);
      scope.setTag('jurisdiction', data.jurisdiction);
      scope.setTag('confidence_level', data.confidence > 0.9 ? 'high' : data.confidence > 0.7 ? 'medium' : 'low');

      scope.setContext('tax_calculation', {
        calculated_tax: data.calculatedTax,
        confidence: data.confidence,
        calculation_time: data.calculationTime,
        jurisdiction: data.jurisdiction
      });

      if (data.confidence < 0.7) {
        Sentry.captureMessage(
          `Low confidence tax calculation: ${data.confidence}`,
          data.confidence < 0.5 ? 'warning' : 'info'
        );
      }
    });
  }

  public trackPOSIntegrationHealth(data: POSIntegrationHealth): void {
    Sentry.withScope(scope => {
      scope.setTag('event_type', 'pos_integration');
      scope.setTag('integration_type', data.type);
      scope.setTag('business_id', data.businessId);
      scope.setTag('health_status', data.status);

      scope.setContext('pos_integration', {
        type: data.type,
        status: data.status,
        error_count: data.errorCount,
        response_time: data.responseTime,
        transactions_synced: data.transactionsSynced
      });

      if (data.status === 'failed' || data.errorCount > 0) {
        Sentry.captureMessage(
          `POS integration health issue: ${data.type} - ${data.status}`,
          data.status === 'failed' ? 'error' : 'warning'
        );
      }
    });
  }

  public trackRedisPerformance(data: RedisPerformance): void {
    Sentry.withScope(scope => {
      scope.setTag('event_type', 'redis_performance');
      scope.setTag('operation', data.operation);
      scope.setTag('success', data.success.toString());

      scope.setContext('redis_operation', {
        operation: data.operation,
        latency: data.latency,
        success: data.success,
        error_message: data.error?.message
      });

      if (!data.success && data.error) {
        Sentry.captureException(data.error);
      } else if (data.latency > 1000) {
        Sentry.captureMessage(
          `Slow Redis operation: ${data.operation} took ${data.latency}ms`,
          'warning'
        );
      }
    });
  }

  public trackComplianceWorkflow(data: ComplianceWorkflow): void {
    Sentry.withScope(scope => {
      scope.setTag('event_type', 'compliance_workflow');
      scope.setTag('workflow_type', data.type);
      scope.setTag('business_id', data.businessId);
      scope.setTag('jurisdiction', data.jurisdiction);
      scope.setTag('status', data.status);

      scope.setContext('compliance_workflow', {
        type: data.type,
        business_id: data.businessId,
        jurisdiction: data.jurisdiction,
        status: data.status,
        compliance_score: data.complianceScore
      });

      if (data.status === 'failed') {
        Sentry.captureMessage(
          `Compliance workflow failed: ${data.type} for ${data.businessId}`,
          'error'
        );
      }
    });
  }

  public createComplianceAlert(alert: ComplianceAlert): string {
    return Sentry.withScope(scope => {
      scope.setTag('alert_type', alert.type);
      scope.setTag('severity', alert.severity);
      scope.setTag('business_id', alert.businessId);
      scope.setTag('jurisdiction', alert.jurisdiction);

      scope.setContext('compliance_alert', {
        type: alert.type,
        severity: alert.severity,
        business_id: alert.businessId,
        jurisdiction: alert.jurisdiction,
        metadata: alert.metadata,
        timestamp: alert.timestamp.toISOString()
      });

      const sentryLevel: Sentry.SeverityLevel = 
        alert.severity === 'critical' ? 'fatal' :
        alert.severity === 'high' ? 'error' :
        alert.severity === 'medium' ? 'warning' : 'info';

      return Sentry.captureMessage(alert.message, sentryLevel);
    });
  }

  public createCustomAlert(
    title: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): string {
    return Sentry.withScope(scope => {
      scope.setTag('alert_type', 'custom');
      scope.setTag('severity', severity);

      if (metadata) {
        scope.setContext('custom_alert', metadata);
        Object.entries(metadata).forEach(([key, value]) => {
          scope.setTag(key, String(value));
        });
      }

      const sentryLevel: Sentry.SeverityLevel = 
        severity === 'critical' ? 'fatal' :
        severity === 'high' ? 'error' :
        severity === 'medium' ? 'warning' : 'info';

      return Sentry.captureMessage(`${title}: ${message}`, sentryLevel);
    });
  }

  public startTransaction(name: string, op: string, data?: Record<string, any>): any {
    const span = Sentry.startInactiveSpan({
      name,
      op
    });

    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        span.setAttribute(key, String(value));
      });
    }

    return span;
  }

  public createSpan(parentTransaction: any, operation: string, description: string): any {
    return Sentry.startInactiveSpan({
      name: description,
      op: operation,
      parentSpan: parentTransaction
    });
  }

  public setUserContext(user: {
    id: string;
    businessId?: string;
    email?: string;
    role?: string;
  }): void {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.id,
      segment: user.businessId,
      data: {
        business_id: user.businessId,
        role: user.role
      }
    });
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    isInitialized: boolean;
    metricsCollected: number;
    lastError?: string;
  }> {
    try {
      const status = this.isInitialized ? 'healthy' : 'unhealthy';
      
      return {
        status,
        isInitialized: this.isInitialized,
        metricsCollected: 0,
        lastError: undefined
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        isInitialized: false,
        metricsCollected: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async flush(timeout: number = 5000): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      await Sentry.flush(timeout);
      return true;
    } catch (error) {
      logger.error('Failed to flush Sentry events:', error);
      return false;
    }
  }

  public getRequestHandler(): any {
    return Sentry.expressIntegration();
  }

  public getTracingHandler(): any {
    return Sentry.expressIntegration();
  }

  public getErrorHandler(): any {
    return Sentry.expressErrorHandler();
  }

  public close(): Promise<boolean> {
    return Sentry.close();
  }
}

// Export singleton instance
export const sentryService = SentryService.getInstance();