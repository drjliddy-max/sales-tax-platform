import express from 'express';
import { ComprehensiveReportingService } from '../../services/ComprehensiveReportingService';
import { AdvancedExportService } from '../../services/reporting/AdvancedExportService';
import { RevenueAnalyticsService } from '../../services/RevenueAnalyticsService';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Simple auth middleware for development
const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // In development mode, allow all requests
  // In production, this would validate JWT tokens
  (req as any).user = { 
    sub: 'admin-user', 
    app_metadata: { 
      role: 'admin',
      businessId: 'demo-business',
      permissions: ['admin', 'read:reports', 'write:reports', 'export:reports']
    } 
  };
  next();
};

const requirePermission = (permission: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // In development mode, allow all permissions
    // In production, this would check actual user permissions
    if (permission === 'export:reports' || permission === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
};

// Initialize services
const reportingService = new ComprehensiveReportingService();
const exportService = new AdvancedExportService();

/**
 * @route POST /api/advanced-export/executive-pdf
 * @desc Generate advanced executive PDF report with charts and professional styling
 * @access Private (requires export:reports permission)
 */
router.post('/executive-pdf', auth, requirePermission('export:reports'), async (req, res) => {
  try {
    const { start_date, end_date, include_charts = true, branding_enabled = true } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    const reportData = await reportingService.generateExecutiveReport(startDate, endDate, { 
      format: 'json' 
    });

    const result = await reportingService.generateAdvancedPDFReport(reportData, 'executive', {
      includeCharts: include_charts,
      brandingEnabled: branding_enabled,
      compression: true
    });

    res.json({
      success: true,
      message: 'Advanced PDF report generated successfully',
      data: {
        filePath: result.filePath,
        fileName: result.fileName,
        downloadUrl: `/api/advanced-export/download/${encodeURIComponent(result.fileName)}`
      }
    });

  } catch (error) {
    console.error('Error generating advanced PDF report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF report'
    });
  }
});

/**
 * @route POST /api/advanced-export/executive-excel
 * @desc Generate advanced executive Excel report with multiple sheets and charts
 * @access Private (requires export:reports permission)
 */
router.post('/executive-excel', auth, requirePermission('export:reports'), async (req, res) => {
  try {
    const { start_date, end_date, include_charts = true, branding_enabled = true, compression = true } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    const reportData = await reportingService.generateExecutiveReport(startDate, endDate, { 
      format: 'json' 
    });

    const result = await reportingService.generateAdvancedExcelReport(reportData, 'executive', {
      includeCharts: include_charts,
      brandingEnabled: branding_enabled,
      compression
    });

    res.json({
      success: true,
      message: 'Advanced Excel report generated successfully',
      data: {
        filePath: result.filePath,
        fileName: result.fileName,
        downloadUrl: `/api/advanced-export/download/${encodeURIComponent(result.fileName)}`
      }
    });

  } catch (error) {
    console.error('Error generating advanced Excel report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate Excel report'
    });
  }
});

/**
 * @route POST /api/advanced-export/board-pdf
 * @desc Generate advanced board PDF report for quarterly reviews
 * @access Private (requires export:reports permission)
 */
router.post('/board-pdf', auth, requirePermission('export:reports'), async (req, res) => {
  try {
    const { quarter, year, include_charts = true, branding_enabled = true } = req.body;

    if (!quarter || !year) {
      return res.status(400).json({
        success: false,
        error: 'quarter and year are required'
      });
    }

    if (quarter < 1 || quarter > 4) {
      return res.status(400).json({
        success: false,
        error: 'quarter must be between 1 and 4'
      });
    }

    const reportData = await reportingService.generateBoardReport(quarter, year);

    const result = await reportingService.generateAdvancedPDFReport(reportData, 'board', {
      includeCharts: include_charts,
      brandingEnabled: branding_enabled,
      compression: true
    });

    res.json({
      success: true,
      message: 'Advanced board PDF report generated successfully',
      data: {
        filePath: result.filePath,
        fileName: result.fileName,
        downloadUrl: `/api/advanced-export/download/${encodeURIComponent(result.fileName)}`
      }
    });

  } catch (error) {
    console.error('Error generating board PDF report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate board PDF report'
    });
  }
});

