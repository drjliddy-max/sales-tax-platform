import { apiService } from '@/services/api';
import { Tenant, CreateTenantRequest } from '@/types/tenant';

export interface MigrationResult {
  success: boolean;
  message: string;
  details?: {
    tenantsCreated: number;
    businessesMigrated: number;
    transactionsMigrated: number;
    usersMigrated: number;
    errors: string[];
  };
}

export interface MigrationPlan {
  defaultTenantName: string;
  defaultTenantSlug: string;
  assignAllToDefaultTenant: boolean;
  businessToTenantMapping?: Record<string, string>;
  preserveExistingData: boolean;
  batchSize?: number;
  enableProgressTracking?: boolean;
  createBackup?: boolean;
  dryRun?: boolean;
}

export interface BatchMigrationConfig {
  tenantId: string;
  resourceType: 'businesses' | 'transactions' | 'reports' | 'pos_connections';
  resourceIds: string[];
  batchSize: number;
  preserveRelationships: boolean;
}

export interface MigrationProgress {
  migrationId: string;
  status: 'preparing' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  stages: {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: string;
    endTime?: string;
    errors?: string[];
  }[];
  estimatedTimeRemaining?: number;
  startTime: string;
  endTime?: string;
}

export class TenantMigrationService {
  private static instance: TenantMigrationService;

  public static getInstance(): TenantMigrationService {
    if (!TenantMigrationService.instance) {
      TenantMigrationService.instance = new TenantMigrationService();
    }
    return TenantMigrationService.instance;
  }

  async createMigrationPlan(): Promise<MigrationPlan> {
    try {
      const response = await apiService.get<MigrationPlan>('/migration/analyze');
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.error('Error creating migration plan:', error);
    }

    return {
      defaultTenantName: 'Default Organization',
      defaultTenantSlug: 'default-org',
      assignAllToDefaultTenant: true,
      preserveExistingData: true,
    };
  }

