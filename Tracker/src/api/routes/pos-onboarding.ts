/**
 * POS Onboarding API Routes
 * Handles the complete POS onboarding flow including OAuth callbacks
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { POSOnboardingManager } from '@/integrations/pos/onboarding';
import { POSSystemType } from '@/integrations/pos/types';
import { auth } from '@/middleware/auth';
import { validateRequest } from '@/middleware/validation';

const router = Router();
const onboardingManager = POSOnboardingManager.getInstance();

// Validation schemas
const startOnboardingSchema = z.object({
  posType: z.enum(['shopify', 'square', 'clover', 'toast', 'lightspeed', 'paypal_here', 'ncr']).optional(),
  redirectUri: z.string().url().optional()
});

const continueOnboardingSchema = z.object({
  sessionId: z.string().uuid(),
  posType: z.enum(['shopify', 'square', 'clover', 'toast', 'lightspeed', 'paypal_here', 'ncr']).optional(),
  credentials: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    apiKey: z.string().optional(),
    shopDomain: z.string().optional(),
    merchantId: z.string().optional(),
    restaurantGuid: z.string().optional()
  }).optional(),
  oauthCode: z.string().optional(),
  oauthState: z.string().optional(),
  shopDomain: z.string().optional()
});

const generateOAuthUrlSchema = z.object({
  sessionId: z.string().uuid(),
  posType: z.enum(['shopify', 'square', 'clover', 'toast']),
  shopDomain: z.string().optional()
});

/**
 * Start POS onboarding process
 * POST /api/pos/onboarding/start
 */
router.post('/start', 
  auth,
  validateRequest({ body: startOnboardingSchema }),
  async (req: Request, res: Response) => {
    try {
      const { posType, redirectUri } = req.body;
      const businessId = req.user?.businessId || req.user?.id;

      if (!businessId) {
        return res.status(400).json({
          error: 'Business ID is required for onboarding'
        });
      }

      const result = await onboardingManager.startOnboarding(
        businessId,
        posType,
        redirectUri
      );

      res.json({
        success: result.success,
        sessionId: result.session.id,
        status: result.session.status,
        progress: result.session.progress,
        nextAction: result.nextAction
      });
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      res.status(500).json({
        error: 'Failed to start onboarding process',
        details: error.message
      });
    }
  }
);

/**
 * Continue onboarding with credentials or OAuth callback
 * POST /api/pos/onboarding/continue
 */
router.post('/continue',
  auth,
  validateRequest({ body: continueOnboardingSchema }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, ...data } = req.body;

      const result = await onboardingManager.continueOnboarding(sessionId, data);

      res.json({
        success: result.success,
        status: result.session.status,
        progress: result.session.progress,
        error: result.session.error,
        configuration: result.configuration ? {
          posType: result.configuration.posType,
          isActive: result.configuration.isActive,
          settings: result.configuration.settings
        } : undefined,
        locations: result.locations,
        sampleData: result.sampleData,
        nextAction: result.nextAction
      });
    } catch (error) {
      console.error('Failed to continue onboarding:', error);
      res.status(500).json({
        error: 'Failed to continue onboarding process',
        details: error.message
      });
    }
  }
);

/**
 * Generate OAuth URL for POS system
 * POST /api/pos/onboarding/oauth/url
 */
router.post('/oauth/url',
  auth,
  validateRequest({ body: generateOAuthUrlSchema }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, posType, shopDomain } = req.body;

      const oauthUrl = onboardingManager.generateOAuthUrl(sessionId, posType, shopDomain);

      res.json({
        success: true,
        oauthUrl,
        posType
      });
    } catch (error) {
      console.error('Failed to generate OAuth URL:', error);
      res.status(500).json({
        error: 'Failed to generate OAuth URL',
        details: error.message
      });
    }
  }
);

/**
 * Handle OAuth callback from POS systems
 * GET /api/pos/oauth/callback
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, shop, error: oauthError } = req.query;

    if (oauthError) {
      // Handle OAuth errors
      const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/error?error=${encodeURIComponent(oauthError as string)}`;
      return res.redirect(errorUrl);
    }

    if (!code || !state) {
      const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/error?error=missing_oauth_parameters`;
      return res.redirect(errorUrl);
    }

    // Find the session by state (stored in Redis/database)
    // For now, we'll redirect to frontend with the OAuth data
    const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/onboarding/callback`);
    callbackUrl.searchParams.set('code', code as string);
    callbackUrl.searchParams.set('state', state as string);
    
    if (shop) {
      callbackUrl.searchParams.set('shop', shop as string);
    }

    res.redirect(callbackUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/error?error=oauth_callback_failed`;
    res.redirect(errorUrl);
  }
});

/**
 * Get onboarding progress
 * GET /api/pos/onboarding/progress/:sessionId
 */
router.get('/progress/:sessionId',
  auth,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID is required'
        });
      }

      const progress = await onboardingManager.getOnboardingProgress(sessionId);

      if (!progress) {
        return res.status(404).json({
          error: 'Onboarding session not found'
        });
      }

      res.json({
        success: true,
        progress: progress.progress,
        status: progress.status,
        error: progress.error
      });
    } catch (error) {
      console.error('Failed to get onboarding progress:', error);
      res.status(500).json({
        error: 'Failed to get onboarding progress',
        details: error.message
      });
    }
  }
);

