/**
 * Performance Monitoring System for POS Integration
 * Tracks metrics, performance, and system health
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface PerformanceTimer {
  name: string;
  startTime: number;
  tags?: Record<string, string>;
}

interface SystemHealth {
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  errorRate: number;
  responseTimeP95: number;
}

export class PerformanceMonitor extends EventEmitter {
  private static instance: PerformanceMonitor;
  private metrics: Metric[] = [];
  private timers: Map<string, PerformanceTimer> = new Map();
  private responseTimes: number[] = [];
  private errorCount = 0;
  private requestCount = 0;
  private startTime = Date.now();
  private activeConnections = 0;

  private constructor() {
    super();
    this.setupCleanupInterval();
    this.setupHealthCheck();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Metric collection
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);
    this.emit('metric', metric);

    logger.debug('MONITOR', `Metric recorded: ${name}=${value}`, { tags });
  }

  // Performance timing
  startTimer(name: string, tags?: Record<string, string>): void {
    const timer: PerformanceTimer = {
      name,
      startTime: performance.now(),
      tags
    };

    this.timers.set(name, timer);
    logger.debug('MONITOR', `Timer started: ${name}`);
  }

  endTimer(name: string): number | undefined {
    const timer = this.timers.get(name);
    if (!timer) {
      logger.warn('MONITOR', `Timer not found: ${name}`);
      return undefined;
    }

    const duration = performance.now() - timer.startTime;
    this.timers.delete(name);

    // Record as metric
    this.recordMetric(`${name}_duration`, duration, timer.tags);

    logger.debug('MONITOR', `Timer ended: ${name} (${duration.toFixed(2)}ms)`);
    return duration;
  }

  // Request/Response tracking
  recordRequest(): void {
    this.requestCount++;
    this.activeConnections++;
  }

  recordResponse(statusCode: number, responseTime: number): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    this.responseTimes.push(responseTime);

    // Keep only last 1000 response times for percentile calculation
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }

    if (statusCode >= 400) {
      this.errorCount++;
    }

    this.recordMetric('response_time', responseTime, { 
      status_code: statusCode.toString() 
    });
  }

  // Error tracking
  recordError(error: Error, context?: string): void {
    this.errorCount++;
    this.recordMetric('error_count', 1, { 
      context: context || 'unknown',
      error_type: error.constructor.name
    });

    logger.error('MONITOR', `Error recorded: ${error.message}`, {
      context,
      stack: error.stack
    });
  }

  // POS-specific monitoring
  recordPOSOperation(operation: string, posId: string, duration: number, success: boolean): void {
    this.recordMetric('pos_operation_duration', duration, {
      operation,
      pos_id: posId,
      status: success ? 'success' : 'failure'
    });

    if (!success) {
      this.recordMetric('pos_operation_failure', 1, {
        operation,
        pos_id: posId
      });
    }

    logger.info('MONITOR', `POS operation: ${operation} for ${posId}`, {
      duration,
      success
    });
  }

  recordPOSSync(posId: string, recordsSynced: number, duration: number, errors: number): void {
    this.recordMetric('pos_sync_records', recordsSynced, { pos_id: posId });
    this.recordMetric('pos_sync_duration', duration, { pos_id: posId });
    this.recordMetric('pos_sync_errors', errors, { pos_id: posId });

    logger.info('MONITOR', `POS sync completed for ${posId}`, {
      recordsSynced,
      duration,
      errors
    });
  }

  // System health
  getSystemHealth(): SystemHealth {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage,
      cpuUsage,
      activeConnections: this.activeConnections,
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      responseTimeP95: this.calculatePercentile(this.responseTimes, 95)
    };
  }

  // Statistics
  getMetrics(name?: string, since?: Date): Metric[] {
    let filteredMetrics = this.metrics;

    if (name) {
      filteredMetrics = filteredMetrics.filter(m => m.name === name);
    }

    if (since) {
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= since);
    }

    return filteredMetrics.slice(); // Return copy
  }

  getAverageResponseTime(minutes = 5): number {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recentTimes = this.responseTimes.filter((_, i) => {
      // Approximate filtering based on array position
      return i >= this.responseTimes.length - (minutes * 60);
    });

    if (recentTimes.length === 0) return 0;
    
    return recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
  }

  getErrorRate(minutes = 5): number {
    const cutoff = new Date(Date.now() - (minutes * 60 * 1000));
    const recentMetrics = this.getMetrics('error_count', cutoff);
    const recentErrors = recentMetrics.reduce((sum, m) => sum + m.value, 0);
    
    // Estimate recent requests (rough approximation)
    const estimatedRecentRequests = Math.max(1, this.requestCount * (minutes / 60));
    
    return recentErrors / estimatedRecentRequests;
  }

  // Utility methods
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private setupCleanupInterval(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours
      this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
      
      logger.debug('MONITOR', `Cleaned up old metrics, ${this.metrics.length} remaining`);
    }, 60 * 60 * 1000); // 1 hour
  }

  private setupHealthCheck(): void {
    // Log system health every 5 minutes
    setInterval(() => {
      const health = this.getSystemHealth();
      
      logger.info('MONITOR', 'System health check', {
        uptime: Math.round(health.uptime / 1000),
        memoryUsageMB: Math.round(health.memoryUsage.used / 1024 / 1024),
        activeConnections: health.activeConnections,
        errorRate: Math.round(health.errorRate * 100) / 100,
        responseTimeP95: Math.round(health.responseTimeP95)
      });

      this.emit('health-check', health);
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Alert thresholds
  checkAlerts(): void {
    const health = this.getSystemHealth();
    
    // Memory alert
    const memoryUsageMB = health.memoryUsage.used / 1024 / 1024;
    if (memoryUsageMB > 1024) { // 1GB
      logger.warn('MONITOR', `High memory usage: ${memoryUsageMB.toFixed(0)}MB`);
      this.emit('alert', { type: 'memory', value: memoryUsageMB });
    }

    // Error rate alert
    if (health.errorRate > 0.05) { // 5%
      logger.warn('MONITOR', `High error rate: ${(health.errorRate * 100).toFixed(1)}%`);
      this.emit('alert', { type: 'error_rate', value: health.errorRate });
    }

    // Response time alert
    if (health.responseTimeP95 > 5000) { // 5 seconds
      logger.warn('MONITOR', `High response time P95: ${health.responseTimeP95.toFixed(0)}ms`);
      this.emit('alert', { type: 'response_time', value: health.responseTimeP95 });
    }
  }

  // Export methods
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.formatPrometheus();
    }
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      system_health: this.getSystemHealth(),
      metrics: this.metrics.slice(-100), // Last 100 metrics
      summary: {
        total_requests: this.requestCount,
        total_errors: this.errorCount,
        avg_response_time: this.getAverageResponseTime(),
        error_rate: this.getErrorRate()
      }
    }, null, 2);
  }

  private formatPrometheus(): string {
    const health = this.getSystemHealth();
    let output = '';

    // System metrics
    output += `# HELP system_uptime_seconds System uptime in seconds\n`;
    output += `# TYPE system_uptime_seconds gauge\n`;
    output += `system_uptime_seconds ${health.uptime / 1000}\n\n`;

    output += `# HELP system_memory_usage_bytes Memory usage in bytes\n`;
    output += `# TYPE system_memory_usage_bytes gauge\n`;
    output += `system_memory_usage_bytes ${health.memoryUsage.used}\n\n`;

    output += `# HELP http_requests_total Total HTTP requests\n`;
    output += `# TYPE http_requests_total counter\n`;
    output += `http_requests_total ${this.requestCount}\n\n`;

    output += `# HELP http_errors_total Total HTTP errors\n`;
    output += `# TYPE http_errors_total counter\n`;
    output += `http_errors_total ${this.errorCount}\n\n`;

    return output;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Express middleware for automatic monitoring
export const monitoringMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  performanceMonitor.recordRequest();
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk: any, encoding: any) {
    const responseTime = Date.now() - startTime;
    performanceMonitor.recordResponse(res.statusCode, responseTime);
    originalEnd.call(res, chunk, encoding);
  };

  next();
};
