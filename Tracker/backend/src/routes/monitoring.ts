/**
 * Monitoring API Routes
 * Provides endpoints for health checks, metrics, and alerts
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { performanceMonitor } from '../lib/monitoring/PerformanceMonitor';
import { alertSystem, AlertSeverity } from '../lib/monitoring/AlertSystem';
import { logger } from '../lib/logging/Logger';

const router = Router();

// Health check endpoint (public)
router.get('/health', (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const health = performanceMonitor.getSystemHealth();
    const alerts = alertSystem.getCriticalAlerts();
    
    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: alerts.length > 0 ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(health.uptime / 1000),
      responseTime,
      checks: {
        memory: {
          status: health.memoryUsage.used < 1024 * 1024 * 1024 ? 'ok' : 'warning', // 1GB
          used: Math.round(health.memoryUsage.used / 1024 / 1024), // MB
          total: Math.round(health.memoryUsage.total / 1024 / 1024) // MB
        },
        api: {
          status: health.errorRate < 0.05 ? 'ok' : 'error',
          errorRate: Math.round(health.errorRate * 10000) / 100, // Percentage with 2 decimals
          averageResponseTime: Math.round(health.responseTimeP95)
        },
        alerts: {
          status: alerts.length === 0 ? 'ok' : 'critical',
          criticalCount: alerts.length,
          totalUnresolved: alertSystem.getUnresolvedAlerts().length
        }
      }
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    logger.debug('MONITOR', 'Health check requested', {
      status: healthStatus.status,
      responseTime
    });

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error('MONITOR', 'Health check failed', { error: error.message });
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Simple readiness probe
router.get('/ready', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
});

// Simple liveness probe
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

// Detailed metrics (admin only)
router.get('/metrics', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const format = req.query.format as string || 'json';
    
    if (format === 'prometheus') {
      const metrics = performanceMonitor.exportMetrics('prometheus');
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } else {
      const metrics = JSON.parse(performanceMonitor.exportMetrics('json'));
      res.json(metrics);
    }

    logger.info('MONITOR', 'Metrics exported', {
      format,
      userId: req.user?.id
    });
  } catch (error) {
    logger.error('MONITOR', 'Failed to export metrics', { error: error.message });
    res.status(500).json({
      error: 'Failed to export metrics',
      message: error.message
    });
  }
});

// System health details (admin only)
router.get('/health/detailed', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const health = performanceMonitor.getSystemHealth();
    const alertSummary = alertSystem.getAlertSummary();
    
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
        averageResponseTime: performanceMonitor.getAverageResponseTime(),
        recentErrorRate: performanceMonitor.getErrorRate()
      },
      alerts: alertSummary,
      recentMetrics: performanceMonitor.getMetrics(undefined, new Date(Date.now() - 60 * 60 * 1000)) // Last hour
    };

    res.json(detailedHealth);

    logger.info('MONITOR', 'Detailed health check requested', {
      userId: req.user?.id
    });
  } catch (error) {
    logger.error('MONITOR', 'Failed to get detailed health', { error: error.message });
    res.status(500).json({
      error: 'Failed to get detailed health information',
      message: error.message
    });
  }
});

// Alerts endpoints
router.get('/alerts', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const {
      severity,
      resolved,
      since,
      limit = '50'
    } = req.query;

    const options: any = {
      limit: parseInt(limit as string, 10)
    };

    if (severity) {
      options.severity = severity as AlertSeverity;
    }

    if (resolved !== undefined) {
      options.resolved = resolved === 'true';
    }

    if (since) {
      options.since = new Date(since as string);
    }

    const alerts = alertSystem.getAlerts(options);
    const summary = alertSystem.getAlertSummary();

    res.json({
      alerts,
      summary,
      pagination: {
        limit: options.limit,
        count: alerts.length
      }
    });

    logger.info('MONITOR', 'Alerts retrieved', {
      count: alerts.length,
      userId: req.user?.id,
      filters: options
    });
  } catch (error) {
    logger.error('MONITOR', 'Failed to get alerts', { error: error.message });
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      message: error.message
    });
  }
});

// Resolve alert
router.post('/alerts/:alertId/resolve', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const resolved = alertSystem.resolveAlert(alertId);

    if (!resolved) {
      return res.status(404).json({
        error: 'Alert not found or already resolved'
      });
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });

    logger.info('MONITOR', 'Alert resolved', {
      alertId,
      userId: req.user?.id
    });
  } catch (error) {
    logger.error('MONITOR', 'Failed to resolve alert', { 
      error: error.message,
      alertId: req.params.alertId
    });
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error.message
    });
  }
});

// Create manual alert (admin only)
router.post('/alerts', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { severity, title, message, metadata } = req.body;

    if (!severity || !title || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['severity', 'title', 'message']
      });
    }

    const alert = alertSystem.createAlert(
      severity as AlertSeverity,
      title,
      message,
      'manual',
      {
        ...metadata,
        createdBy: req.user?.id
      }
    );

    res.status(201).json(alert);

    logger.info('MONITOR', 'Manual alert created', {
      alertId: alert.id,
      severity: alert.severity,
      userId: req.user?.id
    });
  } catch (error) {
    logger.error('MONITOR', 'Failed to create alert', { error: error.message });
    res.status(500).json({
      error: 'Failed to create alert',
      message: error.message
    });
  }
});

// Performance statistics
router.get('/performance', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  try {
    const minutes = parseInt(req.query.minutes as string, 10) || 60;
    
    const stats = {
      timestamp: new Date().toISOString(),
      period: `${minutes} minutes`,
      averageResponseTime: performanceMonitor.getAverageResponseTime(minutes),
      errorRate: performanceMonitor.getErrorRate(minutes),
      systemHealth: performanceMonitor.getSystemHealth(),
      recentMetrics: performanceMonitor.getMetrics(
        undefined, 
        new Date(Date.now() - minutes * 60 * 1000)
      ).slice(-20) // Last 20 metrics
    };

    res.json(stats);

    logger.debug('MONITOR', 'Performance stats requested', {
      minutes,
      userId: req.user?.id
    });
  } catch (error) {
    logger.error('MONITOR', 'Failed to get performance stats', { error: error.message });
    res.status(500).json({
      error: 'Failed to get performance statistics',
      message: error.message
    });
  }
});

// Log rotation endpoint (admin only)
router.post('/logs/rotate', authenticateToken, requireRole('admin'), (req: Request, res: Response) => {
  try {
    logger.rotateLogs();
    
    res.json({
      success: true,
      message: 'Log rotation initiated'
    });

    logger.info('MONITOR', 'Manual log rotation initiated', {
      userId: req.user?.id
    });
  } catch (error) {
    logger.error('MONITOR', 'Failed to rotate logs', { error: error.message });
    res.status(500).json({
      error: 'Failed to rotate logs',
      message: error.message
    });
  }
});

export default router;
