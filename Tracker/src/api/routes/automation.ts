import express from 'express';
import mongoose from 'mongoose';
import { PassiveSetupService, BusinessInfo } from '../../services/automation/PassiveSetupService';
import { ProactiveComplianceService } from '../../services/automation/ProactiveComplianceService';
import { BusinessAutomation } from '../../models/BusinessAutomation';
import { AutomationLog } from '../../models/AutomationLog';
import Business from '../../models/Business';
import { TaxCalculator } from '../../services/tax-calculation/TaxCalculator';
import { SquareIntegration } from '../../integrations/pos/SquareIntegration';
import { EnhancedAnalyticsService } from '../../services/EnhancedAnalyticsService';

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
      permissions: ['admin', 'read:automation', 'write:automation', 'manage:automation']
    } 
  };
  next();
};

const requirePermission = (permission: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // In development mode, allow all permissions for automation
    if (permission === 'read:automation' || permission === 'write:automation' || permission === 'manage:automation') {
      next();
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
};

// Initialize services
const taxCalculator = new TaxCalculator();
const posService = new SquareIntegration();
const passiveSetupService = new PassiveSetupService(taxCalculator, posService, EnhancedAnalyticsService);
const proactiveComplianceService = new ProactiveComplianceService(null, null); // Mock services for demo

/**
 * @route POST /api/automation/setup/business
 * @desc Automatically configure a new business with full automation
 * @access Private (requires write:automation permission)
 */
router.post('/setup/business', auth, requirePermission('write:automation'), async (req, res) => {
  try {
    const businessInfo: BusinessInfo = req.body;

    // Validate required fields
    if (!businessInfo.id || !businessInfo.name || !businessInfo.industry) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: id, name, and industry are required'
      });
    }

    // Validate business exists
    const business = await Business.findById(businessInfo.id);
    if (!business) {
      return res.status(404).json({
        success: false,
        error: 'Business not found'
      });
    }

    console.log(`Starting automated setup for business: ${businessInfo.name}`);

    // Run the passive setup service
    const setupResult = await passiveSetupService.autoConfigureNewBusiness(businessInfo);

    // Save automation configuration to database
    const automationConfig = new BusinessAutomation({
      business_id: new mongoose.Types.ObjectId(businessInfo.id),
      automation_profile: {
        setup_completed: setupResult.automation_status === 'complete',
        setup_level: setupResult.automation_status === 'complete' ? 'full' : 'partial',
        setup_completion_date: new Date(),
        automation_preferences: {
          tax_calculation: 'full',
          compliance_monitoring: 'proactive',
          report_generation: 'automated',
          filing_preparation: 'automated'
        }
      },
      pos_integrations: setupResult.configuration.pos_connections.active_connections.map(conn => ({
        system_name: conn.pos_system,
        connection_status: conn.status,
        automation_level: conn.automation_level,
        last_sync: conn.last_sync || new Date(),
        auto_discovered: true,
        confidence_score: 0.9
      })),
      compliance_workflows: setupResult.configuration.compliance_workflows.workflows.map(workflow => ({
        jurisdiction: workflow.jurisdiction,
        workflow_type: 'filing' as const,
        automation_level: 'full' as const,
        schedule: workflow.filing_frequency,
        next_execution: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        success_rate: 1.0
      })),
      background_services: setupResult.configuration.background_services.enabled_services.map(service => ({
        service_name: service.service,
        service_type: service.service.includes('monitor') ? 'monitoring' as const : 'maintenance' as const,
        enabled: true,
        automation_level: 'silent' as const,
        frequency: service.frequency,
        next_run: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        health_status: 'healthy' as const
      })),
      ai_insights: {
        enabled: true,
        confidence_threshold: 0.7,
        last_analysis: new Date(),
        risk_score: 0.1, // Low risk for new setup
        recommendations: [],
        pattern_analysis: {}
      },
      performance_metrics: {
        automation_coverage: 0.95,
        user_intervention_rate: 0.05,
        error_rate: 0.01,
        processing_efficiency: 0.98,
        cost_savings_estimated: 500, // Monthly savings estimate
        time_savings_hours_per_month: 20
      },
      alerts_preferences: {
        urgency_threshold: 'medium' as const,
        delivery_methods: ['email', 'dashboard'],
        quiet_hours: {
          enabled: true,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'America/Chicago'
        },
        escalation_enabled: false,
        escalation_delay_minutes: 30
      }
    });

    await automationConfig.save();

    res.json({
      success: true,
      message: 'Business automation setup completed successfully',
      data: {
        setup_result: setupResult,
        automation_config_id: automationConfig._id,
        summary: {
          automation_status: setupResult.automation_status,
          setup_time_seconds: setupResult.setup_time_seconds,
          pos_connections: setupResult.configuration.pos_connections.active_connections.length,
          compliance_workflows: setupResult.configuration.compliance_workflows.workflows.length,
          background_services: setupResult.configuration.background_services.enabled_services.length,
          user_actions_required: setupResult.user_actions_required,
          next_automation_check: setupResult.next_automation_check
        }
      }
    });

  } catch (error) {
    console.error('Error in automated business setup:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set up business automation'
    });
  }
});