/**
 * Cancel onboarding process
 * POST /api/pos/onboarding/cancel/:sessionId
 */
router.post('/cancel/:sessionId',
  auth,
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          error: 'Session ID is required'
        });
      }

      await onboardingManager.cancelOnboarding(sessionId);

      res.json({
        success: true,
        message: 'Onboarding cancelled successfully'
      });
    } catch (error) {
      console.error('Failed to cancel onboarding:', error);
      res.status(500).json({
        error: 'Failed to cancel onboarding',
        details: error.message
      });
    }
  }
);

/**
 * Test connection with provided credentials
 * POST /api/pos/onboarding/test-connection
 */
router.post('/test-connection',
  auth,
  async (req: Request, res: Response) => {
    try {
      const { posType, credentials } = req.body;

      if (!posType || !credentials) {
        return res.status(400).json({
          error: 'POS type and credentials are required'
        });
      }

      // Start a temporary onboarding session for testing
      const businessId = req.user?.businessId || req.user?.id;
      const result = await onboardingManager.startOnboarding(businessId, posType);

      // Test the connection
      const testResult = await onboardingManager.continueOnboarding(
        result.session.id,
        { posType, credentials }
      );

      res.json({
        success: testResult.success,
        connectionTest: testResult.success,
        error: testResult.session.error,
        locations: testResult.locations
      });
    } catch (error) {
      console.error('Connection test failed:', error);
      res.status(500).json({
        success: false,
        connectionTest: false,
        error: 'Connection test failed',
        details: error.message
      });
    }
  }
);

/**
 * Get supported POS systems
 * GET /api/pos/onboarding/supported
 */
router.get('/supported',
  auth,
  async (req: Request, res: Response) => {
    try {
      const supportedPOS = [
        {
          id: 'shopify',
          name: 'Shopify POS',
          description: 'Leading e-commerce and retail platform',
          authMethod: 'oauth',
          features: ['Advanced Tax Calculation', 'Multi-jurisdiction', 'Real-time Webhooks', 'Tax Exemptions'],
          marketFocus: 'E-commerce + Retail'
        },
        {
          id: 'square',
          name: 'Square POS',
          description: 'Popular small business solution',
          authMethod: 'oauth',
          features: ['Good Tax Support', 'Simple Integration', 'Real-time Updates', 'Multi-location'],
          marketFocus: 'Small-Medium Business'
        },
        {
          id: 'clover',
          name: 'Clover POS',
          description: 'Comprehensive merchant services platform',
          authMethod: 'oauth',
          features: ['Detailed Tax Data', 'Hardware Integration', 'Merchant Services'],
          marketFocus: 'SMB + Restaurant'
        },
        {
          id: 'toast',
          name: 'Toast POS',
          description: 'Restaurant-focused system',
          authMethod: 'oauth',
          features: ['Restaurant-specific Tax', 'Alcohol Tax Handling', 'Delivery Tax'],
          marketFocus: 'Restaurants Only'
        }
      ];

      res.json({
        success: true,
        supportedPOS
      });
    } catch (error) {
      console.error('Failed to get supported POS systems:', error);
      res.status(500).json({
        error: 'Failed to get supported POS systems',
        details: error.message
      });
    }
  }
);

/**
 * Handle real-time onboarding events via Server-Sent Events
 * GET /api/pos/onboarding/events/:sessionId
 */
router.get('/events/:sessionId',
  auth,
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Listen for onboarding events
    const onStepStarted = (data: any) => {
      if (data.sessionId === sessionId) {
        sendEvent('step_started', data);
      }
    };

    const onStepCompleted = (data: any) => {
      if (data.sessionId === sessionId) {
        sendEvent('step_completed', data);
      }
    };

    const onStepFailed = (data: any) => {
      if (data.sessionId === sessionId) {
        sendEvent('step_failed', data);
      }
    };

    const onCompleted = (data: any) => {
      if (data.sessionId === sessionId) {
        sendEvent('completed', data);
        res.end();
      }
    };

    // Subscribe to events
    onboardingManager.on('onboarding:step_started', onStepStarted);
    onboardingManager.on('onboarding:step_completed', onStepCompleted);
    onboardingManager.on('onboarding:step_failed', onStepFailed);
    onboardingManager.on('onboarding:completed', onCompleted);

    // Clean up on client disconnect
    req.on('close', () => {
      onboardingManager.off('onboarding:step_started', onStepStarted);
      onboardingManager.off('onboarding:step_completed', onStepCompleted);
      onboardingManager.off('onboarding:step_failed', onStepFailed);
      onboardingManager.off('onboarding:completed', onCompleted);
    });

    // Send initial status
    const progress = await onboardingManager.getOnboardingProgress(sessionId);
    if (progress) {
      sendEvent('status', progress);
    }
  }
);

export default router;
