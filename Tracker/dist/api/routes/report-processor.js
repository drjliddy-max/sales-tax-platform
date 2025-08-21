"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ReportProcessor_1 = require("../../services/reporting/ReportProcessor");
const ReportProcessorInitializer_1 = require("../../services/startup/ReportProcessorInitializer");
const mongoose_1 = __importDefault(require("mongoose"));
const auth = (req, res, next) => {
    req.user = {
        sub: 'admin-user',
        app_metadata: {
            role: 'admin',
            businessId: 'demo-business',
            permissions: ['admin', 'read:reports', 'write:reports']
        }
    };
    next();
};
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (permission === 'admin') {
            next();
        }
        else {
            res.status(403).json({ error: 'Insufficient permissions' });
        }
    };
};
const router = express_1.default.Router();
router.get('/status', auth, requirePermission('admin'), async (req, res) => {
    try {
        const status = await ReportProcessor_1.reportProcessor.getDetailedStatus();
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
        console.error('Error getting report processor status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get report processor status'
        });
    }
});
router.post('/process-now', auth, requirePermission('admin'), async (req, res) => {
    try {
        const stats = await ReportProcessor_1.reportProcessor.processNow();
        res.json({
            success: true,
            message: 'Report processing completed',
            data: stats
        });
    }
    catch (error) {
        console.error('Error in manual report processing:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process reports'
        });
    }
});
router.post('/process-report/:id', auth, requirePermission('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid report ID format'
            });
        }
        const stats = await ReportProcessor_1.reportProcessor.processSpecificReport(id);
        res.json({
            success: true,
            message: 'Report processed successfully',
            data: stats
        });
    }
    catch (error) {
        console.error('Error processing specific report:', error);
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to process report'
        });
    }
});
router.get('/health', auth, requirePermission('admin'), async (req, res) => {
    try {
        const status = ReportProcessor_1.reportProcessor.getStatus();
        const isHealthy = status.isRunning && ReportProcessorInitializer_1.reportProcessorInitializer.isInitialized();
        const healthData = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            processor: status,
            initialized: ReportProcessorInitializer_1.reportProcessorInitializer.isInitialized(),
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
        res.status(isHealthy ? 200 : 503).json({
            success: isHealthy,
            data: healthData
        });
    }
    catch (error) {
        console.error('Error in health check:', error);
        res.status(503).json({
            success: false,
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});
router.post('/restart', auth, requirePermission('admin'), async (req, res) => {
    try {
        ReportProcessor_1.reportProcessor.stop();
        await new Promise(resolve => setTimeout(resolve, 1000));
        ReportProcessor_1.reportProcessor.start();
        const status = ReportProcessor_1.reportProcessor.getStatus();
        res.json({
            success: true,
            message: 'Report processor restarted successfully',
            data: status
        });
    }
    catch (error) {
        console.error('Error restarting report processor:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to restart report processor'
        });
    }
});
router.get('/metrics', auth, requirePermission('admin'), async (req, res) => {
    try {
        const status = await ReportProcessor_1.reportProcessor.getDetailedStatus();
        const ReportHistory = (await Promise.resolve().then(() => __importStar(require('../../models/ReportHistory')))).ReportHistory;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [totalReportsToday, successfulReportsToday, failedReportsToday, averageProcessingTime] = await Promise.all([
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
    }
    catch (error) {
        console.error('Error getting report processor metrics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get metrics'
        });
    }
});
exports.default = router;
//# sourceMappingURL=report-processor.js.map