/**
 * @route POST /api/advanced-export/custom-report
 * @desc Generate custom report with specified configuration
 * @access Private (requires export:reports permission)
 */
router.post('/custom-report', auth, requirePermission('export:reports'), async (req, res) => {
  try {
    const { 
      title,
      subtitle,
      start_date,
      end_date,
      format = 'pdf',
      sections = [],
      charts = [],
      include_charts = true,
      branding_enabled = true,
      compression = true
    } = req.body;

    if (!title || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'title, start_date, and end_date are required'
      });
    }

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Get base report data
    const reportData = await reportingService.generateExecutiveReport(startDate, endDate, { 
      format: 'json' 
    });

    // Customize report data based on request
    const baseData = typeof reportData === 'object' && reportData !== null && 'period' in reportData 
      ? reportData as any : {};
      
    const customReportData = {
      ...baseData,
      title,
      subtitle,
      sections: sections.length > 0 ? sections : (baseData.sections || []),
      charts: charts.length > 0 ? charts : (baseData.charts || [])
    };

    let result;
    if (format === 'excel') {
      result = await reportingService.generateAdvancedExcelReport(customReportData, 'custom', {
        includeCharts: include_charts,
        brandingEnabled: branding_enabled,
        compression
      });
    } else {
      result = await reportingService.generateAdvancedPDFReport(customReportData, 'custom', {
        includeCharts: include_charts,
        brandingEnabled: branding_enabled,
        compression
      });
    }

    res.json({
      success: true,
      message: `Custom ${format.toUpperCase()} report generated successfully`,
      data: {
        filePath: result.filePath,
        fileName: result.fileName,
        downloadUrl: `/api/advanced-export/download/${encodeURIComponent(result.fileName)}`
      }
    });

  } catch (error) {
    console.error('Error generating custom report:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate custom report'
    });
  }
});

/**
 * @route GET /api/advanced-export/chart/:type
 * @desc Generate standalone chart image
 * @access Private (requires export:reports permission)
 */
