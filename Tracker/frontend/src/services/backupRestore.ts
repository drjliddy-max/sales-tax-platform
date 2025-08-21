import { apiService } from './api';

export interface BackupConfig {
  includeBusinesses: boolean;
  includeTransactions: boolean;
  includeReports: boolean;
  includePOSConnections: boolean;
  includeSettings: boolean;
  includeUsers: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  compression: boolean;
  encryption: boolean;
  format: 'json' | 'csv' | 'sql';
}

export interface BackupMetadata {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  size: number;
  recordCounts: {
    businesses: number;
    transactions: number;
    reports: number;
    posConnections: number;
    users: number;
  };
  config: BackupConfig;
  status: 'creating' | 'completed' | 'failed' | 'expired';
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  downloadUrl?: string;
  checksum: string;
}

export interface RestoreConfig {
  backupId: string;
  targetTenantId: string;
  restoreBusinesses: boolean;
  restoreTransactions: boolean;
  restoreReports: boolean;
  restorePOSConnections: boolean;
  restoreSettings: boolean;
  restoreUsers: boolean;
  mergeStrategy: 'replace' | 'merge' | 'skip_existing';
  validateBeforeRestore: boolean;
  createRestorePoint: boolean;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  details?: {
    businessesRestored: number;
    transactionsRestored: number;
    reportsRestored: number;
    posConnectionsRestored: number;
    usersRestored: number;
    conflicts: string[];
    warnings: string[];
  };
  restorePointId?: string;
}

export class BackupRestoreService {
  private static instance: BackupRestoreService;

  public static getInstance(): BackupRestoreService {
    if (!BackupRestoreService.instance) {
      BackupRestoreService.instance = new BackupRestoreService();
    }
    return BackupRestoreService.instance;
  }

  async createBackup(tenantId: string, config: BackupConfig, name: string, description?: string): Promise<BackupMetadata> {
    try {
      const response = await apiService.post<BackupMetadata>('/backup/create', {
        tenantId,
        config,
        name,
        description,
      });
      
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to create backup');
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  async getBackups(tenantId: string): Promise<BackupMetadata[]> {
    try {
      const response = await apiService.get<BackupMetadata[]>(`/backup/list/${tenantId}`);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching backups:', error);
      return [];
    }
  }

  async getBackupStatus(backupId: string): Promise<BackupMetadata> {
    try {
      const response = await apiService.get<BackupMetadata>(`/backup/status/${backupId}`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to get backup status');
    } catch (error) {
      console.error('Error getting backup status:', error);
      throw error;
    }
  }

  async downloadBackup(backupId: string): Promise<Blob> {
    try {
      const response = await fetch(`/api/backup/download/${backupId}`, {
        headers: {
          'Authorization': `Bearer ${await import('./auth').then(m => m.authService.getToken())}`,
          'X-Tenant-ID': localStorage.getItem('selectedTenantId') || '',
        },
      });
      
      if (response.ok) {
        return await response.blob();
      }
      throw new Error('Failed to download backup');
    } catch (error) {
      console.error('Error downloading backup:', error);
      throw error;
    }
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      const response = await apiService.delete(`/backup/${backupId}`);
      return response.success;
    } catch (error) {
      console.error('Error deleting backup:', error);
      return false;
    }
  }

  async validateBackup(backupId: string): Promise<{
    isValid: boolean;
    issues: string[];
    checksum: string;
    metadata: BackupMetadata;
  }> {
    try {
      const response = await apiService.post(`/backup/${backupId}/validate`);
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'isValid' in response.data &&
          'issues' in response.data &&
          'checksum' in response.data &&
          'metadata' in response.data) {
        return response.data as {
          isValid: boolean;
          issues: string[];
          checksum: string;
          metadata: BackupMetadata;
        };
      }
      return {
        isValid: false,
        issues: ['Validation request failed'],
        checksum: '',
        metadata: {} as BackupMetadata,
      };
    } catch (error) {
      console.error('Error validating backup:', error);
    }

    return {
      isValid: false,
      issues: ['Validation failed'],
      checksum: '',
      metadata: {} as BackupMetadata,
    };
  }

  async restoreFromBackup(config: RestoreConfig): Promise<RestoreResult> {
    try {
      const response = await apiService.post<RestoreResult>('/backup/restore', config);
      return response.data || {
        success: false,
        message: 'Restore failed - no response data',
      };
    } catch (error) {
      console.error('Error restoring from backup:', error);
      return {
        success: false,
        message: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async scheduleBackup(tenantId: string, schedule: {
    name: string;
    config: BackupConfig;
    cronExpression: string;
    retentionDays: number;
    isActive: boolean;
  }): Promise<boolean> {
    try {
      const response = await apiService.post('/backup/schedule', {
        tenantId,
        ...schedule,
      });
      return response.success;
    } catch (error) {
      console.error('Error scheduling backup:', error);
      return false;
    }
  }

  async getScheduledBackups(tenantId: string): Promise<any[]> {
    try {
      const response = await apiService.get(`/backup/schedules/${tenantId}`);
      if (response.success && response.data && Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching scheduled backups:', error);
      return [];
    }
  }

  async createRestorePoint(tenantId: string, description: string): Promise<string> {
    try {
      const response = await apiService.post<{ restorePointId: string }>('/backup/restore-point', {
        tenantId,
        description,
      });
      
      if (response.success && response.data) {
        return response.data.restorePointId;
      }
      throw new Error('Failed to create restore point');
    } catch (error) {
      console.error('Error creating restore point:', error);
      throw error;
    }
  }

  async listRestorePoints(tenantId: string): Promise<BackupMetadata[]> {
    try {
      const response = await apiService.get<BackupMetadata[]>(`/backup/restore-points/${tenantId}`);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching restore points:', error);
      return [];
    }
  }
}

export const backupRestoreService = BackupRestoreService.getInstance();

// Utility functions for common backup scenarios
export async function createFullTenantBackup(tenantId: string, name: string): Promise<BackupMetadata> {
  const config: BackupConfig = {
    includeBusinesses: true,
    includeTransactions: true,
    includeReports: true,
    includePOSConnections: true,
    includeSettings: true,
    includeUsers: true,
    compression: true,
    encryption: true,
    format: 'json',
  };

  return await backupRestoreService.createBackup(tenantId, config, name, 'Full tenant backup');
}

export async function createDataOnlyBackup(tenantId: string, name: string): Promise<BackupMetadata> {
  const config: BackupConfig = {
    includeBusinesses: true,
    includeTransactions: true,
    includeReports: true,
    includePOSConnections: false,
    includeSettings: false,
    includeUsers: false,
    compression: true,
    encryption: true,
    format: 'json',
  };

  return await backupRestoreService.createBackup(tenantId, config, name, 'Data-only backup');
}

export async function createConfigBackup(tenantId: string, name: string): Promise<BackupMetadata> {
  const config: BackupConfig = {
    includeBusinesses: false,
    includeTransactions: false,
    includeReports: false,
    includePOSConnections: true,
    includeSettings: true,
    includeUsers: true,
    compression: true,
    encryption: false,
    format: 'json',
  };

  return await backupRestoreService.createBackup(tenantId, config, name, 'Configuration backup');
}