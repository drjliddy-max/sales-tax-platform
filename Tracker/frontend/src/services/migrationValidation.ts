import { apiService } from './api';
import { MigrationPlan, BatchMigrationConfig } from '@/utils/tenantMigration';

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'data_integrity' | 'tenant_isolation' | 'performance' | 'compliance';
}

export interface ValidationResult {
  ruleId: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
  affectedItems?: string[];
  recommendation?: string;
}

export interface IntegrityCheckResult {
  overall: 'passed' | 'failed' | 'warnings';
  score: number;
  executionTime: number;
  results: ValidationResult[];
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  recommendations: string[];
}

export interface DataIntegrityReport {
  tenantId: string;
  reportId: string;
  generatedAt: string;
  checks: {
    referentialIntegrity: {
      passed: boolean;
      orphanedRecords: number;
      brokenReferences: string[];
    };
    dataConsistency: {
      passed: boolean;
      inconsistencies: string[];
      duplicateRecords: number;
    };
    tenantIsolation: {
      passed: boolean;
      crossTenantReferences: string[];
      missingTenantIds: number;
    };
    businessRules: {
      passed: boolean;
      violations: string[];
      invalidTransactions: number;
    };
  };
  recommendations: string[];
  nextCheckDate: string;
}

export class MigrationValidationService {
  private static instance: MigrationValidationService;

  public static getInstance(): MigrationValidationService {
    if (!MigrationValidationService.instance) {
      MigrationValidationService.instance = new MigrationValidationService();
    }
    return MigrationValidationService.instance;
  }

  async validateMigrationPlan(plan: MigrationPlan): Promise<IntegrityCheckResult> {
    try {
      const response = await apiService.post<IntegrityCheckResult>('/migration/validate-plan', plan);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to validate migration plan');
    } catch (error) {
      console.error('Error validating migration plan:', error);
      return this.createFailedValidationResult('Migration plan validation failed');
    }
  }

  async validateTenantData(tenantId: string): Promise<DataIntegrityReport> {
    try {
      const response = await apiService.get<DataIntegrityReport>(`/migration/validate-tenant/${tenantId}`);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to validate tenant data');
    } catch (error) {
      console.error('Error validating tenant data:', error);
      throw error;
    }
  }

  async validateDataIntegrity(tenantId?: string): Promise<IntegrityCheckResult> {
    try {
      const endpoint = tenantId 
        ? `/migration/validate-integrity/${tenantId}`
        : '/migration/validate-integrity';
      
      const response = await apiService.get<IntegrityCheckResult>(endpoint);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to validate data integrity');
    } catch (error) {
      console.error('Error validating data integrity:', error);
      return this.createFailedValidationResult('Data integrity validation failed');
    }
  }

  async validateTenantIsolation(): Promise<IntegrityCheckResult> {
    try {
      const response = await apiService.get<IntegrityCheckResult>('/migration/validate-isolation');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to validate tenant isolation');
    } catch (error) {
      console.error('Error validating tenant isolation:', error);
      return this.createFailedValidationResult('Tenant isolation validation failed');
    }
  }

  async validateBatchMigration(config: BatchMigrationConfig): Promise<IntegrityCheckResult> {
    try {
      const response = await apiService.post<IntegrityCheckResult>('/migration/validate-batch', config);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to validate batch migration');
    } catch (error) {
      console.error('Error validating batch migration:', error);
      return this.createFailedValidationResult('Batch migration validation failed');
    }
  }

