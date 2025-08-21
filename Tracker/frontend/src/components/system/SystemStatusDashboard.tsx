import React, { useState, useEffect } from 'react';
import { taxRateService } from '../../services/taxRates/TaxRateService';
import { ProviderHealth, ServiceMetrics } from '../../services/taxRates/TaxRateService';

interface SystemStatusProps {
  className?: string;
}

interface ConnectionTest {
  provider: string;
  success: boolean;
  message: string;
  responseTime: number;
  lastTested: Date;
}

export const SystemStatusDashboard: React.FC<SystemStatusProps> = ({ className = '' }) => {
  const [providerHealth, setProviderHealth] = useState<ProviderHealth[]>([]);
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const [connectionTests, setConnectionTests] = useState<ConnectionTest[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    refreshSystemStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(refreshSystemStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const refreshSystemStatus = async () => {
    try {
      setIsRefreshing(true);
      
      // Get provider health
      const health = taxRateService.getProviderHealth();
      setProviderHealth(health);
      
      // Get metrics
      const serviceMetrics = taxRateService.getMetrics();
      setMetrics(serviceMetrics);
      
      // Test connections
      const connections = await taxRateService.testConnections();
      const connectionResults: ConnectionTest[] = Object.entries(connections).map(([provider, result]) => ({
        provider,
        ...result,
        lastTested: new Date()
      }));
      setConnectionTests(connectionResults);
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to refresh system status:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getHealthStatusColor = (isHealthy: boolean): string => {
    return isHealthy ? 'text-green-600' : 'text-red-600';
  };

  const getHealthStatusBg = (isHealthy: boolean): string => {
    return isHealthy ? 'bg-green-100' : 'bg-red-100';
  };

  const getResponseTimeColor = (responseTime: number): string => {
    if (responseTime < 1000) return 'text-green-600';
    if (responseTime < 5000) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatUptime = (uptimeMs: number): string => {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">System Status</h2>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={refreshSystemStatus}
            disabled={isRefreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Overall Metrics */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Uptime</h3>
            <p className="text-2xl font-bold text-gray-900">{formatUptime(metrics.uptime)}</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
            <p className="text-2xl font-bold text-green-600">
              {metrics.totalRequests > 0 
                ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)
                : '0'}%
            </p>
            <p className="text-xs text-gray-500">
              {metrics.successfulRequests} / {metrics.totalRequests} requests
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Cache Hit Rate</h3>
            <p className="text-2xl font-bold text-blue-600">{(metrics.cacheHitRate * 100).toFixed(1)}%</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-sm font-medium text-gray-500">Avg Response Time</h3>
            <p className={`text-2xl font-bold ${getResponseTimeColor(metrics.averageResponseTime)}`}>
              {Math.round(metrics.averageResponseTime)}ms
            </p>
          </div>
        </div>
      )}

      {/* Provider Health */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Provider Health</h3>
        </div>
        <div className="p-6">
          {providerHealth.length > 0 ? (
            <div className="space-y-4">
              {providerHealth.map((health) => (
                <div
                  key={health.name}
                  className={`p-4 rounded-lg border-l-4 ${
                    health.isHealthy ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900 capitalize">{health.name}</h4>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">Status:</span>
                          <span className={`font-medium ${getHealthStatusColor(health.isHealthy)}`}>
                            {health.isHealthy ? 'Healthy' : 'Unhealthy'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">Response Time:</span>
                          <span className={getResponseTimeColor(health.responseTime)}>
                            {Math.round(health.responseTime)}ms
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500">Consecutive Failures:</span>
                          <span className={health.consecutiveFailures > 0 ? 'text-red-600' : 'text-green-600'}>
                            {health.consecutiveFailures}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div>Last Check:</div>
                      <div>{health.lastCheck.toLocaleTimeString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No provider health data available</p>
          )}
        </div>
      </div>

      {/* Connection Tests */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Connection Tests</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Tested
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {connectionTests.map((test) => (
                <tr key={test.provider}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                    {test.provider}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        test.success
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {test.success ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${getResponseTimeColor(test.responseTime)}`}>
                    {test.responseTime > 0 ? `${Math.round(test.responseTime)}ms` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {test.message}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {test.lastTested.toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {connectionTests.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No connection test results available
            </div>
          )}
        </div>
      </div>

      {/* Error Summary */}
      {metrics && Object.keys(metrics.errorsByProvider).length > 0 && (
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Error Summary</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {Object.entries(metrics.errorsByProvider).map(([provider, errorCount]) => (
                <div key={provider} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900 capitalize">{provider}</span>
                  <span className="text-sm text-red-600">{errorCount} errors</span>
                </div>
              ))}
            </div>
            
            {metrics.lastError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="text-sm text-red-800">
                  <strong>Last Error:</strong> {metrics.lastError}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Recommendations */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-4">System Recommendations</h3>
        <div className="space-y-2 text-sm text-yellow-700">
          {metrics && metrics.cacheHitRate < 0.5 && (
            <div>• Consider preloading commonly used addresses to improve cache hit rate</div>
          )}
          {metrics && metrics.averageResponseTime > 5000 && (
            <div>• High response times detected - check network connectivity and API provider status</div>
          )}
          {providerHealth.some(h => !h.isHealthy) && (
            <div>• Some providers are unhealthy - verify API credentials and network connectivity</div>
          )}
          {providerHealth.some(h => h.consecutiveFailures > 2) && (
            <div>• Circuit breakers may be activating - monitor provider stability</div>
          )}
          {metrics && metrics.successfulRequests === 0 && metrics.totalRequests > 0 && (
            <div>• All requests are failing - check system configuration and API status</div>
          )}
        </div>
      </div>
    </div>
  );
};
