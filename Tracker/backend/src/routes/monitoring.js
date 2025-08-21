"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rbac_1 = require("../middleware/rbac");
const PerformanceMonitor_1 = require("../lib/monitoring/PerformanceMonitor");
const AlertSystem_1 = require("../lib/monitoring/AlertSystem");
const Logger_1 = require("../lib/logging/Logger");
const router = (0, express_1.Router)();
router.get('/health', (req, res) => {
    const startTime = Date.now();
    try {
        const health = PerformanceMonitor_1.performanceMonitor.getSystemHealth();
        const alerts = AlertSystem_1.alertSystem.getCriticalAlerts();
        const responseTime = Date.now() - startTime;
        const healthStatus = {
            status: alerts.length > 0 ? 'degraded' : 'healthy',
            timestamp: new Date().toISOString(),
            uptime: Math.round(health.uptime / 1000),
            responseTime,
            checks: {
                memory: {
                    status: health.memoryUsage.used < 1024 * 1024 * 1024 ? 'ok' : 'warning',
                    used: Math.round(health.memoryUsage.used / 1024 / 1024),
                    total: Math.round(health.memoryUsage.total / 1024 / 1024)
                },
                api: {
                    status: health.errorRate < 0.05 ? 'ok' : 'error',
                    errorRate: Math.round(health.errorRate * 10000) / 100,
                    averageResponseTime: Math.round(health.responseTimeP95)
                },
                alerts: {
                    status: alerts.length === 0 ? 'ok' : 'critical',
                    criticalCount: alerts.length,
                    totalUnresolved: AlertSystem_1.alertSystem.getUnresolvedAlerts().length
                }
            }
        };
        const statusCode = healthStatus.status === 'healthy' ? 200 :
            healthStatus.status === 'degraded' ? 200 : 503;
        Logger_1.logger.debug('MONITOR', 'Health check requested', {
            status: healthStatus.status,
            responseTime
        });
        res.status(statusCode).json(healthStatus);
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Health check failed', { error: error.message });
        res.status(503).json({
            status: 'error',
            message: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/ready', (req, res) => {
    res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
    });
});
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString()
    });
});
router.get('/metrics', auth_1.authenticateToken, (0, rbac_1.requireRole)('admin'), (req, res) => {
    try {
        const format = req.query.format || 'json';
        if (format === 'prometheus') {
            const metrics = PerformanceMonitor_1.performanceMonitor.exportMetrics('prometheus');
            res.set('Content-Type', 'text/plain');
            res.send(metrics);
        }
        else {
            const metrics = JSON.parse(PerformanceMonitor_1.performanceMonitor.exportMetrics('json'));
            res.json(metrics);
        }
        Logger_1.logger.info('MONITOR', 'Metrics exported', {
            format,
            userId: req.user?.id
        });
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Failed to export metrics', { error: error.message });
        res.status(500).json({
            error: 'Failed to export metrics',
            message: error.message
        });
    }
});
router.get('/health/detailed', auth_1.authenticateToken, (0, rbac_1.requireRole)('admin'), (req, res) => {
    try {
        const health = PerformanceMonitor_1.performanceMonitor.getSystemHealth();
        const alertSummary = AlertSystem_1.alertSystem.getAlertSummary();
        const detailedHealth = {
            timestamp: new Date().toISOString(),
            system: {
                uptime: health.uptime,
                memory: health.memoryUsage,
                cpu: health.cpuUsage,
                activeConnections: health.activeConnections
            },
            performance: {
                errorRate: health.errorRate,
                responseTimeP95: health.responseTimeP95,
                averageResponseTime: PerformanceMonitor_1.performanceMonitor.getAverageResponseTime(),
                recentErrorRate: PerformanceMonitor_1.performanceMonitor.getErrorRate()
            },
            alerts: alertSummary,
            recentMetrics: PerformanceMonitor_1.performanceMonitor.getMetrics(undefined, new Date(Date.now() - 60 * 60 * 1000))
        };
        res.json(detailedHealth);
        Logger_1.logger.info('MONITOR', 'Detailed health check requested', {
            userId: req.user?.id
        });
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Failed to get detailed health', { error: error.message });
        res.status(500).json({
            error: 'Failed to get detailed health information',
            message: error.message
        });
    }
});
router.get('/alerts', auth_1.authenticateToken, (0, rbac_1.requireRole)('admin'), (req, res) => {
    try {
        const { severity, resolved, since, limit = '50' } = req.query;
        const options = {
            limit: parseInt(limit, 10)
        };
        if (severity) {
            options.severity = severity;
        }
        if (resolved !== undefined) {
            options.resolved = resolved === 'true';
        }
        if (since) {
            options.since = new Date(since);
        }
        const alerts = AlertSystem_1.alertSystem.getAlerts(options);
        const summary = AlertSystem_1.alertSystem.getAlertSummary();
        res.json({
            alerts,
            summary,
            pagination: {
                limit: options.limit,
                count: alerts.length
            }
        });
        Logger_1.logger.info('MONITOR', 'Alerts retrieved', {
            count: alerts.length,
            userId: req.user?.id,
            filters: options
        });
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Failed to get alerts', { error: error.message });
        res.status(500).json({
            error: 'Failed to retrieve alerts',
            message: error.message
        });
    }
});
router.post('/alerts/:alertId/resolve', auth_1.authenticateToken, (0, rbac_1.requireRole)('admin'), (req, res) => {
    try {
        const { alertId } = req.params;
        const resolved = AlertSystem_1.alertSystem.resolveAlert(alertId);
        if (!resolved) {
            return res.status(404).json({
                error: 'Alert not found or already resolved'
            });
        }
        res.json({
            success: true,
            message: 'Alert resolved successfully'
        });
        Logger_1.logger.info('MONITOR', 'Alert resolved', {
            alertId,
            userId: req.user?.id
        });
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Failed to resolve alert', {
            error: error.message,
            alertId: req.params.alertId
        });
        res.status(500).json({
            error: 'Failed to resolve alert',
            message: error.message
        });
    }
});
router.post('/alerts', auth_1.authenticateToken, (0, rbac_1.requireRole)('admin'), (req, res) => {
    try {
        const { severity, title, message, metadata } = req.body;
        if (!severity || !title || !message) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['severity', 'title', 'message']
            });
        }
        const alert = AlertSystem_1.alertSystem.createAlert(severity, title, message, 'manual', {
            ...metadata,
            createdBy: req.user?.id
        });
        res.status(201).json(alert);
        Logger_1.logger.info('MONITOR', 'Manual alert created', {
            alertId: alert.id,
            severity: alert.severity,
            userId: req.user?.id
        });
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Failed to create alert', { error: error.message });
        res.status(500).json({
            error: 'Failed to create alert',
            message: error.message
        });
    }
});
router.get('/performance', auth_1.authenticateToken, (0, rbac_1.requireRole)('admin'), (req, res) => {
    try {
        const minutes = parseInt(req.query.minutes, 10) || 60;
        const stats = {
            timestamp: new Date().toISOString(),
            period: `${minutes} minutes`,
            averageResponseTime: PerformanceMonitor_1.performanceMonitor.getAverageResponseTime(minutes),
            errorRate: PerformanceMonitor_1.performanceMonitor.getErrorRate(minutes),
            systemHealth: PerformanceMonitor_1.performanceMonitor.getSystemHealth(),
            recentMetrics: PerformanceMonitor_1.performanceMonitor.getMetrics(undefined, new Date(Date.now() - minutes * 60 * 1000)).slice(-20)
        };
        res.json(stats);
        Logger_1.logger.debug('MONITOR', 'Performance stats requested', {
            minutes,
            userId: req.user?.id
        });
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Failed to get performance stats', { error: error.message });
        res.status(500).json({
            error: 'Failed to get performance statistics',
            message: error.message
        });
    }
});
router.post('/logs/rotate', auth_1.authenticateToken, (0, rbac_1.requireRole)('admin'), (req, res) => {
    try {
        Logger_1.logger.rotateLogs();
        res.json({
            success: true,
            message: 'Log rotation initiated'
        });
        Logger_1.logger.info('MONITOR', 'Manual log rotation initiated', {
            userId: req.user?.id
        });
    }
    catch (error) {
        Logger_1.logger.error('MONITOR', 'Failed to rotate logs', { error: error.message });
        res.status(500).json({
            error: 'Failed to rotate logs',
            message: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=monitoring.js.map