  async executeMigration(plan: MigrationPlan): Promise<MigrationResult> {
    try {
      const response = await apiService.post<MigrationResult>('/migration/execute', plan);
      return response.data || {
        success: false,
        message: 'Migration failed - no response data',
      };
    } catch (error) {
      console.error('Error executing migration:', error);
      return {
        success: false,
        message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async validateMigration(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const response = await apiService.get<{
        isValid: boolean;
        issues: string[];
        recommendations: string[];
      }>('/migration/validate');
      
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.error('Error validating migration:', error);
    }

    return {
      isValid: false,
      issues: ['Unable to validate migration'],
      recommendations: ['Check server connection and try again'],
    };
  }

  async rollbackMigration(): Promise<MigrationResult> {
    try {
      const response = await apiService.post<MigrationResult>('/migration/rollback');
      return response.data || {
        success: false,
        message: 'Rollback failed - no response data',
      };
    } catch (error) {
      console.error('Error rolling back migration:', error);
      return {
        success: false,
        message: `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async getMigrationStatus(): Promise<{
    isMultiTenant: boolean;
    migrationInProgress: boolean;
    lastMigrationDate?: string;
    stats: {
      totalTenants: number;
      totalBusinesses: number;
      totalTransactions: number;
      orphanedRecords: number;
    };
  }> {
    try {
      const response = await apiService.get('/migration/status');
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'isMultiTenant' in response.data &&
          'migrationInProgress' in response.data &&
          'stats' in response.data) {
        return response.data as {
          isMultiTenant: boolean;
          migrationInProgress: boolean;
          lastMigrationDate?: string;
          stats: {
            totalTenants: number;
            totalBusinesses: number;
            totalTransactions: number;
            orphanedRecords: number;
          };
        };
      }
      return {
        isMultiTenant: false,
        migrationInProgress: false,
        stats: {
          totalTenants: 0,
          totalBusinesses: 0,
          totalTransactions: 0,
          orphanedRecords: 0,
        },
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        isMultiTenant: false,
        migrationInProgress: false,
        stats: {
          totalTenants: 0,
          totalBusinesses: 0,
          totalTransactions: 0,
          orphanedRecords: 0,
        },
      };
    }
  }

  async createDefaultTenant(ownerId: string): Promise<Tenant | null> {
    const defaultTenantData: CreateTenantRequest = {
      name: 'Default Organization',
      slug: 'default-org',
      plan: 'professional',
      timezone: 'UTC',
      currency: 'USD',
      locale: 'en-US',
      ownerId,
      settings: {
        features: {
          advancedAnalytics: true,
          multiLocationSupport: true,
          apiAccess: true,
          customReporting: true,
          prioritySupport: false,
          ssoEnabled: false,
          auditLogging: true,
          dataRetentionYears: 7,
        },
        integrations: {
          maxPOSConnections: 10,
          allowedPOSTypes: ['square', 'shopify', 'clover', 'toast'],
          webhooksEnabled: true,
          thirdPartyIntegrations: [],
        },
        compliance: {
          requireApprovalForReports: false,
          enableAuditTrail: true,
          dataResidencyRegion: 'us',
          encryptionLevel: 'standard',
        },
        branding: {
          allowCustomLogo: true,
          allowCustomColors: true,
          allowCustomDomain: false,
        },
      },
    };

    try {
      const response = await apiService.post<Tenant>('/tenants', defaultTenantData);
      if (response.success && response.data) {
        return response.data;
      }
    } catch (error) {
      console.error('Error creating default tenant:', error);
    }

    return null;
  }

  async assignUserToTenant(userId: string, tenantId: string, role: string = 'user'): Promise<boolean> {
    try {
      const response = await apiService.post(`/tenants/${tenantId}/users`, {
        userId,
        role,
      });
      return response.success;
    } catch (error) {
      console.error('Error assigning user to tenant:', error);
      return false;
    }
  }

  async migrateBusinessesToTenant(businessIds: string[], tenantId: string): Promise<boolean> {
    try {
      const response = await apiService.post('/migration/migrate-businesses', {
        businessIds,
        tenantId,
      });
      return response.success;
    } catch (error) {
      console.error('Error migrating businesses:', error);
      return false;
    }
  }

  async cleanupOrphanedData(): Promise<{
    success: boolean;
    cleaned: {
      businesses: number;
      transactions: number;
      reports: number;
    };
  }> {
    try {
      const response = await apiService.post('/migration/cleanup-orphaned');
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'success' in response.data &&
          'cleaned' in response.data) {
        return response.data as {
          success: boolean;
          cleaned: {
            businesses: number;
            transactions: number;
            reports: number;
          };
        };
      }
      return {
        success: false,
        cleaned: {
          businesses: 0,
          transactions: 0,
          reports: 0,
        },
      };
    } catch (error) {
      console.error('Error cleaning up orphaned data:', error);
      return {
        success: false,
        cleaned: {
          businesses: 0,
          transactions: 0,
          reports: 0,
        },
      };
    }
  }

  // Batch Migration Methods
  async startBatchMigration(config: BatchMigrationConfig): Promise<MigrationProgress> {
    try {
      const response = await apiService.post<MigrationProgress>('/migration/batch/start', config);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to start batch migration');
    } catch (error) {
      console.error('Error starting batch migration:', error);
      throw error;
    }
  }

  async getMigrationProgress(migrationId: string): Promise<MigrationProgress> {
    try {
      const response = await apiService.get<MigrationProgress>(`/migration/progress/${migrationId}`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to get migration progress');
    } catch (error) {
      console.error('Error getting migration progress:', error);
      throw error;
    }
  }

  async pauseMigration(migrationId: string): Promise<boolean> {
    try {
      const response = await apiService.post(`/migration/${migrationId}/pause`);
      return response.success;
    } catch (error) {
      console.error('Error pausing migration:', error);
      return false;
    }
  }

  async resumeMigration(migrationId: string): Promise<boolean> {
    try {
      const response = await apiService.post(`/migration/${migrationId}/resume`);
      return response.success;
    } catch (error) {
      console.error('Error resuming migration:', error);
      return false;
    }
  }

  async cancelMigration(migrationId: string): Promise<boolean> {
    try {
      const response = await apiService.post(`/migration/${migrationId}/cancel`);
      return response.success;
    } catch (error) {
      console.error('Error canceling migration:', error);
      return false;
    }
  }

  async migrateResourceBatch(
    fromTenantId: string, 
    toTenantId: string, 
    resourceType: string, 
    resourceIds: string[]
  ): Promise<MigrationResult> {
    try {
      const response = await apiService.post<MigrationResult>('/migration/resources/batch', {
        fromTenantId,
        toTenantId,
        resourceType,
        resourceIds,
      });
      return response.data || {
        success: false,
        message: 'Batch migration failed - no response data',
      };
    } catch (error) {
      console.error('Error in batch resource migration:', error);
      return {
        success: false,
        message: `Batch migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export const migrationService = TenantMigrationService.getInstance();

export async function autoMigrateSingleTenant(ownerId: string): Promise<MigrationResult> {
  const migrationService = TenantMigrationService.getInstance();
  
  try {
    const defaultTenant = await migrationService.createDefaultTenant(ownerId);
    if (!defaultTenant) {
      return {
        success: false,
        message: 'Failed to create default tenant',
      };
    }

    const plan: MigrationPlan = {
      defaultTenantName: defaultTenant.name,
      defaultTenantSlug: defaultTenant.slug,
      assignAllToDefaultTenant: true,
      preserveExistingData: true,
    };

    return await migrationService.executeMigration(plan);
  } catch (error) {
    return {
      success: false,
      message: `Auto-migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}