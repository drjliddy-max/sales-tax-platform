"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringMiddleware = exports.performanceMonitor = exports.PerformanceMonitor = void 0;
const events_1 = require("events");
const Logger_1 = require("../logging/Logger");
class PerformanceMonitor extends events_1.EventEmitter {
    constructor() {
        super();
        this.metrics = [];
        this.timers = new Map();
        this.responseTimes = [];
        this.errorCount = 0;
        this.requestCount = 0;
        this.startTime = Date.now();
        this.activeConnections = 0;
        this.setupCleanupInterval();
        this.setupHealthCheck();
    }
    static getInstance() {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }
    recordMetric(name, value, tags) {
        const metric = {
            name,
            value,
            timestamp: new Date(),
            tags
        };
        this.metrics.push(metric);
        this.emit('metric', metric);
        Logger_1.logger.debug('MONITOR', `Metric recorded: ${name}=${value}`, { tags });
    }
    startTimer(name, tags) {
        const timer = {
            name,
            startTime: performance.now(),
            tags
        };
        this.timers.set(name, timer);
        Logger_1.logger.debug('MONITOR', `Timer started: ${name}`);
    }
    endTimer(name) {
        const timer = this.timers.get(name);
        if (!timer) {
            Logger_1.logger.warn('MONITOR', `Timer not found: ${name}`);
            return undefined;
        }
        const duration = performance.now() - timer.startTime;
        this.timers.delete(name);
        this.recordMetric(`${name}_duration`, duration, timer.tags);
        Logger_1.logger.debug('MONITOR', `Timer ended: ${name} (${duration.toFixed(2)}ms)`);
        return duration;
    }
    recordRequest() {
        this.requestCount++;
        this.activeConnections++;
    }
    recordResponse(statusCode, responseTime) {
        this.activeConnections = Math.max(0, this.activeConnections - 1);
        this.responseTimes.push(responseTime);
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
    recordError(error, context) {
        this.errorCount++;
        this.recordMetric('error_count', 1, {
            context: context || 'unknown',
            error_type: error.constructor.name
        });
        Logger_1.logger.error('MONITOR', `Error recorded: ${error.message}`, {
            context,
            stack: error.stack
        });
    }
    recordPOSOperation(operation, posId, duration, success) {
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
        Logger_1.logger.info('MONITOR', `POS operation: ${operation} for ${posId}`, {
            duration,
            success
        });
    }
    recordPOSSync(posId, recordsSynced, duration, errors) {
        this.recordMetric('pos_sync_records', recordsSynced, { pos_id: posId });
        this.recordMetric('pos_sync_duration', duration, { pos_id: posId });
        this.recordMetric('pos_sync_errors', errors, { pos_id: posId });
        Logger_1.logger.info('MONITOR', `POS sync completed for ${posId}`, {
            recordsSynced,
            duration,
            errors
        });
    }
    getSystemHealth() {
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
    getMetrics(name, since) {
        let filteredMetrics = this.metrics;
        if (name) {
            filteredMetrics = filteredMetrics.filter(m => m.name === name);
        }
        if (since) {
            filteredMetrics = filteredMetrics.filter(m => m.timestamp >= since);
        }
        return filteredMetrics.slice();
    }
    getAverageResponseTime(minutes = 5) {
        const cutoff = Date.now() - (minutes * 60 * 1000);
        const recentTimes = this.responseTimes.filter((_, i) => {
            return i >= this.responseTimes.length - (minutes * 60);
        });
        if (recentTimes.length === 0)
            return 0;
        return recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
    }
    getErrorRate(minutes = 5) {
        const cutoff = new Date(Date.now() - (minutes * 60 * 1000));
        const recentMetrics = this.getMetrics('error_count', cutoff);
        const recentErrors = recentMetrics.reduce((sum, m) => sum + m.value, 0);
        const estimatedRecentRequests = Math.max(1, this.requestCount * (minutes / 60));
        return recentErrors / estimatedRecentRequests;
    }
    calculatePercentile(values, percentile) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }
    setupCleanupInterval() {
        setInterval(() => {
            const cutoff = new Date(Date.now() - (24 * 60 * 60 * 1000));
            this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
            Logger_1.logger.debug('MONITOR', `Cleaned up old metrics, ${this.metrics.length} remaining`);
        }, 60 * 60 * 1000);
    }
    setupHealthCheck() {
        setInterval(() => {
            const health = this.getSystemHealth();
            Logger_1.logger.info('MONITOR', 'System health check', {
                uptime: Math.round(health.uptime / 1000),
                memoryUsageMB: Math.round(health.memoryUsage.used / 1024 / 1024),
                activeConnections: health.activeConnections,
                errorRate: Math.round(health.errorRate * 100) / 100,
                responseTimeP95: Math.round(health.responseTimeP95)
            });
            this.emit('health-check', health);
        }, 5 * 60 * 1000);
    }
    checkAlerts() {
        const health = this.getSystemHealth();
        const memoryUsageMB = health.memoryUsage.used / 1024 / 1024;
        if (memoryUsageMB > 1024) {
            Logger_1.logger.warn('MONITOR', `High memory usage: ${memoryUsageMB.toFixed(0)}MB`);
            this.emit('alert', { type: 'memory', value: memoryUsageMB });
        }
        if (health.errorRate > 0.05) {
            Logger_1.logger.warn('MONITOR', `High error rate: ${(health.errorRate * 100).toFixed(1)}%`);
            this.emit('alert', { type: 'error_rate', value: health.errorRate });
        }
        if (health.responseTimeP95 > 5000) {
            Logger_1.logger.warn('MONITOR', `High response time P95: ${health.responseTimeP95.toFixed(0)}ms`);
            this.emit('alert', { type: 'response_time', value: health.responseTimeP95 });
        }
    }
    exportMetrics(format = 'json') {
        if (format === 'prometheus') {
            return this.formatPrometheus();
        }
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            system_health: this.getSystemHealth(),
            metrics: this.metrics.slice(-100),
            summary: {
                total_requests: this.requestCount,
                total_errors: this.errorCount,
                avg_response_time: this.getAverageResponseTime(),
                error_rate: this.getErrorRate()
            }
        }, null, 2);
    }
    formatPrometheus() {
        const health = this.getSystemHealth();
        let output = '';
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
exports.PerformanceMonitor = PerformanceMonitor;
exports.performanceMonitor = PerformanceMonitor.getInstance();
const monitoringMiddleware = (req, res, next) => {
    const startTime = Date.now();
    exports.performanceMonitor.recordRequest();
    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
        const responseTime = Date.now() - startTime;
        exports.performanceMonitor.recordResponse(res.statusCode, responseTime);
        originalEnd.call(res, chunk, encoding);
    };
    next();
};
exports.monitoringMiddleware = monitoringMiddleware;
//# sourceMappingURL=PerformanceMonitor.js.map