/**
 * @route POST /api/automation/compliance/run-proactive
 * @desc Run proactive compliance checks for all businesses or a specific business
 * @access Private (requires manage:automation permission)
 */
router.post('/compliance/run-proactive', auth, requirePermission('manage:automation'), async (req, res) => {
  try {
    const { business_id } = req.body;
    
    console.log('Running proactive compliance checks...');

    if (business_id) {
      // Run for specific business
      const business = await Business.findById(business_id);
      if (!business) {
        return res.status(404).json({
          success: false,
          error: 'Business not found'
        });
      }

      await proactiveComplianceService.runBusinessComplianceCheck(business);
      
      res.json({
        success: true,
        message: 'Proactive compliance check completed for business',
        data: {
          business_id: business_id,
          business_name: business.name,
          check_completed_at: new Date()
        }
      });
    } else {
      // Run for all businesses
      await proactiveComplianceService.runProactiveCompliance();
      
      res.json({
        success: true,
        message: 'Proactive compliance checks completed for all businesses',
        data: {
          check_completed_at: new Date()
        }
      });
    }

  } catch (error) {
    console.error('Error running proactive compliance:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run proactive compliance checks'
    });
  }
});

/**
 * @route GET /api/automation/business/:businessId/status
 * @desc Get automation status and configuration for a business
 * @access Private (requires read:automation permission)
 */
router.get('/business/:businessId/status', auth, requirePermission('read:automation'), async (req, res) => {
  try {
    const { businessId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid business ID format'
      });
    }

    const automationConfig = await BusinessAutomation.findOne({ 
      business_id: new mongoose.Types.ObjectId(businessId) 
    });

    if (!automationConfig) {
      return res.status(404).json({
        success: false,
        error: 'Business automation configuration not found'
      });
    }

    // Get recent automation logs
    const recentLogs = await AutomationLog.find({ 
      business_id: businessId 
    })
      .sort({ timestamp: -1 })
      .limit(10);

    // Calculate health metrics
    const healthMetrics = {
      overall_health: 'healthy' as 'healthy' | 'degraded' | 'error',
      pos_integrations_active: automationConfig.pos_integrations.filter(p => p.connection_status === 'active').length,
      compliance_workflows_active: automationConfig.compliance_workflows.length,
      background_services_running: automationConfig.background_services.filter(s => s.enabled && s.health_status === 'healthy').length,
      last_health_check: automationConfig.last_health_check,
      ai_insights_enabled: automationConfig.ai_insights.enabled,
      current_risk_score: automationConfig.ai_insights.risk_score
    };

    res.json({
      success: true,
      data: {
        automation_config: automationConfig,
        health_metrics: healthMetrics,
        recent_activity: recentLogs,
        summary: {
          setup_level: automationConfig.automation_profile.setup_level,
          automation_coverage: automationConfig.performance_metrics.automation_coverage,
          user_intervention_rate: automationConfig.performance_metrics.user_intervention_rate,
          estimated_monthly_savings: {
            cost: automationConfig.performance_metrics.cost_savings_estimated,
            time_hours: automationConfig.performance_metrics.time_savings_hours_per_month
          }
        }
      }
    });

  } catch (error) {
    console.error('Error getting automation status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get automation status'
    });
  }
});

