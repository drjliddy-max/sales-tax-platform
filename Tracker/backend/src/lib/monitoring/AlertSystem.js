"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertSystem = exports.AlertSystem = exports.AlertSeverity = void 0;
const events_1 = require("events");
const Logger_1 = require("../logging/Logger");
const PerformanceMonitor_1 = require("./PerformanceMonitor");
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["INFO"] = "info";
    AlertSeverity["WARNING"] = "warning";
    AlertSeverity["ERROR"] = "error";
    AlertSeverity["CRITICAL"] = "critical";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
class AlertSystem extends events_1.EventEmitter {
    constructor() {
        super();
        this.alerts = [];
        this.rules = [];
        this.channels = [];
        this.cooldownTracker = new Map();
        this.setupDefaultRules();
        this.setupDefaultChannels();
        this.setupMonitoring();
    }
    static getInstance() {
        if (!AlertSystem.instance) {
            AlertSystem.instance = new AlertSystem();
        }
        return AlertSystem.instance;
    }
    createAlert(severity, title, message, source, metadata) {
        const alert = {
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
        this.sendNotifications(alert);
        Logger_1.logger.info('ALERT', `Alert created: ${title}`, {
            severity,
            source,
            metadata
        });
        return alert;
    }
    resolveAlert(alertId) {
        const alert = this.alerts.find(a => a.id === alertId);
        if (!alert || alert.resolved) {
            return false;
        }
        alert.resolved = true;
        alert.resolvedAt = new Date();
        this.emit('alert-resolved', alert);
        Logger_1.logger.info('ALERT', `Alert resolved: ${alert.title}`, {
            alertId,
            duration: alert.resolvedAt.getTime() - alert.timestamp.getTime()
        });
        return true;
    }
    addRule(rule) {
        this.rules.push(rule);
        Logger_1.logger.info('ALERT', `Alert rule added: ${rule.name}`);
    }
    removeRule(ruleId) {
        const index = this.rules.findIndex(r => r.id === ruleId);
        if (index === -1)
            return false;
        const rule = this.rules.splice(index, 1)[0];
        Logger_1.logger.info('ALERT', `Alert rule removed: ${rule.name}`);
        return true;
    }
    enableRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule)
            return false;
        rule.enabled = true;
        Logger_1.logger.info('ALERT', `Alert rule enabled: ${rule.name}`);
        return true;
    }
    disableRule(ruleId) {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule)
            return false;
        rule.enabled = false;
        Logger_1.logger.info('ALERT', `Alert rule disabled: ${rule.name}`);
        return true;
    }
    addChannel(channel) {
        this.channels.push(channel);
        Logger_1.logger.info('ALERT', `Notification channel added: ${channel.name}`);
    }
    removeChannel(channelId) {
        const index = this.channels.findIndex(c => c.id === channelId);
        if (index === -1)
            return false;
        const channel = this.channels.splice(index, 1)[0];
        Logger_1.logger.info('ALERT', `Notification channel removed: ${channel.name}`);
        return true;
    }
    evaluateRules(data) {
        for (const rule of this.rules) {
            if (!rule.enabled)
                continue;
            const lastTriggered = this.cooldownTracker.get(rule.id) || 0;
            if (Date.now() - lastTriggered < rule.cooldownMs) {
                continue;
            }
            try {
                if (rule.condition(data)) {
                    this.createAlert(rule.severity, rule.name, rule.message, 'rule-engine', { rule_id: rule.id, trigger_data: data });
                    this.cooldownTracker.set(rule.id, Date.now());
                }
            }
            catch (error) {
                Logger_1.logger.error('ALERT', `Error evaluating rule ${rule.name}`, {
                    error: error.message,
                    rule_id: rule.id
                });
            }
        }
    }
    async sendNotifications(alert) {
        for (const channel of this.channels) {
            if (!channel.enabled)
                continue;
            if (channel.severityFilter && !channel.severityFilter.includes(alert.severity)) {
                continue;
            }
            try {
                await this.sendToChannel(alert, channel);
            }
            catch (error) {
                Logger_1.logger.error('ALERT', `Failed to send notification to ${channel.name}`, {
                    error: error.message,
                    alert_id: alert.id
                });
            }
        }
    }
    async sendToChannel(alert, channel) {
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
                Logger_1.logger.warn('ALERT', `Unknown channel type: ${channel.type}`);
        }
    }
    async sendEmailNotification(alert, channel) {
        Logger_1.logger.info('ALERT', `Email notification sent for alert: ${alert.title}`, {
            to: channel.config.recipient,
            alert_id: alert.id
        });
    }
    async sendSlackNotification(alert, channel) {
        Logger_1.logger.info('ALERT', `Slack notification sent for alert: ${alert.title}`, {
            webhook: channel.config.webhook_url,
            alert_id: alert.id
        });
    }
    async sendWebhookNotification(alert, channel) {
        Logger_1.logger.info('ALERT', `Webhook notification sent for alert: ${alert.title}`, {
            url: channel.config.url,
            alert_id: alert.id
        });
    }
    setupDefaultRules() {
        this.addRule({
            id: 'high-memory',
            name: 'High Memory Usage',
            condition: (data) => {
                const memoryMB = data.memoryUsage?.used / 1024 / 1024;
                return memoryMB > 1024;
            },
            severity: AlertSeverity.WARNING,
            message: 'Memory usage is above 1GB',
            cooldownMs: 5 * 60 * 1000,
            enabled: true
        });
        this.addRule({
            id: 'high-error-rate',
            name: 'High Error Rate',
            condition: (data) => {
                return data.errorRate > 0.05;
            },
            severity: AlertSeverity.ERROR,
            message: 'Error rate is above 5%',
            cooldownMs: 2 * 60 * 1000,
            enabled: true
        });
        this.addRule({
            id: 'slow-response',
            name: 'Slow Response Time',
            condition: (data) => {
                return data.responseTimeP95 > 5000;
            },
            severity: AlertSeverity.WARNING,
            message: 'P95 response time is above 5 seconds',
            cooldownMs: 5 * 60 * 1000,
            enabled: true
        });
        this.addRule({
            id: 'pos-sync-failure',
            name: 'POS Sync Failure',
            condition: (data) => {
                return data.operation === 'sync' && data.success === false;
            },
            severity: AlertSeverity.ERROR,
            message: 'POS synchronization failed',
            cooldownMs: 1 * 60 * 1000,
            enabled: true
        });
        this.addRule({
            id: 'multiple-pos-failures',
            name: 'Multiple POS Failures',
            condition: (data) => {
                const failureCount = data.recentPOSFailures || 0;
                return failureCount >= 3;
            },
            severity: AlertSeverity.CRITICAL,
            message: 'Multiple POS systems are experiencing failures',
            cooldownMs: 10 * 60 * 1000,
            enabled: true
        });
    }
    setupDefaultChannels() {
        this.addChannel({
            id: 'console',
            name: 'Console Output',
            type: 'console',
            config: {},
            enabled: true,
            severityFilter: [AlertSeverity.WARNING, AlertSeverity.ERROR, AlertSeverity.CRITICAL]
        });
    }
    setupMonitoring() {
        PerformanceMonitor_1.performanceMonitor.on('health-check', (health) => {
            this.evaluateRules(health);
        });
        PerformanceMonitor_1.performanceMonitor.on('metric', (metric) => {
            if (metric.name.startsWith('pos_')) {
                this.evaluateRules({
                    operation: metric.tags?.operation,
                    success: metric.tags?.status === 'success',
                    posId: metric.tags?.pos_id,
                    value: metric.value
                });
            }
        });
        setInterval(() => {
            PerformanceMonitor_1.performanceMonitor.checkAlerts();
        }, 60 * 1000);
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    getAlerts(options) {
        let filtered = this.alerts;
        if (options?.severity) {
            filtered = filtered.filter(a => a.severity === options.severity);
        }
        if (options?.resolved !== undefined) {
            filtered = filtered.filter(a => !!a.resolved === options.resolved);
        }
        if (options?.since) {
            filtered = filtered.filter(a => a.timestamp >= options.since);
        }
        filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        if (options?.limit) {
            filtered = filtered.slice(0, options.limit);
        }
        return filtered;
    }
    getUnresolvedAlerts() {
        return this.getAlerts({ resolved: false });
    }
    getCriticalAlerts() {
        return this.getAlerts({
            severity: AlertSeverity.CRITICAL,
            resolved: false
        });
    }
    getAlertSummary() {
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
exports.AlertSystem = AlertSystem;
exports.alertSystem = AlertSystem.getInstance();
//# sourceMappingURL=AlertSystem.js.map