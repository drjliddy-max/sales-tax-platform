import prisma from '@/lib/prisma';
import { logger } from '@/utils/Logger';

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
  stages: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: string;
    endTime?: string;
    errors?: string[];
  }>;
  estimatedTimeRemaining?: number;
  startTime: string;
  endTime?: string;
}

export class MigrationService {
  async getSystemStatus() {
    try {
      // Check if system is already multi-tenant
      const tenantCount = await prisma.tenant.count();
      const businessCount = await prisma.business.count();
      const businessesWithTenant = await prisma.business.count({
        where: { tenantId: { not: null } }
      });

      const transactionCount = await prisma.transaction.count();
      const transactionsWithTenant = await prisma.transaction.count({
        where: { tenantId: { not: null } }
      });

      const activeMigrations = await prisma.migration.count({
        where: { status: { in: ['preparing', 'running', 'paused'] } }
      });

      return {
        isMultiTenant: tenantCount > 0,
        migrationInProgress: activeMigrations > 0,
        lastMigrationDate: await this.getLastMigrationDate(),
        stats: {
          totalTenants: tenantCount,
          totalBusinesses: businessCount,
          totalTransactions: transactionCount,
          businessesWithTenant: businessesWithTenant,
          transactionsWithTenant: transactionsWithTenant,
          migrationProgress: businessCount > 0 ? (businessesWithTenant / businessCount) * 100 : 100
        }
      };
    } catch (error) {
      logger.error('Error getting system status:', error);
      throw error;
    }
  }

  async analyzeSystem() {
    try {
      const businessCount = await prisma.business.count();
      const transactionCount = await prisma.transaction.count();
      const reportCount = await prisma.report.count();
      const posIntegrationCount = await prisma.posIntegration.count();

      // Get sample data for mapping suggestions
      const businesses = await prisma.business.findMany({
        take: 10,
        select: { id: true, name: true, ownerId: true, industry: true }
      });

      // Analyze potential tenant groupings
      const ownerGroups = await prisma.business.groupBy({
        by: ['ownerId'],
        _count: { id: true },
        having: { id: { _count: { gt: 0 } } }
      });

      return {
        defaultTenantName: 'Default Organization',
        defaultTenantSlug: 'default-org',
        assignAllToDefaultTenant: true,
        preserveExistingData: true,
        businessToTenantMapping: {},
        analysis: {
          totalRecords: {
            businesses: businessCount,
            transactions: transactionCount,
            reports: reportCount,
            posIntegrations: posIntegrationCount
          },
          ownerGroups: ownerGroups.length,
          suggestedBatchSize: Math.min(Math.max(Math.ceil(businessCount / 10), 50), 500),
          estimatedDuration: this.estimateMigrationDuration(businessCount, transactionCount),
          recommendations: this.generateMigrationRecommendations(businessCount, transactionCount)
        }
      };
    } catch (error) {
      logger.error('Error analyzing system:', error);
      throw error;
    }
  }

