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
export declare class MigrationService {
    getSystemStatus(): Promise<{
        isMultiTenant: boolean;
        migrationInProgress: boolean;
        lastMigrationDate: string | undefined;
        stats: {
            totalTenants: any;
            totalBusinesses: number;
            totalTransactions: number;
            businessesWithTenant: number;
            transactionsWithTenant: number;
            migrationProgress: number;
        };
    }>;
    analyzeSystem(): Promise<{
        defaultTenantName: string;
        defaultTenantSlug: string;
        assignAllToDefaultTenant: boolean;
        preserveExistingData: boolean;
        businessToTenantMapping: {};
        analysis: {
            totalRecords: {
                businesses: number;
                transactions: number;
                reports: number;
                posIntegrations: number;
            };
            ownerGroups: number;
            suggestedBatchSize: number;
            estimatedDuration: number;
            recommendations: string[];
        };
    }>;
    executeMigration(plan: MigrationPlan, userId: string): Promise<MigrationResult>;
    startBatchMigration(config: BatchMigrationConfig, userId: string): Promise<MigrationProgress>;
    getMigrationProgress(migrationId: string): Promise<MigrationProgress | null>;
    pauseMigration(migrationId: string): Promise<boolean>;
    resumeMigration(migrationId: string): Promise<boolean>;
    cancelMigration(migrationId: string): Promise<boolean>;
    rollbackMigration(userId: string): Promise<MigrationResult>;
    validateMigrationReadiness(): Promise<{
        isValid: boolean;
        issues: string[];
        recommendations: string[];
    }>;
    cleanupOrphanedData(): Promise<{
        success: boolean;
        cleaned: {
            businesses: number;
            transactions: number;
            reports: number;
        };
    }>;
    batchMigrateResources(fromTenantId: string, toTenantId: string, resourceType: string, resourceIds: string[], userId: string): Promise<MigrationResult>;
    private createMigrationRecord;
    private createBatchMigrationRecord;
    private updateMigrationRecord;
    private createDefaultTenant;
    private migrateDataInBatches;
    private processBatchMigration;
    private createPreMigrationBackup;
    private executeDryRun;
    private getLastMigrationDate;
    private estimateMigrationDuration;
    private generateMigrationRecommendations;
}
//# sourceMappingURL=MigrationService.d.ts.map