router.get('/chart/:type', auth, requirePermission('export:reports'), async (req, res) => {
  try {
    const { type } = req.params;
    const { start_date, end_date, width = 800, height = 600 } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      });
    }

    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    let chartConfig;
    
    switch (type) {
      case 'revenue-by-stream':
        const revenueByStream = await RevenueAnalyticsService.getRevenueByStream(startDate, endDate);
        chartConfig = {
          type: 'bar' as const,
          data: {
            labels: revenueByStream.map((stream: any) => stream.name || 'Unknown'),
            datasets: [
              {
                label: 'Revenue',
                data: revenueByStream.map((stream: any) => stream.totalRevenue || 0),
                backgroundColor: '#2563eb',
                borderColor: '#1d4ed8',
                borderWidth: 1
              }
            ]
          },
          options: {
            responsive: false,
            plugins: {
              title: {
                display: true,
                text: 'Revenue by Stream'
              }
            }
          }
        };
        break;
        
      case 'revenue-trend':
        // Get monthly revenue data for the period
        const months = [];
        const revenues = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
          const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
          const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
          
          const summary = await RevenueAnalyticsService.getRevenueSummary(monthStart, monthEnd);
          months.push(monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
          revenues.push(summary.totalRevenue || 0);
          
          current.setMonth(current.getMonth() + 1);
        }
        
        chartConfig = {
          type: 'line' as const,
          data: {
            labels: months,
            datasets: [
              {
                label: 'Revenue Trend',
                data: revenues,
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderColor: '#2563eb',
                borderWidth: 2,
                fill: true
              }
            ]
          },
          options: {
            responsive: false,
            plugins: {
              title: {
                display: true,
                text: 'Revenue Trend Over Time'
              }
            }
          }
        };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid chart type. Available: revenue-by-stream, revenue-trend'
        });
    }

    const chartBuffer = await exportService.generateChart(chartConfig);
    
    // Validate that the buffer is actually an image and not user-controlled content
    if (!Buffer.isBuffer(chartBuffer) || chartBuffer.length === 0) {
      throw new Error('Invalid chart data generated');
    }
    
    // Validate that the buffer starts with PNG magic bytes
    const pngMagicBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (!chartBuffer.subarray(0, 8).equals(pngMagicBytes)) {
      throw new Error('Generated content is not a valid PNG image');
    }
    
    // Sanitize the type parameter for filename
    const sanitizedType = type.replace(/[^a-zA-Z0-9-]/g, '');
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': chartBuffer.length,
      'Content-Disposition': `attachment; filename="${sanitizedType}-chart.png"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff'
    });
    
    res.send(chartBuffer);

  } catch (error) {
    console.error('Error generating chart:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate chart'
    });
  }
});

/**
 * @route GET /api/advanced-export/download/:filename
 * @desc Download generated report file
 * @access Private (requires export:reports permission)
 */
router.get('/download/:filename', auth, requirePermission('export:reports'), async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Comprehensive filename sanitization to prevent path traversal
    const sanitizedFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '');
    
    // Additional validation
    if (!sanitizedFilename || sanitizedFilename.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }
    
    // Validate file extension
    const allowedExtensions = ['.pdf', '.xlsx', '.png', '.csv'];
    const fileExtension = path.extname(sanitizedFilename).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        success: false,
        error: 'File type not allowed'
      });
    }
    
    // Construct secure file path
    const reportsDir = path.resolve(process.cwd(), 'reports');
    const filePath = path.join(reportsDir, sanitizedFilename);
    
    // Ensure the resolved path is within the reports directory (prevent directory traversal)
    if (!filePath.startsWith(reportsDir)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileExtension = path.extname(sanitizedFilename).toLowerCase();
    
    // Set appropriate content type
    let contentType = 'application/octet-stream';
    if (fileExtension === '.pdf') {
      contentType = 'application/pdf';
    } else if (fileExtension === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fileExtension === '.png') {
      contentType = 'image/png';
    }
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Content-Disposition': `attachment; filename="${sanitizedFilename}"`
    });
    
    // Stream the file
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download file'
    });
  }
});

/**
 * @route POST /api/advanced-export/cleanup
 * @desc Clean up old export files
 * @access Private (admin only)
 */
router.post('/cleanup', auth, requirePermission('admin'), async (req, res) => {
  try {
    const { max_age_hours = 24 } = req.body;
    
    await reportingService.cleanupOldReports(max_age_hours);
    
    res.json({
      success: true,
      message: `Cleaned up export files older than ${max_age_hours} hours`
    });
    
  } catch (error) {
    console.error('Error cleaning up files:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup files'
    });
  }
});

/**
 * @route GET /api/advanced-export/formats
 * @desc Get available export formats and chart types
 * @access Private (requires export:reports permission)
 */
router.get('/formats', auth, requirePermission('export:reports'), async (req, res) => {
  try {
    const formats = {
      reportFormats: ['pdf', 'excel'],
      chartTypes: [
        'revenue-by-stream',
        'revenue-trend',
        'mrr-growth',
        'customer-distribution'
      ],
      exportOptions: {
        includeCharts: 'boolean - Include charts in reports',
        brandingEnabled: 'boolean - Include company branding',
        compression: 'boolean - Compress files for smaller size'
      },
      templates: [
        'executive',
        'board',
        'operational',
        'financial',
        'custom'
      ]
    };
    
    res.json({
      success: true,
      data: formats
    });
    
  } catch (error) {
    console.error('Error getting formats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get export formats'
    });
  }
});

export default router;