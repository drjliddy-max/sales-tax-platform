/**
 * Integration Tests for Monitoring System
 * Tests logging, performance monitoring, and alert systems
 */

import request from 'supertest';
import express from 'express';
import { logger } from '../../lib/logging/Logger';
import { performanceMonitor } from '../../lib/monitoring/PerformanceMonitor';
import { alertSystem, AlertSeverity } from '../../lib/monitoring/AlertSystem';
import monitoringRoutes from '../../routes/monitoring';
import { authenticateToken } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

// Mock middleware for testing
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'test-user', role: 'admin' };
  next();
};

const mockRequireRole = (role: string) => (req: any, res: any, next: any) => {
  if (req.user?.role === role) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions' });
  }
};

// Setup test app
const app = express();
app.use(express.json());
app.use('/api/monitoring', monitoringRoutes);

// Override middleware for testing
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => mockAuth(req, res, next))
}));

jest.mock('../../middleware/rbac', () => ({
  requireRole: jest.fn((role: string) => mockRequireRole(role))
}));

describe('Monitoring System Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing metrics/alerts
    performanceMonitor['metrics'] = [];
    performanceMonitor['responseTimes'] = [];
    performanceMonitor['errorCount'] = 0;
    performanceMonitor['requestCount'] = 0;
    alertSystem['alerts'] = [];
  });

  describe('Logger', () => {
    it('should log messages with different levels', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('TEST', 'Test info message', { test: true });
      logger.warn('TEST', 'Test warning message');
      logger.error('TEST', 'Test error message', { error: 'details' });

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('should log POS operations', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.posOperation('sync', 'pos-123', 'success', { records: 10 }, 'user-1', 'req-1');
      logger.posOperation('connect', 'pos-456', 'error', { error: 'timeout' }, 'user-2', 'req-2');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    it('should track API requests', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.apiRequest('GET', '/api/test', 200, 150, 'user-1', 'req-1');
      logger.apiRequest('POST', '/api/error', 500, 300, 'user-2', 'req-2');

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });
  });

  describe('Performance Monitor', () => {
    it('should record metrics', () => {
      performanceMonitor.recordMetric('test_metric', 100, { tag: 'value' });
      
      const metrics = performanceMonitor.getMetrics('test_metric');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test_metric');
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].tags?.tag).toBe('value');
    });

    it('should track request/response cycles', () => {
      performanceMonitor.recordRequest();
      performanceMonitor.recordResponse(200, 150);
      
      const health = performanceMonitor.getSystemHealth();
      expect(health.activeConnections).toBe(0);
    });

    it('should handle timer operations', () => {
      performanceMonitor.startTimer('test_timer');
      
      // Simulate some work
      setTimeout(() => {
        const duration = performanceMonitor.endTimer('test_timer');
        expect(duration).toBeGreaterThan(0);
        
        const metrics = performanceMonitor.getMetrics('test_timer_duration');
        expect(metrics).toHaveLength(1);
      }, 10);
    });

    it('should record POS operations', () => {
      performanceMonitor.recordPOSOperation('sync', 'pos-123', 250, true);
      performanceMonitor.recordPOSOperation('connect', 'pos-456', 500, false);
      
      const syncMetrics = performanceMonitor.getMetrics('pos_operation_duration');
      expect(syncMetrics).toHaveLength(2);
    });

    it('should export metrics in different formats', () => {
      performanceMonitor.recordMetric('test_export', 42);
      
      const jsonExport = performanceMonitor.exportMetrics('json');
      const jsonData = JSON.parse(jsonExport);
      expect(jsonData.metrics).toBeDefined();
      
      const prometheusExport = performanceMonitor.exportMetrics('prometheus');
      expect(prometheusExport).toContain('# HELP');
      expect(prometheusExport).toContain('# TYPE');
    });
  });

  describe('Alert System', () => {
    it('should create and resolve alerts', () => {
      const alert = alertSystem.createAlert(
        AlertSeverity.WARNING,
        'Test Alert',
        'This is a test alert',
        'test',
        { testData: true }
      );

      expect(alert.severity).toBe(AlertSeverity.WARNING);
      expect(alert.title).toBe('Test Alert');
      expect(alert.resolved).toBeUndefined();

      const resolved = alertSystem.resolveAlert(alert.id);
      expect(resolved).toBe(true);

      const resolvedAlert = alertSystem.getAlerts().find(a => a.id === alert.id);
      expect(resolvedAlert?.resolved).toBe(true);
    });

    it('should evaluate alert rules', () => {
      // Add test rule
      alertSystem.addRule({
        id: 'test-rule',
        name: 'Test Rule',
        condition: (data) => data.testValue > 100,
        severity: AlertSeverity.ERROR,
        message: 'Test value exceeded threshold',
        cooldownMs: 1000,
        enabled: true
      });

      // Trigger the rule
      alertSystem.evaluateRules({ testValue: 150 });

      const alerts = alertSystem.getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].title).toBe('Test Rule');
    });

    it('should respect rule cooldowns', () => {
      alertSystem.addRule({
        id: 'cooldown-test',
        name: 'Cooldown Test',
        condition: (data) => data.trigger === true,
        severity: AlertSeverity.INFO,
        message: 'Cooldown test alert',
        cooldownMs: 5000, // 5 second cooldown
        enabled: true
      });

      // First trigger
      alertSystem.evaluateRules({ trigger: true });
      expect(alertSystem.getAlerts()).toHaveLength(1);

      // Second trigger (should be blocked by cooldown)
      alertSystem.evaluateRules({ trigger: true });
      expect(alertSystem.getAlerts()).toHaveLength(1);
    });

    it('should filter alerts by criteria', () => {
      alertSystem.createAlert(AlertSeverity.INFO, 'Info Alert', 'Info message', 'test');
      alertSystem.createAlert(AlertSeverity.WARNING, 'Warning Alert', 'Warning message', 'test');
      alertSystem.createAlert(AlertSeverity.ERROR, 'Error Alert', 'Error message', 'test');

      const warningAlerts = alertSystem.getAlerts({ severity: AlertSeverity.WARNING });
      expect(warningAlerts).toHaveLength(1);
      expect(warningAlerts[0].severity).toBe(AlertSeverity.WARNING);

      const unresolvedAlerts = alertSystem.getUnresolvedAlerts();
      expect(unresolvedAlerts).toHaveLength(3);
    });

    it('should generate alert summary', () => {
      alertSystem.createAlert(AlertSeverity.CRITICAL, 'Critical 1', 'Critical message', 'test');
      alertSystem.createAlert(AlertSeverity.CRITICAL, 'Critical 2', 'Critical message', 'test');
      alertSystem.createAlert(AlertSeverity.WARNING, 'Warning 1', 'Warning message', 'test');

      const summary = alertSystem.getAlertSummary();
      expect(summary.total).toBe(3);
      expect(summary.unresolved).toBe(3);
      expect(summary.bySeverity.critical).toBe(2);
      expect(summary.bySeverity.warning).toBe(1);
    });
  });

  describe('Monitoring API Routes', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body.status).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.checks).toBeDefined();
      expect(response.body.checks.memory).toBeDefined();
      expect(response.body.checks.api).toBeDefined();
      expect(response.body.checks.alerts).toBeDefined();
    });

    it('should return readiness and liveness probes', async () => {
      await request(app)
        .get('/api/monitoring/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ready');
        });

      await request(app)
        .get('/api/monitoring/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('alive');
        });
    });

    it('should export metrics (admin only)', async () => {
      // Add some test metrics
      performanceMonitor.recordMetric('test_api_metric', 123);

      const jsonResponse = await request(app)
        .get('/api/monitoring/metrics')
        .expect(200);

      expect(jsonResponse.body.metrics).toBeDefined();

      const prometheusResponse = await request(app)
        .get('/api/monitoring/metrics?format=prometheus')
        .expect(200);

      expect(prometheusResponse.text).toContain('# HELP');
    });

    it('should return detailed health information (admin only)', async () => {
      const response = await request(app)
        .get('/api/monitoring/health/detailed')
        .expect(200);

      expect(response.body.system).toBeDefined();
      expect(response.body.performance).toBeDefined();
      expect(response.body.alerts).toBeDefined();
      expect(response.body.recentMetrics).toBeDefined();
    });

    it('should manage alerts via API', async () => {
      // Create an alert
      const createResponse = await request(app)
        .post('/api/monitoring/alerts')
        .send({
          severity: 'warning',
          title: 'API Test Alert',
          message: 'This is a test alert created via API',
          metadata: { test: true }
        })
        .expect(201);

      expect(createResponse.body.title).toBe('API Test Alert');

      // List alerts
      const listResponse = await request(app)
        .get('/api/monitoring/alerts')
        .expect(200);

      expect(listResponse.body.alerts).toHaveLength(1);
      expect(listResponse.body.summary).toBeDefined();

      // Resolve alert
      const alertId = createResponse.body.id;
      await request(app)
        .post(`/api/monitoring/alerts/${alertId}/resolve`)
        .expect(200);

      // Verify resolution
      const updatedListResponse = await request(app)
        .get('/api/monitoring/alerts')
        .expect(200);

      const resolvedAlert = updatedListResponse.body.alerts.find((a: any) => a.id === alertId);
      expect(resolvedAlert.resolved).toBe(true);
    });

    it('should return performance statistics', async () => {
      // Record some performance data
      performanceMonitor.recordRequest();
      performanceMonitor.recordResponse(200, 150);
      performanceMonitor.recordRequest();
      performanceMonitor.recordResponse(500, 300);

      const response = await request(app)
        .get('/api/monitoring/performance?minutes=5')
        .expect(200);

      expect(response.body.averageResponseTime).toBeDefined();
      expect(response.body.errorRate).toBeDefined();
      expect(response.body.systemHealth).toBeDefined();
      expect(response.body.recentMetrics).toBeDefined();
    });

    it('should handle log rotation', async () => {
      const response = await request(app)
        .post('/api/monitoring/logs/rotate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Log rotation initiated');
    });
  });

  describe('Error Handling', () => {
    it('should handle monitoring errors gracefully', async () => {
      // Mock an error in performance monitor
      const originalGetSystemHealth = performanceMonitor.getSystemHealth;
      performanceMonitor.getSystemHealth = jest.fn().mockImplementation(() => {
        throw new Error('Monitoring system error');
      });

      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Health check failed');

      // Restore original method
      performanceMonitor.getSystemHealth = originalGetSystemHealth;
    });

    it('should handle invalid alert resolution', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts/invalid-id/resolve')
        .expect(404);

      expect(response.body.error).toBe('Alert not found or already resolved');
    });

    it('should validate required fields for manual alerts', async () => {
      const response = await request(app)
        .post('/api/monitoring/alerts')
        .send({
          // Missing required fields
          title: 'Incomplete Alert'
        })
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
      expect(response.body.required).toContain('severity');
      expect(response.body.required).toContain('message');
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      
      // Generate multiple concurrent health check requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/monitoring/health')
            .expect(200)
        );
      }

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.body.status).toBeDefined();
      });
    });

    it('should handle large numbers of metrics', () => {
      const startTime = Date.now();
      
      // Record 1000 metrics
      for (let i = 0; i < 1000; i++) {
        performanceMonitor.recordMetric(`test_metric_${i}`, Math.random() * 100);
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.length).toBe(1000);
    });
  });
});

export {};
