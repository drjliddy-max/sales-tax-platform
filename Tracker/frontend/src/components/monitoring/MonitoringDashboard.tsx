/**
 * Monitoring Dashboard Component
 * Displays system health, metrics, and alerts for admin users
 */

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity,
  AlertCircle, 
  CheckCircle,
  MemoryStick,
  TrendingUp,
  RefreshCw,
  Download,
  XCircle
} from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  responseTime: number;
  checks: {
    memory: {
      status: 'ok' | 'warning' | 'error';
      used: number;
      total: number;
    };
    api: {
      status: 'ok' | 'warning' | 'error';
      errorRate: number;
      averageResponseTime: number;
    };
    alerts: {
      status: 'ok' | 'warning' | 'critical';
      criticalCount: number;
      totalUnresolved: number;
    };
  };
}

interface AlertData {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  source: string;
  resolved?: boolean;
  resolvedAt?: string;
}

interface AlertSummary {
  total: number;
  unresolved: number;
  bySeverity: Record<string, number>;
}

interface PerformanceMetrics {
  timestamp: string;
  period: string;
  averageResponseTime: number;
  errorRate: number;
  systemHealth: SystemHealth;
}

const MonitoringDashboard: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [alertSummary, setAlertSummary] = useState<AlertSummary | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealthData = async () => {
    try {
      const response = await fetch('/api/monitoring/health');
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    }
  };

  const fetchAlertsData = async () => {
    try {
      const response = await fetch('/api/monitoring/alerts?limit=20');
      const data = await response.json();
      setAlerts(data.alerts);
      setAlertSummary(data.summary);
    } catch (error) {
      console.error('Failed to fetch alerts data:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const response = await fetch('/api/monitoring/performance?minutes=60');
      const data = await response.json();
      setPerformance(data);
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    await Promise.all([
      fetchHealthData(),
      fetchAlertsData(),
      fetchPerformanceData()
    ]);
    setLastUpdated(new Date());
    setLoading(false);
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchAlertsData();
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const exportMetrics = async (format: 'json' | 'prometheus' = 'json') => {
    try {
      const response = await fetch(`/api/monitoring/metrics?format=${format}`);
      const data = format === 'json' ? await response.json() : await response.text();
      
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
        type: format === 'json' ? 'application/json' : 'text/plain'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metrics-${new Date().toISOString()}.${format === 'json' ? 'json' : 'txt'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export metrics:', error);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refreshData, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded':
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'error':
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'degraded':
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info':
        return 'bg-blue-100 text-blue-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'critical':
        return 'bg-red-200 text-red-900 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading && !health) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading monitoring data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-gray-600">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'text-green-600' : 'text-gray-400'}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportMetrics('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              {getStatusIcon(health.status)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <Badge className={getStatusColor(health.status)}>
                  {health.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Uptime: {formatUptime(health.uptime)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <MemoryStick className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {health.checks.memory.used}MB
              </div>
              <p className="text-xs text-gray-600">
                of {health.checks.memory.total}MB ({Math.round((health.checks.memory.used / health.checks.memory.total) * 100)}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Performance</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {health.checks.api.averageResponseTime}ms
              </div>
              <p className="text-xs text-gray-600">
                Error rate: {health.checks.api.errorRate.toFixed(2)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {health.checks.alerts.totalUnresolved}
              </div>
              <p className="text-xs text-gray-600">
                {health.checks.alerts.criticalCount} critical
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="health">Health Details</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          {alertSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Alert Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{alertSummary.total}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{alertSummary.unresolved}</div>
                    <div className="text-sm text-gray-600">Unresolved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-800">{alertSummary.bySeverity.critical || 0}</div>
                    <div className="text-sm text-gray-600">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{alertSummary.bySeverity.warning || 0}</div>
                    <div className="text-sm text-gray-600">Warning</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>Latest system alerts and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                    No active alerts
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <Alert key={alert.id} className={alert.severity === 'critical' ? 'border-red-300' : ''}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <AlertTitle className="flex items-center gap-2">
                            <Badge className={getAlertSeverityColor(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            {alert.title}
                            {alert.resolved && (
                              <Badge variant="outline" className="bg-green-50 text-green-700">
                                RESOLVED
                              </Badge>
                            )}
                          </AlertTitle>
                          <AlertDescription className="mt-2">
                            {alert.message}
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>Source: {alert.source}</span>
                              <span>Time: {new Date(alert.timestamp).toLocaleString()}</span>
                            </div>
                          </AlertDescription>
                        </div>
                        {!alert.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolveAlert(alert.id)}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </Alert>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {performance && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Response Time</CardTitle>
                  <CardDescription>Average API response time over {performance.period}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.round(performance.averageResponseTime)}ms
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Rate</CardTitle>
                  <CardDescription>Request error percentage over {performance.period}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {(performance.errorRate * 100).toFixed(2)}%
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          {health && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Status</span>
                    <Badge className={getStatusColor(health.status)}>
                      {health.status.toUpperCase()}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span>Uptime</span>
                    <span>{formatUptime(health.uptime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Last Health Check</span>
                    <span>{new Date(health.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Response Time</span>
                    <span>{health.responseTime}ms</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Resource Usage</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span>Memory</span>
                      <Badge className={getStatusColor(health.checks.memory.status)}>
                        {health.checks.memory.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {health.checks.memory.used}MB / {health.checks.memory.total}MB
                      ({Math.round((health.checks.memory.used / health.checks.memory.total) * 100)}%)
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span>API Health</span>
                      <Badge className={getStatusColor(health.checks.api.status)}>
                        {health.checks.api.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      Error Rate: {health.checks.api.errorRate.toFixed(2)}%<br />
                      Avg Response: {health.checks.api.averageResponseTime}ms
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;
