import { sentryService } from './SentryService';
import { logger } from '@/utils';

interface POSIntegrationEvent {
  type: 'square' | 'shopify' | 'clover';
  businessId: string;
  operation: 'sync' | 'webhook' | 'payment' | 'refund' | 'connection_test';
  status: 'success' | 'partial' | 'failed';
  duration: number;
  recordCount?: number;
  errorDetails?: string;
  metadata?: Record<string, any>;
}

interface POSHealthMetrics {
  integrationId: string;
  type: 'square' | 'shopify' | 'clover';
  businessId: string;
  isConnected: boolean;
  lastSuccessfulSync?: Date;
  errorRate: number;
  avgResponseTime: number;
  totalTransactions: number;
  failedTransactions: number;
  uptime: number; // percentage
}

export class POSMonitoringService {
  private static instance: POSMonitoringService;
  private integrationMetrics = new Map<string, POSHealthMetrics>();
  private alertCooldowns = new Map<string, Date>();

  private constructor() {}

  public static getInstance(): POSMonitoringService {
    if (!POSMonitoringService.instance) {
      POSMonitoringService.instance = new POSMonitoringService();
    }
    return POSMonitoringService.instance;
  }

  public trackPOSEvent(event: POSIntegrationEvent): void {
    const startTime = Date.now();
    
    // Create Sentry transaction for POS operation
    const transaction = sentryService.startTransaction(
      `pos_${event.operation}`,
      'integration.pos',
      {
        businessId: event.businessId,
        integrationType: event.type,
        operation: event.operation
      }
    );

    try {
      // Track the event in Sentry
      sentryService.trackPOSIntegrationHealth({
        type: event.type,
        businessId: event.businessId,
        status: this.mapEventStatusToHealth(event.status),
        errorCount: event.status === 'failed' ? 1 : 0,
        responseTime: event.duration,
        transactionsSynced: event.recordCount
      });

      // Update local metrics
      this.updateIntegrationMetrics(event);

      // Check for alerts
      this.checkPOSAlerts(event);

      // Add breadcrumb for tracking
      sentryService.addBreadcrumb(
        'pos_integration',
        `${event.type} ${event.operation}: ${event.status}`,
        event.status === 'failed' ? 'error' : 'info',
        {
          integration_type: event.type,
          operation: event.operation,
          duration: event.duration,
          record_count: event.recordCount
        }
      );

      transaction.setAttribute('integration_type', event.type);
      transaction.setAttribute('operation', event.operation);
      transaction.setAttribute('status', event.status);
      transaction.end();

    } catch (error) {
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('POS monitoring error'),
        {
          businessId: event.businessId,
          severity: 'medium'
        }
      );

      transaction.setAttribute('error', 'true');
      transaction.end();
    }
  }

  private mapEventStatusToHealth(status: string): 'healthy' | 'degraded' | 'failed' {
    switch (status) {
      case 'success': return 'healthy';
      case 'partial': return 'degraded';
      case 'failed': return 'failed';
      default: return 'degraded';
    }
  }

  private updateIntegrationMetrics(event: POSIntegrationEvent): void {
    const key = `${event.businessId}_${event.type}`;
    const existing = this.integrationMetrics.get(key) || {
      integrationId: key,
      type: event.type,
      businessId: event.businessId,
      isConnected: false,
      errorRate: 0,
      avgResponseTime: 0,
      totalTransactions: 0,
      failedTransactions: 0,
      uptime: 100
    };

    // Update metrics
    existing.isConnected = event.status !== 'failed';
    existing.totalTransactions += event.recordCount || 1;
    
    if (event.status === 'failed') {
      existing.failedTransactions++;
    }
    
    existing.errorRate = existing.failedTransactions / existing.totalTransactions;
    existing.avgResponseTime = (existing.avgResponseTime + event.duration) / 2;

    if (event.status === 'success') {
      existing.lastSuccessfulSync = new Date();
    }

    this.integrationMetrics.set(key, existing);
  }

  private checkPOSAlerts(event: POSIntegrationEvent): void {
    const alertKey = `${event.businessId}_${event.type}`;
    const lastAlert = this.alertCooldowns.get(alertKey);
    const now = new Date();

    // Cooldown period of 15 minutes between similar alerts
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < 15 * 60 * 1000) {
      return;
    }

    const metrics = this.integrationMetrics.get(alertKey);
    
    if (!metrics) {
      return;
    }

    // High error rate alert
    if (metrics.errorRate > 0.1 && metrics.totalTransactions > 10) {
      sentryService.createComplianceAlert({
        type: 'threshold',
        severity: metrics.errorRate > 0.25 ? 'critical' : 'high',
        businessId: event.businessId,
        jurisdiction: 'POS Integration',
        message: `${event.type} integration error rate is ${(metrics.errorRate * 100).toFixed(1)}%`,
        metadata: {
          integration_type: event.type,
          error_rate: metrics.errorRate,
          total_transactions: metrics.totalTransactions,
          failed_transactions: metrics.failedTransactions
        },
        timestamp: now
      });

      this.alertCooldowns.set(alertKey, now);
    }

    // Connection failure alert
    if (!metrics.isConnected) {
      sentryService.createComplianceAlert({
        type: 'threshold',
        severity: 'high',
        businessId: event.businessId,
        jurisdiction: 'POS Integration',
        message: `${event.type} integration connection failed`,
        metadata: {
          integration_type: event.type,
          last_successful_sync: metrics.lastSuccessfulSync?.toISOString(),
          operation: event.operation
        },
        timestamp: now
      });

      this.alertCooldowns.set(alertKey, now);
    }
  }

  public async monitorPOSWebhook(
    webhookData: {
      source: string;
      businessId: string;
      eventType: string;
      processingTime: number;
      success: boolean;
      errorMessage?: string;
    }
  ): Promise<void> {
    const transaction = sentryService.startTransaction(
      `pos_webhook_${webhookData.source}`,
      'integration.webhook',
      {
        businessId: webhookData.businessId,
        source: webhookData.source,
        eventType: webhookData.eventType
      }
    );

    try {
      // Track webhook processing
      this.trackPOSEvent({
        type: webhookData.source as any,
        businessId: webhookData.businessId,
        operation: 'webhook',
        status: webhookData.success ? 'success' : 'failed',
        duration: webhookData.processingTime,
        recordCount: 1,
        errorDetails: webhookData.errorMessage,
        metadata: {
          event_type: webhookData.eventType
        }
      });

      if (!webhookData.success) {
        sentryService.captureFinancialError(
          new Error(`POS webhook processing failed: ${webhookData.errorMessage}`),
          {
            businessId: webhookData.businessId,
            severity: 'medium'
          }
        );
      }

      transaction.setAttribute('webhook_event', webhookData.eventType);
      transaction.setAttribute('success', webhookData.success.toString());
      transaction.end();

    } catch (error) {
      transaction.setAttribute('error', 'true');
      transaction.end();
      throw error;
    }
  }

  public getPOSIntegrationMetrics(businessId: string): POSHealthMetrics[] {
    const metrics: POSHealthMetrics[] = [];
    
    for (const [key, metric] of this.integrationMetrics.entries()) {
      if (metric.businessId === businessId) {
        metrics.push(metric);
      }
    }
    
    return metrics;
  }

  public getAllPOSMetrics(): Map<string, POSHealthMetrics> {
    return new Map(this.integrationMetrics);
  }

  public async generatePOSHealthReport(): Promise<{
    summary: {
      totalIntegrations: number;
      healthyIntegrations: number;
      degradedIntegrations: number;
      failedIntegrations: number;
    };
    integrations: POSHealthMetrics[];
    alerts: Array<{
      businessId: string;
      type: string;
      severity: string;
      message: string;
    }>;
  }> {
    const integrations = Array.from(this.integrationMetrics.values());
    
    const summary = {
      totalIntegrations: integrations.length,
      healthyIntegrations: integrations.filter(i => i.isConnected && i.errorRate < 0.05).length,
      degradedIntegrations: integrations.filter(i => i.isConnected && i.errorRate >= 0.05).length,
      failedIntegrations: integrations.filter(i => !i.isConnected).length
    };

    const alerts = integrations
      .filter(i => !i.isConnected || i.errorRate > 0.1)
      .map(i => ({
        businessId: i.businessId,
        type: i.type,
        severity: i.isConnected ? 'medium' : 'high',
        message: i.isConnected 
          ? `High error rate: ${(i.errorRate * 100).toFixed(1)}%`
          : 'Integration disconnected'
      }));

    // Send summary to Sentry
    sentryService.addBreadcrumb(
      'pos_health_report',
      `POS Health: ${summary.healthyIntegrations}/${summary.totalIntegrations} healthy`,
      summary.failedIntegrations > 0 ? 'error' : 'info',
      summary
    );

    return {
      summary,
      integrations,
      alerts
    };
  }

  public resetMetrics(businessId?: string): void {
    if (businessId) {
      // Reset metrics for specific business
      const keysToDelete = Array.from(this.integrationMetrics.keys())
        .filter(key => key.startsWith(businessId));
      
      keysToDelete.forEach(key => {
        this.integrationMetrics.delete(key);
        this.alertCooldowns.delete(key);
      });
      
      logger.info(`Reset POS metrics for business: ${businessId}`);
    } else {
      // Reset all metrics
      this.integrationMetrics.clear();
      this.alertCooldowns.clear();
      logger.info('Reset all POS metrics');
    }

    sentryService.addBreadcrumb(
      'pos_metrics',
      businessId ? `Reset metrics for ${businessId}` : 'Reset all metrics',
      'info'
    );
  }
}

// Export singleton instance
export const posMonitoring = POSMonitoringService.getInstance();