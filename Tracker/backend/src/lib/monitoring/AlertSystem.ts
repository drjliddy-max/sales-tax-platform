/**
 * Alert System for POS Integration Monitoring
 * Handles notifications and escalations for critical events
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';
import { performanceMonitor } from './PerformanceMonitor';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (data: any) => boolean;
  severity: AlertSeverity;
  message: string;
  cooldownMs: number;
  enabled: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'console';
  config: Record<string, any>;
  enabled: boolean;
  severityFilter?: AlertSeverity[];
}

export class AlertSystem extends EventEmitter {
  private static instance: AlertSystem;
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private channels: NotificationChannel[] = [];
  private cooldownTracker: Map<string, number> = new Map();

  private constructor() {
    super();
    this.setupDefaultRules();
    this.setupDefaultChannels();
    this.setupMonitoring();
  }

  static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem();
    }
    return AlertSystem.instance;
  }

  // Alert management
  createAlert(
    severity: AlertSeverity,
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Alert {
    const alert: Alert = {
      id: this.generateAlertId(),
      severity,
      title,
      message,
      timestamp: new Date(),
      source,
      metadata
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Send notifications
    this.sendNotifications(alert);

    logger.info('ALERT', `Alert created: ${title}`, {
      severity,
      source,
      metadata
    });

    return alert;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    this.emit('alert-resolved', alert);

    logger.info('ALERT', `Alert resolved: ${alert.title}`, {
      alertId,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
    });

    return true;
  }

  // Rule management
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    logger.info('ALERT', `Alert rule added: ${rule.name}`);
  }

  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;

    const rule = this.rules.splice(index, 1)[0];
    logger.info('ALERT', `Alert rule removed: ${rule.name}`);
    return true;
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return false;

    rule.enabled = true;
    logger.info('ALERT', `Alert rule enabled: ${rule.name}`);
    return true;
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (!rule) return false;

    rule.enabled = false;
    logger.info('ALERT', `Alert rule disabled: ${rule.name}`);
    return true;
  }

  // Channel management
  addChannel(channel: NotificationChannel): void {
    this.channels.push(channel);
    logger.info('ALERT', `Notification channel added: ${channel.name}`);
  }

  removeChannel(channelId: string): boolean {
    const index = this.channels.findIndex(c => c.id === channelId);
    if (index === -1) return false;

    const channel = this.channels.splice(index, 1)[0];
    logger.info('ALERT', `Notification channel removed: ${channel.name}`);
    return true;
  }

  // Rule evaluation
  evaluateRules(data: any): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTriggered = this.cooldownTracker.get(rule.id) || 0;
      if (Date.now() - lastTriggered < rule.cooldownMs) {
        continue;
      }

      try {
        if (rule.condition(data)) {
          this.createAlert(
            rule.severity,
            rule.name,
            rule.message,
            'rule-engine',
            { rule_id: rule.id, trigger_data: data }
          );

          this.cooldownTracker.set(rule.id, Date.now());
        }
      } catch (error) {
        logger.error('ALERT', `Error evaluating rule ${rule.name}`, {
          error: error.message,
          rule_id: rule.id
        });
      }
    }
  }

  // Notification sending
  private async sendNotifications(alert: Alert): Promise<void> {
    for (const channel of this.channels) {
      if (!channel.enabled) continue;

      // Check severity filter
      if (channel.severityFilter && !channel.severityFilter.includes(alert.severity)) {
        continue;
      }

      try {
        await this.sendToChannel(alert, channel);
      } catch (error) {
        logger.error('ALERT', `Failed to send notification to ${channel.name}`, {
          error: error.message,
          alert_id: alert.id
        });
      }
    }
  }

  private async sendToChannel(alert: Alert, channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`);
        console.log(`   ${alert.message}`);
        console.log(`   Source: ${alert.source} | Time: ${alert.timestamp.toISOString()}`);
        break;

      case 'email':
        await this.sendEmailNotification(alert, channel);
        break;

      case 'slack':
        await this.sendSlackNotification(alert, channel);
        break;

      case 'webhook':
        await this.sendWebhookNotification(alert, channel);
        break;

      default:
        logger.warn('ALERT', `Unknown channel type: ${channel.type}`);
    }
  }

  private async sendEmailNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    // Email implementation would go here
    // For now, just log
    logger.info('ALERT', `Email notification sent for alert: ${alert.title}`, {
      to: channel.config.recipient,
      alert_id: alert.id
    });
  }

  private async sendSlackNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    // Slack implementation would go here
    // For now, just log
    logger.info('ALERT', `Slack notification sent for alert: ${alert.title}`, {
      webhook: channel.config.webhook_url,
      alert_id: alert.id
    });
  }

  private async sendWebhookNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    // Webhook implementation would go here
    // For now, just log
    logger.info('ALERT', `Webhook notification sent for alert: ${alert.title}`, {
      url: channel.config.url,
      alert_id: alert.id
    });
  }

  // Setup methods
  private setupDefaultRules(): void {
    // High memory usage rule
    this.addRule({
      id: 'high-memory',
      name: 'High Memory Usage',
      condition: (data) => {
        const memoryMB = data.memoryUsage?.used / 1024 / 1024;
        return memoryMB > 1024; // 1GB
      },
      severity: AlertSeverity.WARNING,
      message: 'Memory usage is above 1GB',
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // High error rate rule
    this.addRule({
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: (data) => {
        return data.errorRate > 0.05; // 5%
      },
      severity: AlertSeverity.ERROR,
      message: 'Error rate is above 5%',
      cooldownMs: 2 * 60 * 1000, // 2 minutes
      enabled: true
    });

    // Slow response time rule
    this.addRule({
      id: 'slow-response',
      name: 'Slow Response Time',
      condition: (data) => {
        return data.responseTimeP95 > 5000; // 5 seconds
      },
      severity: AlertSeverity.WARNING,
      message: 'P95 response time is above 5 seconds',
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // POS sync failure rule
    this.addRule({
      id: 'pos-sync-failure',
      name: 'POS Sync Failure',
      condition: (data) => {
        return data.operation === 'sync' && data.success === false;
      },
      severity: AlertSeverity.ERROR,
      message: 'POS synchronization failed',
      cooldownMs: 1 * 60 * 1000, // 1 minute
      enabled: true
    });

    // Multiple POS failures rule
    this.addRule({
      id: 'multiple-pos-failures',
      name: 'Multiple POS Failures',
      condition: (data) => {
        const failureCount = data.recentPOSFailures || 0;
        return failureCount >= 3;
      },
      severity: AlertSeverity.CRITICAL,
      message: 'Multiple POS systems are experiencing failures',
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      enabled: true
    });
  }

  private setupDefaultChannels(): void {
    // Console channel for development
    this.addChannel({
      id: 'console',
      name: 'Console Output',
      type: 'console',
      config: {},
      enabled: true,
      severityFilter: [AlertSeverity.WARNING, AlertSeverity.ERROR, AlertSeverity.CRITICAL]
    });
  }

  private setupMonitoring(): void {
    // Monitor performance metrics
    performanceMonitor.on('health-check', (health) => {
      this.evaluateRules(health);
    });

    // Monitor POS operations
    performanceMonitor.on('metric', (metric) => {
      if (metric.name.startsWith('pos_')) {
        this.evaluateRules({
          operation: metric.tags?.operation,
          success: metric.tags?.status === 'success',
          posId: metric.tags?.pos_id,
          value: metric.value
        });
      }
    });

    // Check alerts periodically
    setInterval(() => {
      performanceMonitor.checkAlerts();
    }, 60 * 1000); // 1 minute
  }

  // Utility methods
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Query methods
  getAlerts(options?: {
    severity?: AlertSeverity;
    resolved?: boolean;
    since?: Date;
    limit?: number;
  }): Alert[] {
    let filtered = this.alerts;

    if (options?.severity) {
      filtered = filtered.filter(a => a.severity === options.severity);
    }

    if (options?.resolved !== undefined) {
      filtered = filtered.filter(a => !!a.resolved === options.resolved);
    }

    if (options?.since) {
      filtered = filtered.filter(a => a.timestamp >= options.since!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getUnresolvedAlerts(): Alert[] {
    return this.getAlerts({ resolved: false });
  }

  getCriticalAlerts(): Alert[] {
    return this.getAlerts({ 
      severity: AlertSeverity.CRITICAL, 
      resolved: false 
    });
  }

  getAlertSummary(): {
    total: number;
    unresolved: number;
    bySeverity: Record<AlertSeverity, number>;
  } {
    const unresolved = this.getUnresolvedAlerts();
    
    const bySeverity = {
      [AlertSeverity.INFO]: 0,
      [AlertSeverity.WARNING]: 0,
      [AlertSeverity.ERROR]: 0,
      [AlertSeverity.CRITICAL]: 0
    };

    unresolved.forEach(alert => {
      bySeverity[alert.severity]++;
    });

    return {
      total: this.alerts.length,
      unresolved: unresolved.length,
      bySeverity
    };
  }
}

// Export singleton instance
export const alertSystem = AlertSystem.getInstance();