  async executeMigration(plan: MigrationPlan, userId: string): Promise<MigrationResult> {
    const migrationId = await this.createMigrationRecord(plan, userId);
    
    try {
      logger.info(`Starting migration ${migrationId} with plan:`, plan);

      if (plan.dryRun) {
        return this.executeDryRun(plan, migrationId);
      }

      // Create backup if requested
      if (plan.createBackup) {
        await this.createPreMigrationBackup();
      }

      // Create default tenant
      const tenant = await this.createDefaultTenant(plan, userId);
      
      // Migrate data in batches
      const result = await this.migrateDataInBatches(tenant.id, plan, migrationId);

      await this.updateMigrationRecord(migrationId, 'completed', result);
      
      logger.info(`Migration ${migrationId} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`Migration ${migrationId} failed:`, error);
      await this.updateMigrationRecord(migrationId, 'failed', null, error.message);
      throw error;
    }
  }

  async startBatchMigration(config: BatchMigrationConfig, userId: string): Promise<MigrationProgress> {
    const migrationId = await this.createBatchMigrationRecord(config, userId);
    
    try {
      // Start background migration process
      this.processBatchMigration(migrationId, config).catch(error => {
        logger.error(`Batch migration ${migrationId} failed:`, error);
        this.updateMigrationRecord(migrationId, 'failed', null, error.message);
      });

      return this.getMigrationProgress(migrationId);
    } catch (error) {
      logger.error('Error starting batch migration:', error);
      throw error;
    }
  }

  async getMigrationProgress(migrationId: string): Promise<MigrationProgress | null> {
    try {
      const migration = await prisma.migration.findUnique({
        where: { id: migrationId }
      });

      if (!migration) {
        return null;
      }

      return {
        migrationId: migration.id,
        status: migration.status as any,
        progress: migration.progress as any || { current: 0, total: 100, percentage: 0 },
        stages: [],
        startTime: migration.startedAt?.toISOString() || migration.createdAt.toISOString(),
        endTime: migration.completedAt?.toISOString()
      };
    } catch (error) {
      logger.error('Error getting migration progress:', error);
      throw error;
    }
  }

  async pauseMigration(migrationId: string): Promise<boolean> {
    try {
      await prisma.migration.update({
        where: { id: migrationId },
        data: { status: 'paused' }
      });
      return true;
    } catch (error) {
      logger.error('Error pausing migration:', error);
      return false;
    }
  }

  async resumeMigration(migrationId: string): Promise<boolean> {
    try {
      await prisma.migration.update({
        where: { id: migrationId },
        data: { status: 'running' }
      });
      return true;
    } catch (error) {
      logger.error('Error resuming migration:', error);
      return false;
    }
  }

  async cancelMigration(migrationId: string): Promise<boolean> {
    try {
      await prisma.migration.update({
        where: { id: migrationId },
        data: { 
          status: 'failed',
          errorMessage: 'Migration cancelled by user',
          completedAt: new Date()
        }
      });
      return true;
    } catch (error) {
      logger.error('Error cancelling migration:', error);
      return false;
    }
  }

  async rollbackMigration(userId: string): Promise<MigrationResult> {
    try {
      logger.info('Starting migration rollback');

      // This is a simplified rollback - in production you'd want more sophisticated logic
      const tenantsToRemove = await prisma.tenant.findMany({
        where: { ownerId: userId },
        include: { businesses: true, transactions: true }
      });

      let businessesReverted = 0;
      let transactionsReverted = 0;

      for (const tenant of tenantsToRemove) {
        // Reset tenant references
        await prisma.business.updateMany({
          where: { tenantId: tenant.id },
          data: { tenantId: null }
        });

        await prisma.transaction.updateMany({
          where: { tenantId: tenant.id },
          data: { tenantId: null }
        });

        businessesReverted += tenant.businesses.length;
        transactionsReverted += tenant.transactions.length;

        // Remove tenant and tenant users
        await prisma.tenantUser.deleteMany({
          where: { tenantId: tenant.id }
        });

        await prisma.tenant.delete({
          where: { id: tenant.id }
        });
      }

      logger.info('Migration rollback completed');

      return {
        success: true,
        message: 'Migration rollback completed successfully',
        details: {
          tenantsCreated: 0,
          businessesMigrated: businessesReverted,
          transactionsMigrated: transactionsReverted,
          usersMigrated: 0,
          errors: []
        }
      };
    } catch (error) {
      logger.error('Error rolling back migration:', error);
      throw error;
    }
  }

  async validateMigrationReadiness() {
    try {
      const issues = [];
      const recommendations = [];

      // Check for orphaned records
      const orphanedBusinesses = await prisma.business.count({
        where: { owner: null }
      });

      if (orphanedBusinesses > 0) {
        issues.push(`${orphanedBusinesses} businesses have no owner`);
        recommendations.push('Clean up orphaned business records before migration');
      }

      // Check for data consistency
      const transactionsWithoutBusiness = await prisma.transaction.count({
        where: { business: null }
      });

      if (transactionsWithoutBusiness > 0) {
        issues.push(`${transactionsWithoutBusiness} transactions have no associated business`);
        recommendations.push('Fix transaction-business relationships');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error) {
      logger.error('Error validating migration readiness:', error);
      throw error;
    }
  }

  async cleanupOrphanedData() {
    try {
      const deletedBusinesses = await prisma.business.deleteMany({
        where: { ownerId: null }
      });

      const deletedTransactions = await prisma.transaction.deleteMany({
        where: { businessId: null }
      });

      const deletedReports = await prisma.report.deleteMany({
        where: { businessId: null }
      });

      return {
        success: true,
        cleaned: {
          businesses: deletedBusinesses.count,
          transactions: deletedTransactions.count,
          reports: deletedReports.count
        }
      };
    } catch (error) {
      logger.error('Error cleaning up orphaned data:', error);
      throw error;
    }
  }

  async batchMigrateResources(
    fromTenantId: string,
    toTenantId: string,
    resourceType: string,
    resourceIds: string[],
    userId: string
  ): Promise<MigrationResult> {
    try {
      let updated = 0;
      const errors = [];

      switch (resourceType) {
        case 'businesses':
          const businessUpdate = await prisma.business.updateMany({
            where: { 
              id: { in: resourceIds },
              tenantId: fromTenantId
            },
            data: { tenantId: toTenantId }
          });
          updated = businessUpdate.count;
          break;

        case 'transactions':
          const transactionUpdate = await prisma.transaction.updateMany({
            where: { 
              id: { in: resourceIds },
              tenantId: fromTenantId
            },
            data: { tenantId: toTenantId }
          });
          updated = transactionUpdate.count;
          break;

        default:
          throw new Error(`Unsupported resource type: ${resourceType}`);
      }

      return {
        success: true,
        message: `Successfully migrated ${updated} ${resourceType}`,
        details: {
          tenantsCreated: 0,
          businessesMigrated: resourceType === 'businesses' ? updated : 0,
          transactionsMigrated: resourceType === 'transactions' ? updated : 0,
          usersMigrated: 0,
          errors
        }
      };
    } catch (error) {
      logger.error('Error in batch resource migration:', error);
      throw error;
    }
  }

  // Private helper methods
  private async createMigrationRecord(plan: MigrationPlan, userId: string): Promise<string> {
    const migration = await prisma.migration.create({
      data: {
        type: 'full_migration',
        status: 'preparing',
        config: plan as any,
        createdBy: userId,
        startedAt: new Date()
      }
    });
    return migration.id;
  }

  private async createBatchMigrationRecord(config: BatchMigrationConfig, userId: string): Promise<string> {
    const migration = await prisma.migration.create({
      data: {
        type: 'batch_migration',
        status: 'preparing',
        config: config as any,
        createdBy: userId,
        startedAt: new Date(),
        tenantId: config.tenantId
      }
    });
    return migration.id;
  }

  private async updateMigrationRecord(
    migrationId: string,
    status: string,
    result?: any,
    error?: string
  ): Promise<void> {
    await prisma.migration.update({
      where: { id: migrationId },
      data: {
        status,
        result: result as any,
        errorMessage: error,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
      }
    });
  }

  private async createDefaultTenant(plan: MigrationPlan, userId: string) {
    return await prisma.tenant.create({
      data: {
        name: plan.defaultTenantName,
        slug: plan.defaultTenantSlug,
        ownerId: userId,
        plan: 'professional',
        status: 'active',
        settings: {},
        billing: {},
        limits: {}
      }
    });
  }

  private async migrateDataInBatches(
    tenantId: string,
    plan: MigrationPlan,
    migrationId: string
  ): Promise<MigrationResult> {
    const batchSize = plan.batchSize || 100;
    let businessesMigrated = 0;
    let transactionsMigrated = 0;
    const errors = [];

    try {
      // Migrate businesses in batches
      let offset = 0;
      let batch = await prisma.business.findMany({
        take: batchSize,
        skip: offset,
        where: { tenantId: null }
      });

      while (batch.length > 0) {
        await prisma.business.updateMany({
          where: { id: { in: batch.map(b => b.id) } },
          data: { tenantId }
        });

        businessesMigrated += batch.length;
        offset += batchSize;

        batch = await prisma.business.findMany({
          take: batchSize,
          skip: offset,
          where: { tenantId: null }
        });
      }

      // Migrate transactions
      offset = 0;
      let transactionBatch = await prisma.transaction.findMany({
        take: batchSize,
        skip: offset,
        where: { tenantId: null }
      });

      while (transactionBatch.length > 0) {
        await prisma.transaction.updateMany({
          where: { id: { in: transactionBatch.map(t => t.id) } },
          data: { tenantId }
        });

        transactionsMigrated += transactionBatch.length;
        offset += batchSize;

        transactionBatch = await prisma.transaction.findMany({
          take: batchSize,
          skip: offset,
          where: { tenantId: null }
        });
      }

      return {
        success: true,
        message: 'Migration completed successfully',
        details: {
          tenantsCreated: 1,
          businessesMigrated,
          transactionsMigrated,
          usersMigrated: 1, // The owner
          errors
        }
      };
    } catch (error) {
      errors.push(error.message);
      throw error;
    }
  }

  private async processBatchMigration(migrationId: string, config: BatchMigrationConfig): Promise<void> {
    // This would be implemented as a background job
    // For now, just update the migration status
    setTimeout(async () => {
      await this.updateMigrationRecord(migrationId, 'completed', {
        resourcesMigrated: config.resourceIds.length
      });
    }, 5000);
  }

  private async createPreMigrationBackup(): Promise<void> {
    // Implementation would create a full backup
    logger.info('Creating pre-migration backup...');
  }

  private async executeDryRun(plan: MigrationPlan, migrationId: string): Promise<MigrationResult> {
    // Simulate the migration without actually changing data
    const businessCount = await prisma.business.count({ where: { tenantId: null } });
    const transactionCount = await prisma.transaction.count({ where: { tenantId: null } });

    await this.updateMigrationRecord(migrationId, 'completed', null);

    return {
      success: true,
      message: 'Dry run completed successfully',
      details: {
        tenantsCreated: 1,
        businessesMigrated: businessCount,
        transactionsMigrated: transactionCount,
        usersMigrated: 1,
        errors: []
      }
    };
  }

  private async getLastMigrationDate(): Promise<string | undefined> {
    const lastMigration = await prisma.migration.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    return lastMigration?.completedAt?.toISOString();
  }

  private estimateMigrationDuration(businessCount: number, transactionCount: number): number {
    // Estimate in minutes based on record count
    const recordsPerMinute = 1000;
    const totalRecords = businessCount + transactionCount;
    return Math.ceil(totalRecords / recordsPerMinute);
  }

  private generateMigrationRecommendations(businessCount: number, transactionCount: number): string[] {
    const recommendations = [];

    if (businessCount > 10000) {
      recommendations.push('Consider using smaller batch sizes due to large business count');
    }

    if (transactionCount > 100000) {
      recommendations.push('Schedule migration during low-traffic hours due to large transaction count');
    }

    recommendations.push('Create a backup before starting migration');
    recommendations.push('Test migration in staging environment first');

    return recommendations;
  }
}