import { apiService } from './api';
import { MigrationPlan, BatchMigrationConfig, MigrationProgress } from '@/utils/tenantMigration';
import { BackupConfig } from './backupRestore';

export interface ScheduledMigration {
  id: string;
  name: string;
  description?: string;
  type: 'backup' | 'migration' | 'validation' | 'cleanup';
  schedule: {
    cronExpression: string;
    timezone: string;
    enabled: boolean;
  };
  config: BackupConfig | MigrationPlan | BatchMigrationConfig | any;
  lastRun?: {
    timestamp: string;
    status: 'success' | 'failed' | 'running';
    duration: number;
    result?: any;
    error?: string;
  };
  nextRun: string;
  retentionDays: number;
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    recipients: string[];
  };
  createdAt: string;
  createdBy: string;
  tenantId: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'schedule' | 'event' | 'threshold' | 'manual';
    condition: string;
    parameters: Record<string, any>;
  };
  actions: Array<{
    type: 'backup' | 'validate' | 'cleanup' | 'notify' | 'migrate';
    config: any;
    order: number;
  }>;
  enabled: boolean;
  tenantId: string;
  lastTriggered?: string;
  executionHistory: Array<{
    timestamp: string;
    status: 'success' | 'failed';
    duration: number;
    actionsExecuted: number;
    error?: string;
  }>;
}

export interface SchedulerStats {
  totalSchedules: number;
  activeSchedules: number;
  failedLastRun: number;
  upcomingRuns: Array<{
    scheduleId: string;
    name: string;
    nextRun: string;
    type: string;
  }>;
  recentExecutions: Array<{
    scheduleId: string;
    name: string;
    status: 'success' | 'failed' | 'running';
    timestamp: string;
    duration?: number;
  }>;
}

export class MigrationSchedulerService {
  private static instance: MigrationSchedulerService;

  public static getInstance(): MigrationSchedulerService {
    if (!MigrationSchedulerService.instance) {
      MigrationSchedulerService.instance = new MigrationSchedulerService();
    }
    return MigrationSchedulerService.instance;
  }

  async createScheduledMigration(schedule: Omit<ScheduledMigration, 'id' | 'createdAt' | 'createdBy'>): Promise<ScheduledMigration> {
    try {
      const response = await apiService.post<ScheduledMigration>('/migration/schedule', schedule);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to create scheduled migration');
    } catch (error) {
      console.error('Error creating scheduled migration:', error);
      throw error;
    }
  }

  async getScheduledMigrations(tenantId: string): Promise<ScheduledMigration[]> {
    try {
      const response = await apiService.get<ScheduledMigration[]>(`/migration/schedules/${tenantId}`);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching scheduled migrations:', error);
      return [];
    }
  }

  async updateScheduledMigration(
    scheduleId: string, 
    updates: Partial<ScheduledMigration>
  ): Promise<ScheduledMigration> {
    try {
      const response = await apiService.put<ScheduledMigration>(`/migration/schedule/${scheduleId}`, updates);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to update scheduled migration');
    } catch (error) {
      console.error('Error updating scheduled migration:', error);
      throw error;
    }
  }

  async deleteScheduledMigration(scheduleId: string): Promise<boolean> {
    try {
      const response = await apiService.delete(`/migration/schedule/${scheduleId}`);
      return response.success;
    } catch (error) {
      console.error('Error deleting scheduled migration:', error);
      return false;
    }
  }