  async validatePostMigration(tenantId: string): Promise<IntegrityCheckResult> {
    try {
      const response = await apiService.post<IntegrityCheckResult>('/migration/validate-post-migration', {
        tenantId,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to validate post-migration state');
    } catch (error) {
      console.error('Error validating post-migration:', error);
      return this.createFailedValidationResult('Post-migration validation failed');
    }
  }

  async getValidationRules(): Promise<ValidationRule[]> {
    try {
      const response = await apiService.get<ValidationRule[]>('/migration/validation-rules');
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error fetching validation rules:', error);
      return [];
    }
  }

  async runCustomValidation(
    tenantId: string, 
    ruleIds: string[]
  ): Promise<IntegrityCheckResult> {
    try {
      const response = await apiService.post<IntegrityCheckResult>('/migration/validate-custom', {
        tenantId,
        ruleIds,
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to run custom validation');
    } catch (error) {
      console.error('Error running custom validation:', error);
      return this.createFailedValidationResult('Custom validation failed');
    }
  }

  async checkReferentialIntegrity(tenantId: string): Promise<{
    passed: boolean;
    orphanedRecords: Array<{
      table: string;
      count: number;
      sampleIds: string[];
    }>;
    brokenReferences: Array<{
      table: string;
      field: string;
      count: number;
      sampleIds: string[];
    }>;
  }> {
    try {
      const response = await apiService.get(`/migration/check-referential-integrity/${tenantId}`);
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'passed' in response.data &&
          'orphanedRecords' in response.data &&
          'brokenReferences' in response.data) {
        return response.data as {
          passed: boolean;
          orphanedRecords: Array<{
            table: string;
            count: number;
            sampleIds: string[];
          }>;
          brokenReferences: Array<{
            table: string;
            field: string;
            count: number;
            sampleIds: string[];
          }>;
        };
      }
      return {
        passed: false,
        orphanedRecords: [],
        brokenReferences: [],
      };
    } catch (error) {
      console.error('Error checking referential integrity:', error);
      return {
        passed: false,
        orphanedRecords: [],
        brokenReferences: [],
      };
    }
  }

  async fixIntegrityIssues(
    tenantId: string, 
    options: {
      fixOrphanedRecords: boolean;
      fixBrokenReferences: boolean;
      createMissingRecords: boolean;
      deleteInvalidRecords: boolean;
    }
  ): Promise<{
    success: boolean;
    fixed: {
      orphanedRecords: number;
      brokenReferences: number;
      createdRecords: number;
      deletedRecords: number;
    };
    errors: string[];
  }> {
    try {
      const response = await apiService.post(`/migration/fix-integrity/${tenantId}`, options);
      if (response.success && response.data && 
          typeof response.data === 'object' && 
          'success' in response.data &&
          'fixed' in response.data &&
          'errors' in response.data) {
        return response.data as {
          success: boolean;
          fixed: {
            orphanedRecords: number;
            brokenReferences: number;
            createdRecords: number;
            deletedRecords: number;
          };
          errors: string[];
        };
      }
      return {
        success: false,
        fixed: {
          orphanedRecords: 0,
          brokenReferences: 0,
          createdRecords: 0,
          deletedRecords: 0,
        },
        errors: ['Failed to fix integrity issues'],
      };
    } catch (error) {
      console.error('Error fixing integrity issues:', error);
      return {
        success: false,
        fixed: {
          orphanedRecords: 0,
          brokenReferences: 0,
          createdRecords: 0,
          deletedRecords: 0,
        },
        errors: ['Failed to fix integrity issues'],
      };
    }
  }

  async scheduleIntegrityCheck(
    tenantId: string,
    schedule: {
      cronExpression: string;
      autoFix: boolean;
      notifyOnIssues: boolean;
      emailNotifications: string[];
    }
  ): Promise<boolean> {
    try {
      const response = await apiService.post('/migration/schedule-integrity-check', {
        tenantId,
        ...schedule,
      });
      return response.success;
    } catch (error) {
      console.error('Error scheduling integrity check:', error);
      return false;
    }
  }

  private createFailedValidationResult(message: string): IntegrityCheckResult {
    return {
      overall: 'failed',
      score: 0,
      executionTime: 0,
      results: [{
        ruleId: 'system_error',
        passed: false,
        severity: 'error',
        message,
      }],
      summary: {
        totalChecks: 1,
        passed: 0,
        failed: 1,
        warnings: 0,
      },
      recommendations: ['Check system connectivity and try again'],
    };
  }
}

export const migrationValidationService = MigrationValidationService.getInstance();

// Utility functions for common validation scenarios
export async function performPreMigrationValidation(plan: MigrationPlan): Promise<{
  canProceed: boolean;
  issues: ValidationResult[];
  warnings: ValidationResult[];
}> {
  const validation = await migrationValidationService.validateMigrationPlan(plan);
  
  const errors = validation.results.filter(r => r.severity === 'error' && !r.passed);
  const warnings = validation.results.filter(r => r.severity === 'warning' && !r.passed);
  
  return {
    canProceed: errors.length === 0,
    issues: errors,
    warnings,
  };
}

export async function performPostMigrationValidation(tenantId: string): Promise<{
  migrationSuccessful: boolean;
  dataIntegrityScore: number;
  criticalIssues: ValidationResult[];
  recommendations: string[];
}> {
  const validation = await migrationValidationService.validatePostMigration(tenantId);
  
  const criticalIssues = validation.results.filter(r => 
    r.severity === 'error' && !r.passed
  );
  
  return {
    migrationSuccessful: validation.overall !== 'failed' && criticalIssues.length === 0,
    dataIntegrityScore: validation.score,
    criticalIssues,
    recommendations: validation.recommendations,
  };
}

export async function generateIntegrityReport(tenantId: string): Promise<DataIntegrityReport> {
  return await migrationValidationService.validateTenantData(tenantId);
}