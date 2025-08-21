import { EventEmitter } from 'events';
export declare enum AlertSeverity {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    CRITICAL = "critical"
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
export declare class AlertSystem extends EventEmitter {
    private static instance;
    private alerts;
    private rules;
    private channels;
    private cooldownTracker;
    private constructor();
    static getInstance(): AlertSystem;
    createAlert(severity: AlertSeverity, title: string, message: string, source: string, metadata?: Record<string, any>): Alert;
    resolveAlert(alertId: string): boolean;
    addRule(rule: AlertRule): void;
    removeRule(ruleId: string): boolean;
    enableRule(ruleId: string): boolean;
    disableRule(ruleId: string): boolean;
    addChannel(channel: NotificationChannel): void;
    removeChannel(channelId: string): boolean;
    evaluateRules(data: any): void;
    private sendNotifications;
    private sendToChannel;
    private sendEmailNotification;
    private sendSlackNotification;
    private sendWebhookNotification;
    private setupDefaultRules;
    private setupDefaultChannels;
    private setupMonitoring;
    private generateAlertId;
    getAlerts(options?: {
        severity?: AlertSeverity;
        resolved?: boolean;
        since?: Date;
        limit?: number;
    }): Alert[];
    getUnresolvedAlerts(): Alert[];
    getCriticalAlerts(): Alert[];
    getAlertSummary(): {
        total: number;
        unresolved: number;
        bySeverity: Record<AlertSeverity, number>;
    };
}
export declare const alertSystem: AlertSystem;
//# sourceMappingURL=AlertSystem.d.ts.map