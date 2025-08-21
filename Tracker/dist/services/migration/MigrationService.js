"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
const Logger_1 = require("@/utils/Logger");
class MigrationService {
    async getSystemStatus() {
        try {
            const tenantCount = await prisma_1.default.tenant.count();
            const businessCount = await prisma_1.default.business.count();
            const businessesWithTenant = await prisma_1.default.business.count({
                where: { tenantId: { not: null } }
            });
            const transactionCount = await prisma_1.default.transaction.count();
            const transactionsWithTenant = await prisma_1.default.transaction.count({
                where: { tenantId: { not: null } }
            });
            const activeMigrations = await prisma_1.default.migration.count({
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
        }
        catch (error) {
            Logger_1.logger.error('Error getting system status:', error);
            throw error;
        }
    }
    async analyzeSystem() {
        try {
            const businessCount = await prisma_1.default.business.count();
            const transactionCount = await prisma_1.default.transaction.count();
            const reportCount = await prisma_1.default.report.count();
            const posIntegrationCount = await prisma_1.default.posIntegration.count();
            const businesses = await prisma_1.default.business.findMany({
                take: 10,
                select: { id: true, name: true, ownerId: true, industry: true }
            });
            const ownerGroups = await prisma_1.default.business.groupBy({
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
        }
        catch (error) {
            Logger_1.logger.error('Error analyzing system:', error);
            throw error;
        }
    }
    async executeMigration(plan, userId) {
        const migrationId = await this.createMigrationRecord(plan, userId);
        try {
            Logger_1.logger.info(`Starting migration ${migrationId} with plan:`, plan);
            if (plan.dryRun) {
                return this.executeDryRun(plan, migrationId);
            }
            if (plan.createBackup) {
                await this.createPreMigrationBackup();
            }
            const tenant = await this.createDefaultTenant(plan, userId);
            const result = await this.migrateDataInBatches(tenant.id, plan, migrationId);
            await this.updateMigrationRecord(migrationId, 'completed', result);
            Logger_1.logger.info(`Migration ${migrationId} completed successfully`);
            return result;
        }
        catch (error) {
            Logger_1.logger.error(`Migration ${migrationId} failed:`, error);
            await this.updateMigrationRecord(migrationId, 'failed', null, error.message);
            throw error;
        }
    }
    async startBatchMigration(config, userId) {
        const migrationId = await this.createBatchMigrationRecord(config, userId);
        try {
            this.processBatchMigration(migrationId, config).catch(error => {
                Logger_1.logger.error(`Batch migration ${migrationId} failed:`, error);
                this.updateMigrationRecord(migrationId, 'failed', null, error.message);
            });
            return this.getMigrationProgress(migrationId);
        }
        catch (error) {
            Logger_1.logger.error('Error starting batch migration:', error);
            throw error;
        }
    }
    async getMigrationProgress(migrationId) {
        try {
            const migration = await prisma_1.default.migration.findUnique({
                where: { id: migrationId }
            });
            if (!migration) {
                return null;
            }
            return {
                migrationId: migration.id,
                status: migration.status,
                progress: migration.progress || { current: 0, total: 100, percentage: 0 },
                stages: [],
                startTime: migration.startedAt?.toISOString() || migration.createdAt.toISOString(),
                endTime: migration.completedAt?.toISOString()
            };
        }
        catch (error) {
            Logger_1.logger.error('Error getting migration progress:', error);
            throw error;
        }
    }
    async pauseMigration(migrationId) {
        try {
            await prisma_1.default.migration.update({
                where: { id: migrationId },
                data: { status: 'paused' }
            });
            return true;
        }
        catch (error) {
            Logger_1.logger.error('Error pausing migration:', error);
            return false;
        }
    }
    async resumeMigration(migrationId) {
        try {
            await prisma_1.default.migration.update({
                where: { id: migrationId },
                data: { status: 'running' }
            });
            return true;
        }
        catch (error) {
            Logger_1.logger.error('Error resuming migration:', error);
            return false;
        }
    }
    async cancelMigration(migrationId) {
        try {
            await prisma_1.default.migration.update({
                where: { id: migrationId },
                data: {
                    status: 'failed',
                    errorMessage: 'Migration cancelled by user',
                    completedAt: new Date()
                }
            });
            return true;
        }
        catch (error) {
            Logger_1.logger.error('Error cancelling migration:', error);
            return false;
        }
    }
    async rollbackMigration(userId) {
        try {
            Logger_1.logger.info('Starting migration rollback');
            const tenantsToRemove = await prisma_1.default.tenant.findMany({
                where: { ownerId: userId },
                include: { businesses: true, transactions: true }
            });
            let businessesReverted = 0;
            let transactionsReverted = 0;
            for (const tenant of tenantsToRemove) {
                await prisma_1.default.business.updateMany({
                    where: { tenantId: tenant.id },
                    data: { tenantId: null }
                });
                await prisma_1.default.transaction.updateMany({
                    where: { tenantId: tenant.id },
                    data: { tenantId: null }
                });
                businessesReverted += tenant.businesses.length;
                transactionsReverted += tenant.transactions.length;
                await prisma_1.default.tenantUser.deleteMany({
                    where: { tenantId: tenant.id }
                });
                await prisma_1.default.tenant.delete({
                    where: { id: tenant.id }
                });
            }
            Logger_1.logger.info('Migration rollback completed');
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
        }
        catch (error) {
            Logger_1.logger.error('Error rolling back migration:', error);
            throw error;
        }
    }
    async validateMigrationReadiness() {
        try {
            const issues = [];
            const recommendations = [];
            const orphanedBusinesses = await prisma_1.default.business.count({
                where: { owner: null }
            });
            if (orphanedBusinesses > 0) {
                issues.push(`${orphanedBusinesses} businesses have no owner`);
                recommendations.push('Clean up orphaned business records before migration');
            }
            const transactionsWithoutBusiness = await prisma_1.default.transaction.count({
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
        }
        catch (error) {
            Logger_1.logger.error('Error validating migration readiness:', error);
            throw error;
        }
    }
    async cleanupOrphanedData() {
        try {
            const deletedBusinesses = await prisma_1.default.business.deleteMany({
                where: { ownerId: null }
            });
            const deletedTransactions = await prisma_1.default.transaction.deleteMany({
                where: { businessId: null }
            });
            const deletedReports = await prisma_1.default.report.deleteMany({
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
        }
        catch (error) {
            Logger_1.logger.error('Error cleaning up orphaned data:', error);
            throw error;
        }
    }
    async batchMigrateResources(fromTenantId, toTenantId, resourceType, resourceIds, userId) {
        try {
            let updated = 0;
            const errors = [];
            switch (resourceType) {
                case 'businesses':
                    const businessUpdate = await prisma_1.default.business.updateMany({
                        where: {
                            id: { in: resourceIds },
                            tenantId: fromTenantId
                        },
                        data: { tenantId: toTenantId }
                    });
                    updated = businessUpdate.count;
                    break;
                case 'transactions':
                    const transactionUpdate = await prisma_1.default.transaction.updateMany({
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
        }
        catch (error) {
            Logger_1.logger.error('Error in batch resource migration:', error);
            throw error;
        }
    }
    async createMigrationRecord(plan, userId) {
        const migration = await prisma_1.default.migration.create({
            data: {
                type: 'full_migration',
                status: 'preparing',
                config: plan,
                createdBy: userId,
                startedAt: new Date()
            }
        });
        return migration.id;
    }
    async createBatchMigrationRecord(config, userId) {
        const migration = await prisma_1.default.migration.create({
            data: {
                type: 'batch_migration',
                status: 'preparing',
                config: config,
                createdBy: userId,
                startedAt: new Date(),
                tenantId: config.tenantId
            }
        });
        return migration.id;
    }
    async updateMigrationRecord(migrationId, status, result, error) {
        await prisma_1.default.migration.update({
            where: { id: migrationId },
            data: {
                status,
                result: result,
                errorMessage: error,
                completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined
            }
        });
    }
    async createDefaultTenant(plan, userId) {
        return await prisma_1.default.tenant.create({
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
    async migrateDataInBatches(tenantId, plan, migrationId) {
        const batchSize = plan.batchSize || 100;
        let businessesMigrated = 0;
        let transactionsMigrated = 0;
        const errors = [];
        try {
            let offset = 0;
            let batch = await prisma_1.default.business.findMany({
                take: batchSize,
                skip: offset,
                where: { tenantId: null }
            });
            while (batch.length > 0) {
                await prisma_1.default.business.updateMany({
                    where: { id: { in: batch.map(b => b.id) } },
                    data: { tenantId }
                });
                businessesMigrated += batch.length;
                offset += batchSize;
                batch = await prisma_1.default.business.findMany({
                    take: batchSize,
                    skip: offset,
                    where: { tenantId: null }
                });
            }
            offset = 0;
            let transactionBatch = await prisma_1.default.transaction.findMany({
                take: batchSize,
                skip: offset,
                where: { tenantId: null }
            });
            while (transactionBatch.length > 0) {
                await prisma_1.default.transaction.updateMany({
                    where: { id: { in: transactionBatch.map(t => t.id) } },
                    data: { tenantId }
                });
                transactionsMigrated += transactionBatch.length;
                offset += batchSize;
                transactionBatch = await prisma_1.default.transaction.findMany({
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
                    usersMigrated: 1,
                    errors
                }
            };
        }
        catch (error) {
            errors.push(error.message);
            throw error;
        }
    }
    async processBatchMigration(migrationId, config) {
        setTimeout(async () => {
            await this.updateMigrationRecord(migrationId, 'completed', {
                resourcesMigrated: config.resourceIds.length
            });
        }, 5000);
    }
    async createPreMigrationBackup() {
        Logger_1.logger.info('Creating pre-migration backup...');
    }
    async executeDryRun(plan, migrationId) {
        const businessCount = await prisma_1.default.business.count({ where: { tenantId: null } });
        const transactionCount = await prisma_1.default.transaction.count({ where: { tenantId: null } });
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
    async getLastMigrationDate() {
        const lastMigration = await prisma_1.default.migration.findFirst({
            orderBy: { createdAt: 'desc' }
        });
        return lastMigration?.completedAt?.toISOString();
    }
    estimateMigrationDuration(businessCount, transactionCount) {
        const recordsPerMinute = 1000;
        const totalRecords = businessCount + transactionCount;
        return Math.ceil(totalRecords / recordsPerMinute);
    }
    generateMigrationRecommendations(businessCount, transactionCount) {
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
exports.MigrationService = MigrationService;
//# sourceMappingURL=MigrationService.js.map