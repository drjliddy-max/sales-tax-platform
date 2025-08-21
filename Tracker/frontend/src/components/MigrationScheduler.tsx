import React, { useState, useEffect } from 'react';
import { 
  migrationSchedulerService, 
  ScheduledMigration, 
  AutomationRule, 
  SchedulerStats,
  createDailyBackupSchedule,
  createWeeklyValidationSchedule,
  createMonthlyCleanupSchedule
} from '@/services/migrationScheduler';
import { useTenant } from '@/contexts/TenantContext';
import { BackupConfig } from '@/services/backupRestore';

interface MigrationSchedulerProps {
  className?: string;
}

export function MigrationScheduler({ className = '' }: MigrationSchedulerProps) {
  const { tenant: currentTenant } = useTenant();
  const [schedules, setSchedules] = useState<ScheduledMigration[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [stats, setStats] = useState<SchedulerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedules' | 'automation' | 'stats'>('schedules');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadData = async () => {
    if (!currentTenant) return;
    
    setLoading(true);
    try {
      const [schedulesData, rulesData, statsData] = await Promise.all([
        migrationSchedulerService.getScheduledMigrations(currentTenant.id),
        migrationSchedulerService.getAutomationRules(currentTenant.id),
        migrationSchedulerService.getSchedulerStats(currentTenant.id)
      ]);
      
      setSchedules(schedulesData);
      setAutomationRules(rulesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading scheduler data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createQuickSchedules = async () => {
    if (!currentTenant) return;
    
    setLoading(true);
    try {
      const backupConfig: BackupConfig = {
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

      await Promise.all([
        createDailyBackupSchedule(currentTenant.id, backupConfig, []),
        createWeeklyValidationSchedule(currentTenant.id, []),
        createMonthlyCleanupSchedule(currentTenant.id, [])
      ]);

      await loadData();
    } catch (error) {
      console.error('Error creating quick schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSchedule = async (scheduleId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await migrationSchedulerService.resumeSchedule(scheduleId);
      } else {
        await migrationSchedulerService.pauseSchedule(scheduleId);
      }
      await loadData();
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  const triggerSchedule = async (scheduleId: string) => {
    try {
      await migrationSchedulerService.triggerScheduledMigration(scheduleId);
      await loadData();
    } catch (error) {
      console.error('Error triggering schedule:', error);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (window.confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      try {
        await migrationSchedulerService.deleteScheduledMigration(scheduleId);
        await loadData();
      } catch (error) {
        console.error('Error deleting schedule:', error);
      }
    }
  };

  useEffect(() => {
    if (currentTenant) {
      loadData();
    }
  }, [currentTenant]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      default: return '⏳';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'backup': return '💾';
      case 'migration': return '🔄';
      case 'validation': return '🔍';
      case 'cleanup': return '🧹';
      default: return '📋';
    }
  };

  const formatCronExpression = (cron: string) => {
    // Basic cron expression interpretation
    const expressions: Record<string, string> = {
      '0 2 * * *': 'Daily at 2:00 AM',
      '0 3 * * 0': 'Weekly on Sunday at 3:00 AM',
      '0 1 1 * *': 'Monthly on 1st at 1:00 AM',
      '0 0 * * *': 'Daily at midnight',
    };
    return expressions[cron] || cron;
  };

  if (!currentTenant) {
    return (
      <div className={`p-6 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <p className="text-gray-600">Please select a tenant to manage migration schedules</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Migration Scheduler</h2>
          <div className="flex space-x-2">
            <button
              onClick={createQuickSchedules}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Quick Setup
            </button>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="mt-4">
          <nav className="flex space-x-8">
            {[
              { id: 'schedules', label: 'Schedules' },
              { id: 'automation', label: 'Automation' },
              { id: 'stats', label: 'Statistics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading scheduler data...</span>
          </div>
        )}

        {!loading && activeTab === 'schedules' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Scheduled Operations</h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                Create Schedule
              </button>
            </div>

            {schedules.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📅</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Schedules</h4>
                <p className="text-gray-600 mb-4">Create automated schedules for backups, validations, and cleanups</p>
                <button
                  onClick={createQuickSchedules}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                >
                  Quick Setup (Backup + Validation + Cleanup)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map(schedule => (
                  <div key={schedule.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{getTypeIcon(schedule.type)}</span>
                        <div>
                          <h4 className="font-medium text-gray-900">{schedule.name}</h4>
                          <p className="text-sm text-gray-600">{schedule.description}</p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                            <span>📅 {formatCronExpression(schedule.schedule.cronExpression)}</span>
                            <span>⏰ Next: {new Date(schedule.nextRun).toLocaleString()}</span>
                            {schedule.lastRun && (
                              <span className="flex items-center space-x-1">
                                {getStatusIcon(schedule.lastRun.status)}
                                <span>Last: {new Date(schedule.lastRun.timestamp).toLocaleString()}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={schedule.schedule.enabled}
                            onChange={(e) => toggleSchedule(schedule.id, e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600">Enabled</span>
                        </label>
                        
                        <button
                          onClick={() => triggerSchedule(schedule.id)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                        >
                          Run Now
                        </button>
                        
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'automation' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Automation Rules</h3>
            
            {automationRules.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🤖</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Automation Rules</h4>
                <p className="text-gray-600">Create rules to automatically trigger actions based on events or conditions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {automationRules.map(rule => (
                  <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{rule.name}</h4>
                        <p className="text-sm text-gray-600">{rule.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                          <span>🔧 Trigger: {rule.trigger.type}</span>
                          <span>⚙️ Actions: {rule.actions.length}</span>
                          {rule.lastTriggered && (
                            <span>🕒 Last: {new Date(rule.lastTriggered).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'stats' && stats && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Scheduler Statistics</h3>
            
            {/* Overview Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.totalSchedules}</div>
                <div className="text-sm text-blue-700">Total Schedules</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{stats.activeSchedules}</div>
                <div className="text-sm text-green-700">Active Schedules</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{stats.failedLastRun}</div>
                <div className="text-sm text-red-700">Failed Last Run</div>
              </div>
            </div>

            {/* Upcoming Runs */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Upcoming Runs</h4>
              {stats.upcomingRuns.length === 0 ? (
                <p className="text-gray-600">No upcoming scheduled runs</p>
              ) : (
                <div className="space-y-2">
                  {stats.upcomingRuns.slice(0, 5).map((run, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <span>{getTypeIcon(run.type)}</span>
                        <span className="font-medium">{run.name}</span>
                      </div>
                      <span className="text-sm text-gray-600">
                        {new Date(run.nextRun).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Executions */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Recent Executions</h4>
              {stats.recentExecutions.length === 0 ? (
                <p className="text-gray-600">No recent executions</p>
              ) : (
                <div className="space-y-2">
                  {stats.recentExecutions.slice(0, 10).map((execution, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <span>{getStatusIcon(execution.status)}</span>
                        <span className="font-medium">{execution.name}</span>
                        {execution.duration && (
                          <span className="text-sm text-gray-500">({execution.duration}ms)</span>
                        )}
                      </div>
                      <span className="text-sm text-gray-600">
                        {new Date(execution.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Setup Info */}
      {schedules.length === 0 && !loading && (
        <div className="px-6 pb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Quick Setup Includes:</h4>
            <ul className="text-blue-800 text-sm space-y-1">
              <li>💾 Daily backup at 2:00 AM (30-day retention)</li>
              <li>🔍 Weekly validation check on Sundays at 3:00 AM</li>
              <li>🧹 Monthly cleanup on 1st of month at 1:00 AM</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default MigrationScheduler;