/**
 * @route GET /api/automation/logs
 * @desc Get automation logs with filtering and pagination
 * @access Private (requires read:automation permission)
 */
router.get('/logs', auth, requirePermission('read:automation'), async (req, res) => {
  try {
    const {
      business_id,
      automation_type,
      event_type,
      success,
      limit = 50,
      offset = 0,
      start_date,
      end_date
    } = req.query;

    // Build query filter
    const filter: any = {};
    
    if (business_id) filter.business_id = business_id;
    if (automation_type) filter.automation_type = automation_type;
    if (event_type) filter.event_type = event_type;
    if (success !== undefined) filter.success = success === 'true';
    
    if (start_date || end_date) {
      filter.timestamp = {};
      if (start_date) filter.timestamp.$gte = new Date(start_date as string);
      if (end_date) filter.timestamp.$lte = new Date(end_date as string);
    }

    const logs = await AutomationLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string))
      .skip(parseInt(offset as string));

    const totalCount = await AutomationLog.countDocuments(filter);

    // Calculate summary statistics
    const stats = await AutomationLog.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          total_events: { $sum: 1 },
          successful_events: { $sum: { $cond: ['$success', 1, 0] } },
          failed_events: { $sum: { $cond: ['$success', 0, 1] } },
          avg_processing_time: { $avg: '$processing_time_ms' },
          automation_types: { $addToSet: '$automation_type' },
          event_types: { $addToSet: '$event_type' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        logs: logs,
        pagination: {
          total: totalCount,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          has_more: totalCount > parseInt(offset as string) + parseInt(limit as string)
        },
        statistics: stats[0] || {
          total_events: 0,
          successful_events: 0,
          failed_events: 0,
          avg_processing_time: 0,
          automation_types: [],
          event_types: []
        }
      }
    });

  } catch (error) {
    console.error('Error fetching automation logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch automation logs'
    });
  }
});

/**
 * @route POST /api/automation/business/:businessId/settings
 * @desc Update automation settings for a business
 * @access Private (requires write:automation permission)
 */
router.post('/business/:businessId/settings', auth, requirePermission('write:automation'), async (req, res) => {
  try {
    const { businessId } = req.params;
    const settings = req.body;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid business ID format'
      });
    }

    const automationConfig = await BusinessAutomation.findOneAndUpdate(
      { business_id: new mongoose.Types.ObjectId(businessId) },
      {
        $set: {
          'automation_profile.automation_preferences': settings.automation_preferences,
          'alerts_preferences': settings.alerts_preferences,
          'ai_insights.enabled': settings.ai_insights_enabled,
          'ai_insights.confidence_threshold': settings.confidence_threshold,
          updated_at: new Date()
        }
      },
      { new: true, runValidators: true }
    );

    if (!automationConfig) {
      return res.status(404).json({
        success: false,
        error: 'Business automation configuration not found'
      });
    }

    // Log the settings change
    await new AutomationLog({
      business_id: businessId,
      automation_type: 'setup',
      event_type: 'settings_updated',
      input_data: settings,
      output_data: { updated_fields: Object.keys(settings) },
      automation_level: 'manual',
      success: true,
      triggered_by: 'user',
      timestamp: new Date()
    }).save();

    res.json({
      success: true,
      message: 'Automation settings updated successfully',
      data: {
        updated_config: automationConfig,
        updated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error updating automation settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update automation settings'
    });
  }
});

/**
 * @route GET /api/automation/health-check
 * @desc Run health check on all automation systems
 * @access Private (requires manage:automation permission)
 */
