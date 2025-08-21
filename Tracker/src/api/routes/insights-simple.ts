import express from 'express';
import mongoose from 'mongoose';
import { SmartInsightsService } from '../../services/insights/SmartInsightsService';
import BusinessInsight from '../../models/BusinessInsight';
import InsightDigest from '../../models/InsightDigest';
import Business from '../../models/Business';

const router = express.Router();

// Mock services for development
const mockDatabaseService = {
  query: async (sql: string, params: any[]) => ({ rows: [] })
};

const mockEmailService = {
  sendEmail: async (notification: any) => {
    console.log('Email sent:', notification.subject);
  }
};

const mockAnalyticsService = {
  getBusinessAnalytics: async (businessId: string) => ({}),
  getRevenueHistory: async (businessId: string, months = 12) => [
    {
      date: new Date(),
      revenue: 50000,
      transactions: 200,
      avg_transaction: 250
    }
  ],
  calculateMetrics: async (businessId: string) => ({})
};

// Initialize smart insights service
const smartInsightsService = new SmartInsightsService(
  mockDatabaseService,
  mockAnalyticsService,
  mockEmailService
);

// Simple auth middleware for development
const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  (req as any).user = { 
    sub: 'admin-user', 
    app_metadata: { 
      businessId: 'demo-business',
      permissions: ['admin', 'read:insights', 'write:insights']
    } 
  };
  next();
};

/**
 * @route POST /api/insights/generate/:businessId
 * @desc Generate automatic insights for a business
 */
router.post('/generate/:businessId', auth, async (req, res) => {
  try {
    const { businessId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid business ID format'
      });
    }

    console.log(`Generating insights for business: ${businessId}`);

    // Generate insights
    const insights = await smartInsightsService.generateAutomaticInsights(businessId);

    res.json({
      success: true,
      message: 'Insights generated successfully',
      data: {
        business_id: businessId,
        insights_generated: insights.length,
        insights: insights,
        high_impact_count: insights.filter(i => i.impact === 'high').length,
        total_estimated_value: insights.reduce((sum, insight) => 
          sum + (insight.estimated_revenue_impact || insight.estimated_savings || 0), 0),
        generated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate insights'
    });
  }
});

/**
 * @route GET /api/insights/business/:businessId
 * @desc Get active insights for a business
 */
router.get('/business/:businessId', auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { limit = 10, impact, type, status = 'active' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid business ID format'
      });
    }

    // Build query filter
    const filter: any = { 
      business_id: new mongoose.Types.ObjectId(businessId),
      status: status 
    };

    if (impact) filter.impact = impact;
    if (type) filter.type = type;

    const insights = await BusinessInsight.find(filter)
      .sort({ impact: -1, priority: 1, generated_at: -1 })
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      data: {
        insights: insights,
        summary: {
          total_insights: insights.length,
          high_impact_insights: insights.filter(i => i.impact === 'high').length,
          total_estimated_value: insights.reduce((sum, insight) => 
            sum + (insight.estimated_revenue_impact || insight.estimated_savings || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch insights'
    });
  }
});

/**
 * @route POST /api/insights/:insightId/dismiss
 * @desc Dismiss an insight
 */
router.post('/:insightId/dismiss', auth, async (req, res) => {
  try {
    const { insightId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(insightId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid insight ID format'
      });
    }

    const insight = await BusinessInsight.findByIdAndUpdate(
      insightId,
      { 
        status: 'dismissed',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!insight) {
      return res.status(404).json({
        success: false,
        error: 'Insight not found'
      });
    }

    res.json({
      success: true,
      message: 'Insight dismissed successfully',
      data: {
        insight_id: insightId,
        status: insight.status
      }
    });

  } catch (error) {
    console.error('Error dismissing insight:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to dismiss insight'
    });
  }
});

/**
 * @route GET /api/insights/dashboard/:businessId
 * @desc Get insight dashboard data for a business
 */
router.get('/dashboard/:businessId', auth, async (req, res) => {
  try {
    const { businessId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid business ID format'
      });
    }

    // Get active high-impact insights
    const highImpactInsights = await BusinessInsight.find({
      business_id: new mongoose.Types.ObjectId(businessId),
      status: 'active',
      impact: 'high'
    }).sort({ confidence_score: -1, priority: 1 }).limit(3);
    
    // Get recent insights
    const recentInsights = await BusinessInsight.find({
      business_id: new mongoose.Types.ObjectId(businessId),
      status: 'active'
    }).sort({ generated_at: -1 }).limit(5);

    // Calculate basic metrics
    const totalInsights = await BusinessInsight.countDocuments({
      business_id: new mongoose.Types.ObjectId(businessId)
    });

    const totalValue = recentInsights.reduce((sum, insight) => 
      sum + (insight.estimated_revenue_impact || insight.estimated_savings || 0), 0);

    res.json({
      success: true,
      data: {
        high_impact_insights: highImpactInsights,
        recent_insights: recentInsights,
        summary: {
          total_active_insights: recentInsights.length,
          total_potential_value: totalValue,
          high_impact_count: highImpactInsights.length
        },
        generated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error generating insight dashboard:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate insight dashboard'
    });
  }
});

export default router;