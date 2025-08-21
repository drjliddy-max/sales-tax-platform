import React, { useState, useEffect, useCallback } from 'react';
import { MigrationProgress } from '@/utils/tenantMigration';
import { migrationService } from '@/utils/tenantMigration';

interface MigrationProgressTrackerProps {
  migrationId: string;
  onComplete?: (result: MigrationProgress) => void;
  onError?: (error: string) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

export function MigrationProgressTracker({
  migrationId,
  onComplete,
  onError,
  autoRefresh = true,
  refreshInterval = 2000,
  className = ''
}: MigrationProgressTrackerProps) {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const progressData = await migrationService.getMigrationProgress(migrationId);
      setProgress(progressData);
      setError(null);

      if (progressData.status === 'completed') {
        onComplete?.(progressData);
      } else if (progressData.status === 'failed') {
        const errorMsg = progressData.stages
          .filter(stage => stage.status === 'failed')
          .map(stage => stage.errors?.join(', '))
          .filter(Boolean)
          .join('; ') || 'Migration failed';
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch progress';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [migrationId, onComplete, onError]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  useEffect(() => {
    if (!autoRefresh || !progress || progress.status === 'completed' || progress.status === 'failed') {
      return;
    }

    const interval = setInterval(fetchProgress, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, progress, fetchProgress]);

  const handlePause = async () => {
    try {
      await migrationService.pauseMigration(migrationId);
      await fetchProgress();
    } catch (error) {
      console.error('Error pausing migration:', error);
    }
  };

  const handleResume = async () => {
    try {
      await migrationService.resumeMigration(migrationId);
      await fetchProgress();
    } catch (error) {
      console.error('Error resuming migration:', error);
    }
  };

  const handleCancel = async () => {
    if (window.confirm('Are you sure you want to cancel this migration? This action cannot be undone.')) {
      try {
        await migrationService.cancelMigration(migrationId);
        await fetchProgress();
      } catch (error) {
        console.error('Error canceling migration:', error);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'running': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'paused': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'running': return '🔄';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      default: return '⏳';
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleTimeString();
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return 'In progress...';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading migration progress...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-600 font-medium">Error: {error}</p>
        <button 
          onClick={fetchProgress}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className={`p-6 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <p className="text-gray-600">No migration progress found</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Migration Progress: {progress.migrationId.slice(0, 8)}...
          </h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(progress.status)}`}>
            {progress.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Overall Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-600">
              {progress.progress.current} / {progress.progress.total} ({progress.progress.percentage.toFixed(1)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress.percentage}%` }}
            ></div>
          </div>
          {progress.estimatedTimeRemaining && (
            <p className="text-sm text-gray-500 mt-1">
              Estimated time remaining: {Math.ceil(progress.estimatedTimeRemaining / 60)} minutes
            </p>
          )}
        </div>

        {/* Stages */}
        <div className="space-y-3 mb-6">
          <h4 className="text-md font-medium text-gray-900">Migration Stages</h4>
          {progress.stages.map((stage, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <span className="text-lg">{getStageIcon(stage.status)}</span>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">{stage.name}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(stage.status)}`}>
                    {stage.status}
                  </span>
                </div>
                {stage.startTime && (
                  <div className="text-sm text-gray-600 mt-1">
                    Started: {formatTime(stage.startTime)}
                    {stage.endTime && (
                      <>
                        {' • '}
                        Duration: {formatDuration(stage.startTime, stage.endTime)}
                      </>
                    )}
                  </div>
                )}
                {stage.errors && stage.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-red-600 font-medium">Errors:</p>
                    <ul className="text-sm text-red-600 mt-1">
                      {stage.errors.map((error, errorIndex) => (
                        <li key={errorIndex}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Migration Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Started:</span>
              <p className="font-medium">{new Date(progress.startTime).toLocaleString()}</p>
            </div>
            {progress.endTime && (
              <div>
                <span className="text-gray-600">Completed:</span>
                <p className="font-medium">{new Date(progress.endTime).toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        {progress.status === 'running' && (
          <div className="flex space-x-3">
            <button
              onClick={handlePause}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700"
            >
              Pause Migration
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              Cancel Migration
            </button>
          </div>
        )}

        {progress.status === 'paused' && (
          <div className="flex space-x-3">
            <button
              onClick={handleResume}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Resume Migration
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
            >
              Cancel Migration
            </button>
          </div>
        )}

        {(progress.status === 'completed' || progress.status === 'failed') && (
          <button
            onClick={fetchProgress}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Refresh Status
          </button>
        )}
      </div>
    </div>
  );
}

export default MigrationProgressTracker;