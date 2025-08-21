import express from 'express';
import { reportProcessor } from '../../services/reporting/ReportProcessor';
import { reportProcessorInitializer } from '../../services/startup/ReportProcessorInitializer';
import mongoose from 'mongoose';

// Simple auth middleware for development
const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // In development mode, allow all requests
  // In production, this would validate JWT tokens
  (req as any).user = { 
    sub: 'admin-user', 
    app_metadata: { 
      role: 'admin',
      businessId: 'demo-business',
      permissions: ['admin', 'read:reports', 'write:reports']
    } 
  };
  next();
};

const requirePermission = (permission: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // In development mode, allow all permissions
    // In production, this would check actual user permissions
    if (permission === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
};

const router = express.Router();

/**
 * @route GET /api/report-processor/status
 * @desc Get report processor status
 * @access Private (admin only)
 */
router.get('/status', auth, requirePermission('admin'), async (req, res) => {
  try {
    const status = await reportProcessor.getDetailedStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting report processor status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get report processor status'
    });
  }
});

/**
 * @route POST /api/report-processor/process-now
 * @desc Manually trigger report processing
 * @access Private (admin only)
 */
router.post('/process-now', auth, requirePermission('admin'), async (req, res) => {
  try {
    const stats = await reportProcessor.processNow();
    
    res.json({
      success: true,
      message: 'Report processing completed',
      data: stats
    });
  } catch (error) {
    console.error('Error in manual report processing:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process reports'
    });
  }
});

/**
 * @route POST /api/report-processor/process-report/:id
 * @desc Force process a specific scheduled report
 * @access Private (admin only)
 */
router.post('/process-report/:id', auth, requirePermission('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report ID format'
      });
    }

    const stats = await reportProcessor.processSpecificReport(id);
    
    res.json({
      success: true,
      message: 'Report processed successfully',
      data: stats
    });
  } catch (error) {
    console.error('Error processing specific report:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process report'
    });
  }
});

/**
 * @route GET /api/report-processor/health
 * @desc Health check for report processor
 * @access Private (admin only)
 */
router.get('/health', auth, requirePermission('admin'), async (req, res) => {
  try {
    const status = reportProcessor.getStatus();
    const isHealthy = status.isRunning && reportProcessorInitializer.isInitialized();
    
    const healthData = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      processor: status,
      initialized: reportProcessorInitializer.isInitialized(),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: healthData
    });
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/report-processor/restart
 * @desc Restart the report processor
 * @access Private (admin only)
 */
router.post('/restart', auth, requirePermission('admin'), async (req, res) => {
  try {
    // Stop the processor
    reportProcessor.stop();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start it again
    reportProcessor.start();
    
    const status = reportProcessor.getStatus();
    
    res.json({
      success: true,
      message: 'Report processor restarted successfully',
      data: status
    });
  } catch (error) {
    console.error('Error restarting report processor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restart report processor'
    });
  }
});

/**
 * @route GET /api/report-processor/metrics
 * @desc Get detailed metrics about report processing
 * @access Private (admin only)
 */
router.get('/metrics', auth, requirePermission('admin'), async (req, res) => {
  try {
    const status = await reportProcessor.getDetailedStatus();
    
    // Get additional metrics from report history
    const ReportHistory = (await import('../../models/ReportHistory')).ReportHistory;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      totalReportsToday,
      successfulReportsToday,
      failedReportsToday,
      averageProcessingTime
    ] = await Promise.all([
      ReportHistory.countDocuments({
        generatedAt: { $gte: today }
      }),
      ReportHistory.countDocuments({
        generatedAt: { $gte: today },
        status: 'completed'
      }),
      ReportHistory.countDocuments({
        generatedAt: { $gte: today },
        status: 'failed'
      }),
      ReportHistory.aggregate([
        {
          $match: {
            generatedAt: { $gte: today },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$generationTimeMs' }
          }
        }
      ])
    ]);

    const metrics = {
      processor: status,
      today: {
        totalReports: totalReportsToday,
        successful: successfulReportsToday,
        failed: failedReportsToday,
        successRate: totalReportsToday > 0 ? (successfulReportsToday / totalReportsToday * 100).toFixed(2) : 0
      },
      performance: {
        averageProcessingTimeMs: averageProcessingTime[0]?.avgTime || 0
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error getting report processor metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics'
    });
  }
});

export default router;