  async triggerScheduledMigration(scheduleId: string): Promise<MigrationProgress> {
    try {
      const response = await apiService.post<MigrationProgress>(`/migration/schedule/${scheduleId}/trigger`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to trigger scheduled migration');
    } catch (error) {
      console.error('Error triggering scheduled migration:', error);
      throw error;
    }
  }

  async pauseSchedule(scheduleId: string): Promise<boolean> {
    try {
      const response = await apiService.post(`/migration/schedule/${scheduleId}/pause`);
      return response.success;
    } catch (error) {
      console.error('Error pausing schedule:', error);
      return false;
    }
  }

  async resumeSchedule(scheduleId: string): Promise<boolean> {
    try {
      const response = await apiService.post(`/migration/schedule/${scheduleId}/resume`);
      return response.success;
    } catch (error) {
      console.error('Error resuming schedule:', error);
      return false;
    }
  }

  async getSchedulerStats(tenantId?: string): Promise<SchedulerStats> {
    try {
      const endpoint = tenantId 
        ? `/migration/scheduler/stats/${tenantId}`
        : '/migration/scheduler/stats';
      
      const response = await apiService.get<SchedulerStats>(endpoint);
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.error('Error fetching scheduler stats:', error);
    }

    return {
      totalSchedules: 0,
      activeSchedules: 0,
      failedLastRun: 0,
      upcomingRuns: [],
      recentExecutions: [],
    };
  }

  async createAutomationRule(rule: Omit<AutomationRule, 'id' | 'executionHistory'>): Promise<AutomationRule> {
    try {
      const response = await apiService.post<AutomationRule>('/migration/automation/rules', rule);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to create automation rule');
    } catch (error) {
      console.error('Error creating automation rule:', error);
      throw error;
    }
  }

  async getAutomationRules(tenantId: string): Promise<AutomationRule[]> {
    try {
      const response = await apiService.get<AutomationRule[]>(`/migration/automation/rules/${tenantId}`);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching automation rules:', error);
      return [];
    }
  }

  async updateAutomationRule(ruleId: string, updates: Partial<AutomationRule>): Promise<AutomationRule> {
    try {
      const response = await apiService.put<AutomationRule>(`/migration/automation/rules/${ruleId}`, updates);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to update automation rule');
    } catch (error) {
      console.error('Error updating automation rule:', error);
      throw error;
    }
  }

  async deleteAutomationRule(ruleId: string): Promise<boolean> {
    try {
      const response = await apiService.delete(`/migration/automation/rules/${ruleId}`);
      return response.success;
    } catch (error) {
      console.error('Error deleting automation rule:', error);
      return false;
    }
  }

  async triggerAutomationRule(ruleId: string): Promise<boolean> {
    try {
      const response = await apiService.post(`/migration/automation/rules/${ruleId}/trigger`);
      return response.success;
    } catch (error) {
      console.error('Error triggering automation rule:', error);
      return false;
    }
  }

  // Health monitoring for scheduled tasks
  async getScheduleHealth(): Promise<{
    overall: 'healthy' | 'warning' | 'critical';
    issues: Array<{
      scheduleId: string;
      name: string;
      issue: string;
      severity: 'warning' | 'critical';
      lastOccurred: string;
    }>;
    performance: {
      averageExecutionTime: number;
      successRate: number;
      totalExecutions: number;
    };
  }> {
    try {
      const response = await apiService.get('/migration/scheduler/health');
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'overall' in response.data &&
          'issues' in response.data &&
          'performance' in response.data) {
        return response.data as {
          overall: 'healthy' | 'warning' | 'critical';
          issues: Array<{
            scheduleId: string;
            name: string;
            issue: string;
            severity: 'warning' | 'critical';
            lastOccurred: string;
          }>;
          performance: {
            averageExecutionTime: number;
            successRate: number;
            totalExecutions: number;
          };
        };
      }
      return {
        overall: 'critical' as const,
        issues: [],
        performance: {
          averageExecutionTime: 0,
          successRate: 0,
          totalExecutions: 0,
        },
      };
    } catch (error) {
      console.error('Error fetching schedule health:', error);
      return {
        overall: 'critical',
        issues: [],
        performance: {
          averageExecutionTime: 0,
          successRate: 0,
          totalExecutions: 0,
        },
      };
    }
  }
}

export const migrationSchedulerService = MigrationSchedulerService.getInstance();

// Utility functions for common scheduling scenarios
export async function createDailyBackupSchedule(
  tenantId: string,
  backupConfig: BackupConfig,
  notificationEmails: string[] = []
): Promise<ScheduledMigration> {
  const schedule: Omit<ScheduledMigration, 'id' | 'createdAt' | 'createdBy'> = {
    name: 'Daily Tenant Backup',
    description: 'Automated daily backup of all tenant data',
    type: 'backup',
    schedule: {
      cronExpression: '0 2 * * *', // 2 AM daily
      timezone: 'UTC',
      enabled: true,
    },
    config: backupConfig,
    nextRun: '', // Will be calculated by server
    retentionDays: 30,
    notifications: {
      onSuccess: false,
      onFailure: true,
      recipients: notificationEmails,
    },
    tenantId,
  };

  return await migrationSchedulerService.createScheduledMigration(schedule);
}

export async function createWeeklyValidationSchedule(
  tenantId: string,
  notificationEmails: string[] = []
): Promise<ScheduledMigration> {
  const schedule: Omit<ScheduledMigration, 'id' | 'createdAt' | 'createdBy'> = {
    name: 'Weekly Data Validation',
    description: 'Weekly integrity and validation checks',
    type: 'validation',
    schedule: {
      cronExpression: '0 3 * * 0', // 3 AM on Sundays
      timezone: 'UTC',
      enabled: true,
    },
    config: {
      includeIntegrityCheck: true,
      includeTenantIsolation: true,
      autoFixMinorIssues: false,
      generateReport: true,
    },
    nextRun: '',
    retentionDays: 90,
    notifications: {
      onSuccess: true,
      onFailure: true,
      recipients: notificationEmails,
    },
    tenantId,
  };

  return await migrationSchedulerService.createScheduledMigration(schedule);
}

export async function createMonthlyCleanupSchedule(
  tenantId: string,
  notificationEmails: string[] = []
): Promise<ScheduledMigration> {
  const schedule: Omit<ScheduledMigration, 'id' | 'createdAt' | 'createdBy'> = {
    name: 'Monthly Data Cleanup',
    description: 'Monthly cleanup of orphaned and expired data',
    type: 'cleanup',
    schedule: {
      cronExpression: '0 1 1 * *', // 1 AM on first day of month
      timezone: 'UTC',
      enabled: true,
    },
    config: {
      removeOrphanedRecords: true,
      cleanupExpiredSessions: true,
      archiveOldReports: true,
      monthsToKeep: 12,
    },
    nextRun: '',
    retentionDays: 365,
    notifications: {
      onSuccess: true,
      onFailure: true,
      recipients: notificationEmails,
    },
    tenantId,
  };

  return await migrationSchedulerService.createScheduledMigration(schedule);
}