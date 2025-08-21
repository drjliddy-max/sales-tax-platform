import React, { useState, useEffect } from 'react';
import { migrationService, MigrationResult, MigrationPlan } from '@/utils/tenantMigration';

interface TenantMigrationDashboardProps {
  className?: string;
}

export function TenantMigrationDashboard({ className = '' }: TenantMigrationDashboardProps) {
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [migrationPlan, setMigrationPlan] = useState<MigrationPlan | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'plan' | 'execute' | 'cleanup'>('status');

  useEffect(() => {
    loadMigrationData();
  }, []);

  const loadMigrationData = async () => {
    setLoading(true);
    try {
      const [status, plan, validation] = await Promise.all([
        migrationService.getMigrationStatus(),
        migrationService.createMigrationPlan(),
        migrationService.validateMigration(),
      ]);
      
      setMigrationStatus(status);
      setMigrationPlan(plan);
      setValidationResult(validation);
    } catch (error) {
      console.error('Error loading migration data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteMigration = async () => {
    if (!migrationPlan) return;

    setMigrating(true);
    try {
      const result = await migrationService.executeMigration(migrationPlan);
      
      if (result.success) {
        await loadMigrationData();
        alert('Migration completed successfully!');
      } else {
        alert(`Migration failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Migration error:', error);
      alert('Migration failed due to an unexpected error');
    } finally {
      setMigrating(false);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback the migration? This will revert all changes.')) {
      return;
    }

    setMigrating(true);
    try {
      const result = await migrationService.rollbackMigration();
      
      if (result.success) {
        await loadMigrationData();
        alert('Rollback completed successfully!');
      } else {
        alert(`Rollback failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Rollback error:', error);
      alert('Rollback failed due to an unexpected error');
    } finally {
      setMigrating(false);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('Are you sure you want to clean up orphaned data? This action cannot be undone.')) {
      return;
    }

    try {
      const result = await migrationService.cleanupOrphanedData();
      if (result.success) {
        alert(`Cleanup completed! Cleaned: ${result.cleaned.businesses} businesses, ${result.cleaned.transactions} transactions, ${result.cleaned.reports} reports`);
        await loadMigrationData();
      } else {
        alert('Cleanup failed');
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      alert('Cleanup failed due to an unexpected error');
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'status', label: 'Status', icon: '📊' },
    { id: 'plan', label: 'Migration Plan', icon: '📋' },
    { id: 'execute', label: 'Execute', icon: '🚀' },
    { id: 'cleanup', label: 'Cleanup', icon: '🧹' },
  ] as const;

  return (
    <div className={`max-w-6xl mx-auto py-6 px-4 ${className}`}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tenant Migration Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage the migration from single-tenant to multi-tenant architecture</p>
      </div>

      {/* Status Alert */}
      {migrationStatus && (
        <div className={`p-4 rounded-lg mb-6 ${
          migrationStatus.isMultiTenant 
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
        }`}>
          <p className="font-medium">
            {migrationStatus.isMultiTenant 
              ? '✅ Multi-tenant architecture is active'
              : '⚠️ Single-tenant architecture detected - migration required'
            }
          </p>
          {migrationStatus.migrationInProgress && (
            <p className="text-sm mt-1">Migration is currently in progress...</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'status' && migrationStatus && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Migration Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{migrationStatus.stats.totalTenants}</p>
                  <p className="text-sm text-gray-600">Total Tenants</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{migrationStatus.stats.totalBusinesses}</p>
                  <p className="text-sm text-gray-600">Total Businesses</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-2xl font-bold text-purple-600">{migrationStatus.stats.totalTransactions}</p>
                  <p className="text-sm text-gray-600">Total Transactions</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{migrationStatus.stats.orphanedRecords}</p>
                  <p className="text-sm text-gray-600">Orphaned Records</p>
                </div>
              </div>
            </div>

            {validationResult && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Validation Results</h3>
                <div className={`p-4 rounded-lg ${
                  validationResult.isValid 
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <p className={`font-medium ${
                    validationResult.isValid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {validationResult.isValid ? '✅ Ready for migration' : '❌ Issues found'}
                  </p>
                  
                  {validationResult.issues.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-800">Issues:</p>
                      <ul className="text-sm text-red-700 mt-1 space-y-1">
                        {validationResult.issues.map((issue: string, index: number) => (
                          <li key={index}>• {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {validationResult.recommendations.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-blue-800">Recommendations:</p>
                      <ul className="text-sm text-blue-700 mt-1 space-y-1">
                        {validationResult.recommendations.map((rec: string, index: number) => (
                          <li key={index}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plan' && migrationPlan && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Migration Plan</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Tenant Name</label>
                  <input
                    type="text"
                    value={migrationPlan.defaultTenantName}
                    onChange={(e) => setMigrationPlan({ 
                      ...migrationPlan, 
                      defaultTenantName: e.target.value 
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Default Tenant Slug</label>
                  <input
                    type="text"
                    value={migrationPlan.defaultTenantSlug}
                    onChange={(e) => setMigrationPlan({ 
                      ...migrationPlan, 
                      defaultTenantSlug: e.target.value 
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="assignAll"
                    checked={migrationPlan.assignAllToDefaultTenant}
                    onChange={(e) => setMigrationPlan({ 
                      ...migrationPlan, 
                      assignAllToDefaultTenant: e.target.checked 
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="assignAll" className="ml-2 text-sm text-gray-700">
                    Assign all existing data to default tenant
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="preserveData"
                    checked={migrationPlan.preserveExistingData}
                    onChange={(e) => setMigrationPlan({ 
                      ...migrationPlan, 
                      preserveExistingData: e.target.checked 
                    })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="preserveData" className="ml-2 text-sm text-gray-700">
                    Preserve existing data during migration
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'execute' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Execute Migration</h3>
              
              {!migrationStatus?.isMultiTenant ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800">Migration Required</h4>
                    <p className="text-yellow-700 text-sm mt-1">
                      Your system is currently using single-tenant architecture. 
                      Click the button below to migrate to multi-tenant architecture.
                    </p>
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      onClick={handleExecuteMigration}
                      disabled={migrating || !validationResult?.isValid}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {migrating ? 'Migrating...' : 'Start Migration'}
                    </button>
                    <button
                      onClick={loadMigrationData}
                      className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
                    >
                      Refresh Status
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800">Migration Complete</h4>
                    <p className="text-green-700 text-sm mt-1">
                      Your system is successfully running multi-tenant architecture.
                    </p>
                    {migrationStatus.lastMigrationDate && (
                      <p className="text-green-700 text-sm">
                        Last migrated: {new Date(migrationStatus.lastMigrationDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      onClick={handleRollback}
                      disabled={migrating}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {migrating ? 'Rolling back...' : 'Rollback Migration'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'cleanup' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Data Cleanup</h3>
              
              {migrationStatus?.stats.orphanedRecords > 0 ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-800">Orphaned Data Found</h4>
                    <p className="text-yellow-700 text-sm mt-1">
                      Found {migrationStatus.stats.orphanedRecords} orphaned records that need cleanup.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleCleanup}
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
                  >
                    Clean Up Orphaned Data
                  </button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800">No Cleanup Needed</h4>
                  <p className="text-green-700 text-sm mt-1">
                    No orphaned data found. Your database is clean.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TenantMigrationDashboard;