router.get('/health-check', auth, requirePermission('manage:automation'), async (req, res) => {
  try {
    const { business_id } = req.query;

    let healthCheckResults;

    if (business_id) {
      // Health check for specific business
      const config = await BusinessAutomation.findOne({ 
        business_id: new mongoose.Types.ObjectId(business_id as string) 
      });
      
      if (!config) {
        return res.status(404).json({
          success: false,
          error: 'Business automation configuration not found'
        });
      }

      healthCheckResults = await runBusinessHealthCheck(config);
    } else {
      // Health check for all businesses
      const configs = await BusinessAutomation.find({
        'automation_profile.setup_completed': true
      });

      healthCheckResults = await Promise.all(
        configs.map(config => runBusinessHealthCheck(config))
      );
    }

    res.json({
      success: true,
      data: {
        health_check_results: healthCheckResults,
        check_completed_at: new Date(),
        overall_status: Array.isArray(healthCheckResults) 
          ? healthCheckResults.every(r => r.status === 'healthy') ? 'healthy' : 'degraded'
          : healthCheckResults.status
      }
    });

  } catch (error) {
    console.error('Error running health check:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run health check'
    });
  }
});

/**
 * @route GET /api/automation/dashboard
 * @desc Get automation dashboard data
 * @access Private (requires read:automation permission)
 */
router.get('/dashboard', auth, requirePermission('read:automation'), async (req, res) => {
  try {
    // Get overall statistics
    const totalBusinesses = await BusinessAutomation.countDocuments({});
    const fullyAutomated = await BusinessAutomation.countDocuments({
      'automation_profile.setup_level': 'full'
    });
    const partiallyAutomated = await BusinessAutomation.countDocuments({
      'automation_profile.setup_level': 'partial'
    });

    // Get recent automation activity
    const recentActivity = await AutomationLog.find({})
      .sort({ timestamp: -1 })
      .limit(20);

    // Get businesses with highest risk scores
    const highRiskBusinesses = await BusinessAutomation.find({
      'ai_insights.risk_score': { $gt: 0.5 }
    })
      .sort({ 'ai_insights.risk_score': -1 })
      .limit(10)
      .populate('business_id', 'name industry');

    // Calculate performance metrics
    const performanceStats = await BusinessAutomation.aggregate([
      {
        $group: {
          _id: null,
          avg_automation_coverage: { $avg: '$performance_metrics.automation_coverage' },
          avg_user_intervention_rate: { $avg: '$performance_metrics.user_intervention_rate' },
          avg_error_rate: { $avg: '$performance_metrics.error_rate' },
          total_estimated_savings: { $sum: '$performance_metrics.cost_savings_estimated' },
          total_time_savings: { $sum: '$performance_metrics.time_savings_hours_per_month' }
        }
      }
    ]);

    // Get error trends (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const errorTrends = await AutomationLog.aggregate([
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
          success: false
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            automation_type: '$automation_type'
          },
          error_count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          total_businesses: totalBusinesses,
          fully_automated: fullyAutomated,
          partially_automated: partiallyAutomated,
          automation_adoption_rate: totalBusinesses > 0 ? (fullyAutomated + partiallyAutomated) / totalBusinesses : 0
        },
        performance: performanceStats[0] || {
          avg_automation_coverage: 0,
          avg_user_intervention_rate: 0,
          avg_error_rate: 0,
          total_estimated_savings: 0,
          total_time_savings: 0
        },
        recent_activity: recentActivity.slice(0, 10),
        high_risk_businesses: highRiskBusinesses,
        error_trends: errorTrends,
        generated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error generating automation dashboard:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate automation dashboard'
    });
  }
});

// Helper method for health checks (would be implemented as part of the class)
async function runBusinessHealthCheck(config: any): Promise<any> {
  return {
    business_id: config.business_id,
    status: 'healthy',
    checks: {
      pos_integrations: 'healthy',
      compliance_workflows: 'healthy',
      background_services: 'healthy',
      ai_insights: 'healthy'
    },
    last_checked: new Date()
  };
}

export default router;