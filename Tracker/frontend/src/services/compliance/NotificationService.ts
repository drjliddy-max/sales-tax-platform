export interface NotificationConfig {
  id: string;
  businessId: string;
  type: 'filing_deadline' | 'filing_overdue' | 'filing_submitted' | 'filing_rejected' | 'compliance_issue' | 'system_alert';
  channels: NotificationChannel[];
  triggers: NotificationTrigger[];
  schedule: NotificationSchedule;
  template: NotificationTemplate;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationChannel {
  type: 'email' | 'sms' | 'push' | 'in_app' | 'webhook';
  config: {
    email?: { recipients: string[]; cc?: string[]; bcc?: string[] };
    sms?: { phoneNumbers: string[] };
    push?: { devices: string[] };
    webhook?: { url: string; headers?: Record<string, string> };
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
}

export interface NotificationTrigger {
  condition: string; // e.g., "daysUntilDue <= 7"
  value: any;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'contains';
}

export interface NotificationSchedule {
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  time?: string; // HH:MM format
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  advanceDays?: number; // For deadline notifications
  maxReminders?: number;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: Record<string, string>;
  htmlBody?: string;
}

export interface Notification {
  id: string;
  businessId: string;
  type: NotificationConfig['type'];
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: NotificationChannel['type'][];
  priority: NotificationChannel['priority'];
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  scheduledFor: Date;
  sentAt?: Date;
  readAt?: Date;
  attempts: NotificationAttempt[];
  relatedEntityId?: string; // e.g., filing ID
  relatedEntityType?: string; // e.g., 'filing'
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationAttempt {
  id: string;
  channel: NotificationChannel['type'];
  attemptedAt: Date;
  status: 'success' | 'failed' | 'timeout';
  response?: any;
  errorMessage?: string;
}

export interface DeadlineAlert {
  id: string;
  businessId: string;
  jurisdiction: string;
  filingType: string;
  dueDate: Date;
  daysUntilDue: number;
  isOverdue: boolean;
  estimatedAmount?: number;
  filingId?: string;
  alertLevel: 'info' | 'warning' | 'critical';
  hasBeenNotified: boolean;
  notificationsSent: string[];
  lastNotificationAt?: Date;
  createdAt: Date;
}

export interface ComplianceIssue {
  id: string;
  businessId: string;
  type: 'missing_filing' | 'calculation_error' | 'validation_failure' | 'submission_error' | 'audit_flag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedFilings: string[];
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  assignedTo?: string;
  tags: string[];
  estimatedImpact?: {
    financial: number;
    compliance: string;
    reputation: string;
  };
}

export class NotificationService {
  private configs = new Map<string, NotificationConfig>();
  private templates = new Map<string, NotificationTemplate>();
  private pendingNotifications: Notification[] = [];
  private deadlineAlerts = new Map<string, DeadlineAlert>();
  private complianceIssues = new Map<string, ComplianceIssue>();
  private isProcessing = false;

  constructor() {
    this.initializeDefaultTemplates();
    this.startNotificationProcessor();
    this.startDeadlineMonitor();
  }

  /**
   * Create a new notification configuration
   */
  async createNotificationConfig(config: Omit<NotificationConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationConfig> {
    const newConfig: NotificationConfig = {
      ...config,
      id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.configs.set(newConfig.id, newConfig);
    await this.persistConfig(newConfig);

    return newConfig;
  }

  /**
   * Schedule a notification
   */
  async scheduleNotification(
    businessId: string,
    type: NotificationConfig['type'],
    data: Record<string, any>,
    scheduledFor?: Date,
    priority: NotificationChannel['priority'] = 'medium'
  ): Promise<Notification> {
    // Find matching notification config
    const config = Array.from(this.configs.values()).find(
      c => c.businessId === businessId && c.type === type && c.isActive
    );

    if (!config) {
      throw new Error(`No notification configuration found for type: ${type}`);
    }

    // Get template
    const template = this.templates.get(config.template.id);
    if (!template) {
      throw new Error(`Template not found: ${config.template.id}`);
    }

    // Render notification content
    const { subject, body } = this.renderTemplate(template, data);

    const notification: Notification = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      businessId,
      type,
      title: subject,
      message: body,
      data,
      channels: config.channels.filter(c => c.isActive).map(c => c.type),
      priority,
      status: 'pending',
      scheduledFor: scheduledFor || new Date(),
      attempts: [],
      relatedEntityId: data.filingId || data.entityId,
      relatedEntityType: data.entityType || 'filing',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.pendingNotifications.push(notification);
    await this.persistNotification(notification);

    return notification;
  }

  /**
   * Send immediate notification
   */
  async sendImmediateNotification(
    businessId: string,
    type: NotificationConfig['type'],
    title: string,
    message: string,
    data: Record<string, any> = {},
    priority: NotificationChannel['priority'] = 'high'
  ): Promise<Notification> {
    const notification = await this.scheduleNotification(businessId, type, {
      title,
      message,
      ...data
    }, new Date(), priority);

    await this.processNotification(notification);
    return notification;
  }

  /**
   * Create deadline alert
   */
  async createDeadlineAlert(
    businessId: string,
    jurisdiction: string,
    filingType: string,
    dueDate: Date,
    estimatedAmount?: number,
    filingId?: string
  ): Promise<DeadlineAlert> {
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysUntilDue < 0;

    let alertLevel: DeadlineAlert['alertLevel'] = 'info';
    if (isOverdue) {
      alertLevel = 'critical';
    } else if (daysUntilDue <= 3) {
      alertLevel = 'critical';
    } else if (daysUntilDue <= 7) {
      alertLevel = 'warning';
    }

    const alert: DeadlineAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      businessId,
      jurisdiction,
      filingType,
      dueDate,
      daysUntilDue,
      isOverdue,
      estimatedAmount,
      filingId,
      alertLevel,
      hasBeenNotified: false,
      notificationsSent: [],
      createdAt: new Date()
    };

    this.deadlineAlerts.set(alert.id, alert);
    await this.persistDeadlineAlert(alert);

    // Schedule notification if needed
    if (alertLevel === 'critical' || (alertLevel === 'warning' && !alert.hasBeenNotified)) {
      await this.scheduleDeadlineNotification(alert);
    }

    return alert;
  }

  /**
   * Report compliance issue
   */
  async reportComplianceIssue(
    businessId: string,
    type: ComplianceIssue['type'],
    severity: ComplianceIssue['severity'],
    title: string,
    description: string,
    affectedFilings: string[] = [],
    estimatedImpact?: ComplianceIssue['estimatedImpact']
  ): Promise<ComplianceIssue> {
    const issue: ComplianceIssue = {
      id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      businessId,
      type,
      severity,
      title,
      description,
      affectedFilings,
      detectedAt: new Date(),
      tags: [],
      estimatedImpact
    };

    this.complianceIssues.set(issue.id, issue);
    await this.persistComplianceIssue(issue);

    // Send immediate notification for high severity issues
    if (severity === 'high' || severity === 'critical') {
      await this.sendImmediateNotification(
        businessId,
        'compliance_issue',
        `Compliance Issue: ${title}`,
        description,
        {
          issueId: issue.id,
          severity,
          type,
          affectedFilings
        },
        severity === 'critical' ? 'critical' : 'high'
      );
    }

    return issue;
  }

  /**
   * Resolve compliance issue
   */
  async resolveComplianceIssue(issueId: string, resolution: string, resolvedBy?: string): Promise<void> {
    const issue = this.complianceIssues.get(issueId);
    
    if (!issue) {
      throw new Error('Compliance issue not found');
    }

    issue.resolvedAt = new Date();
    issue.resolution = resolution;
    if (resolvedBy) {
      issue.assignedTo = resolvedBy;
    }

    await this.persistComplianceIssue(issue);

    // Send resolution notification
    await this.sendImmediateNotification(
      issue.businessId,
      'compliance_issue',
      `Compliance Issue Resolved: ${issue.title}`,
      `Issue has been resolved: ${resolution}`,
      {
        issueId: issue.id,
        originalSeverity: issue.severity,
        resolution
      },
      'medium'
    );
  }

  /**
   * Get notifications for a business
   */
  async getNotifications(
    businessId: string,
    filters?: {
      type?: NotificationConfig['type'];
      status?: Notification['status'];
      priority?: NotificationChannel['priority'];
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ notifications: Notification[]; total: number }> {
    // This would query the database in a real implementation
    let notifications = Array.from(this.pendingNotifications).filter(n => n.businessId === businessId);

    if (filters) {
      if (filters.type) {
        notifications = notifications.filter(n => n.type === filters.type);
      }
      if (filters.status) {
        notifications = notifications.filter(n => n.status === filters.status);
      }
      if (filters.priority) {
        notifications = notifications.filter(n => n.priority === filters.priority);
      }
      if (filters.unreadOnly) {
        notifications = notifications.filter(n => !n.readAt);
      }
    }

    const total = notifications.length;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    notifications = notifications
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);

    return { notifications, total };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.pendingNotifications.find(n => n.id === notificationId);
    
    if (notification && !notification.readAt) {
      notification.readAt = new Date();
      notification.updatedAt = new Date();
      await this.persistNotification(notification);
    }
  }

  /**
   * Get deadline alerts for a business
   */
  async getDeadlineAlerts(businessId: string, includeResolved: boolean = false): Promise<DeadlineAlert[]> {
    return Array.from(this.deadlineAlerts.values())
      .filter(alert => {
        if (alert.businessId !== businessId) return false;
        if (!includeResolved && alert.isOverdue && alert.hasBeenNotified) return false;
        return true;
      })
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  /**
   * Get compliance issues for a business
   */
  async getComplianceIssues(
    businessId: string,
    filters?: {
      severity?: ComplianceIssue['severity'];
      type?: ComplianceIssue['type'];
      resolved?: boolean;
    }
  ): Promise<ComplianceIssue[]> {
    return Array.from(this.complianceIssues.values())
      .filter(issue => {
        if (issue.businessId !== businessId) return false;
        if (filters?.severity && issue.severity !== filters.severity) return false;
        if (filters?.type && issue.type !== filters.type) return false;
        if (filters?.resolved !== undefined) {
          const isResolved = !!issue.resolvedAt;
          if (filters.resolved !== isResolved) return false;
        }
        return true;
      })
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  // Private methods

  private async processNotification(notification: Notification): Promise<void> {
    const config = Array.from(this.configs.values()).find(
      c => c.businessId === notification.businessId && c.type === notification.type
    );

    if (!config) {
      notification.status = 'failed';
      notification.updatedAt = new Date();
      return;
    }

    for (const channel of config.channels.filter(c => c.isActive)) {
      const attempt: NotificationAttempt = {
        id: `attempt_${Date.now()}_${Math.random()}`,
        channel: channel.type,
        attemptedAt: new Date(),
        status: 'failed'
      };

      try {
        switch (channel.type) {
          case 'email':
            await this.sendEmail(notification, channel);
            break;
          case 'sms':
            await this.sendSMS(notification, channel);
            break;
          case 'push':
            await this.sendPush(notification, channel);
            break;
          case 'webhook':
            await this.sendWebhook(notification, channel);
            break;
          case 'in_app':
            // In-app notifications are stored and displayed in UI
            break;
        }
        
        attempt.status = 'success';
      } catch (error) {
        attempt.status = 'failed';
        attempt.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      }

      notification.attempts.push(attempt);
    }

    notification.status = notification.attempts.some(a => a.status === 'success') ? 'sent' : 'failed';
    notification.sentAt = new Date();
    notification.updatedAt = new Date();

    await this.persistNotification(notification);
  }

  private async scheduleDeadlineNotification(alert: DeadlineAlert): Promise<void> {
    const message = alert.isOverdue 
      ? `OVERDUE: ${alert.filingType} filing for ${alert.jurisdiction} was due ${Math.abs(alert.daysUntilDue)} days ago.`
      : `REMINDER: ${alert.filingType} filing for ${alert.jurisdiction} is due in ${alert.daysUntilDue} days.`;

    await this.scheduleNotification(
      alert.businessId,
      'filing_deadline',
      {
        alertId: alert.id,
        jurisdiction: alert.jurisdiction,
        filingType: alert.filingType,
        dueDate: alert.dueDate.toISOString(),
        daysUntilDue: alert.daysUntilDue,
        isOverdue: alert.isOverdue,
        estimatedAmount: alert.estimatedAmount
      },
      new Date(),
      alert.alertLevel === 'critical' ? 'critical' : 'high'
    );

    alert.hasBeenNotified = true;
    alert.lastNotificationAt = new Date();
    await this.persistDeadlineAlert(alert);
  }

  private renderTemplate(template: NotificationTemplate, data: Record<string, any>): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.body;

    // Replace variables in template
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), String(value));
      body = body.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return { subject, body };
  }

  private async sendEmail(notification: Notification, channel: NotificationChannel): Promise<void> {
    // Mock email sending
    console.log(`Sending email notification: ${notification.title}`);
    console.log(`Recipients: ${channel.config.email?.recipients.join(', ')}`);
  }

  private async sendSMS(notification: Notification, channel: NotificationChannel): Promise<void> {
    // Mock SMS sending
    console.log(`Sending SMS notification: ${notification.message}`);
    console.log(`Phone numbers: ${channel.config.sms?.phoneNumbers.join(', ')}`);
  }

  private async sendPush(notification: Notification, channel: NotificationChannel): Promise<void> {
    // Mock push notification
    console.log(`Sending push notification: ${notification.title}`);
  }

  private async sendWebhook(notification: Notification, channel: NotificationChannel): Promise<void> {
    // Mock webhook call
    console.log(`Sending webhook notification to: ${channel.config.webhook?.url}`);
  }

  private async persistConfig(config: NotificationConfig): Promise<void> {
    // Persist to database
  }

  private async persistNotification(notification: Notification): Promise<void> {
    // Persist to database
  }

  private async persistDeadlineAlert(alert: DeadlineAlert): Promise<void> {
    // Persist to database
  }

  private async persistComplianceIssue(issue: ComplianceIssue): Promise<void> {
    // Persist to database
  }

  private initializeDefaultTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        id: 'filing_deadline_template',
        name: 'Filing Deadline Reminder',
        subject: 'Filing Deadline: {{filingType}} for {{jurisdiction}}',
        body: `Your {{filingType}} filing for {{jurisdiction}} is due {{#if isOverdue}}{{daysUntilDue}} days ago{{else}}in {{daysUntilDue}} days{{/if}}.
        
Due Date: {{dueDate}}
{{#if estimatedAmount}}Estimated Amount: ${{estimatedAmount}}{{/if}}

Please ensure your filing is completed on time to avoid penalties.`,
        variables: {
          filingType: 'Type of filing',
          jurisdiction: 'Tax jurisdiction',
          daysUntilDue: 'Days until due date',
          dueDate: 'Due date',
          isOverdue: 'Whether filing is overdue',
          estimatedAmount: 'Estimated tax amount'
        }
      },
      {
        id: 'filing_submitted_template',
        name: 'Filing Submitted Confirmation',
        subject: 'Filing Submitted: {{filingType}} for {{jurisdiction}}',
        body: `Your {{filingType}} filing for {{jurisdiction}} has been successfully submitted.

Confirmation Number: {{confirmationNumber}}
Submission Date: {{submissionDate}}
Total Amount: ${{totalAmount}}

You will receive an update once the filing is processed by the tax authority.`,
        variables: {
          filingType: 'Type of filing',
          jurisdiction: 'Tax jurisdiction',
          confirmationNumber: 'Government confirmation number',
          submissionDate: 'Date of submission',
          totalAmount: 'Total tax amount'
        }
      },
      {
        id: 'compliance_issue_template',
        name: 'Compliance Issue Alert',
        subject: 'Compliance Issue: {{title}}',
        body: `A compliance issue has been detected for your account.

Issue: {{title}}
Severity: {{severity}}
Description: {{description}}

{{#if affectedFilings}}Affected Filings: {{affectedFilings}}{{/if}}

Please review and address this issue promptly to maintain compliance.`,
        variables: {
          title: 'Issue title',
          severity: 'Issue severity',
          description: 'Issue description',
          affectedFilings: 'List of affected filings'
        }
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  private startNotificationProcessor(): void {
    // Process pending notifications every minute
    setInterval(async () => {
      if (this.isProcessing || this.pendingNotifications.length === 0) {
        return;
      }

      this.isProcessing = true;
      
      try {
        const now = new Date();
        const notificationsToProcess = this.pendingNotifications.filter(
          n => n.status === 'pending' && n.scheduledFor <= now
        );

        for (const notification of notificationsToProcess) {
          await this.processNotification(notification);
          
          // Remove from pending list
          const index = this.pendingNotifications.indexOf(notification);
          if (index > -1) {
            this.pendingNotifications.splice(index, 1);
          }
        }
      } catch (error) {
        console.error('Error processing notifications:', error);
      } finally {
        this.isProcessing = false;
      }
    }, 60000);
  }

  private startDeadlineMonitor(): void {
    // Check for upcoming deadlines every hour
    setInterval(async () => {
      try {
        // This would query the database for upcoming filings
        // For now, we'll just check existing alerts
        const now = new Date();
        
        for (const alert of this.deadlineAlerts.values()) {
          const daysUntilDue = Math.ceil((alert.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          // Update alert status
          alert.daysUntilDue = daysUntilDue;
          alert.isOverdue = daysUntilDue < 0;
          
          // Determine if we need to send notifications
          const shouldNotify = 
            (!alert.hasBeenNotified && (daysUntilDue <= 7 || alert.isOverdue)) ||
            (alert.isOverdue && alert.lastNotificationAt && 
             (now.getTime() - alert.lastNotificationAt.getTime()) > 24 * 60 * 60 * 1000); // Daily reminders for overdue
          
          if (shouldNotify) {
            await this.scheduleDeadlineNotification(alert);
          }
        }
      } catch (error) {
        console.error('Error monitoring deadlines:', error);
      }
    }, 60 * 60 * 1000);
  }
}

// Global service instance
export const notificationService = new NotificationService();
