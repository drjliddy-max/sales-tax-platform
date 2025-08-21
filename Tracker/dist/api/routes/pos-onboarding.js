"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const onboarding_1 = require("@/integrations/pos/onboarding");
const auth_1 = require("@/middleware/auth");
const validation_1 = require("@/middleware/validation");
const router = (0, express_1.Router)();
const onboardingManager = onboarding_1.POSOnboardingManager.getInstance();
const startOnboardingSchema = zod_1.z.object({
    posType: zod_1.z.enum(['shopify', 'square', 'clover', 'toast', 'lightspeed', 'paypal_here', 'ncr']).optional(),
    redirectUri: zod_1.z.string().url().optional()
});
const continueOnboardingSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    posType: zod_1.z.enum(['shopify', 'square', 'clover', 'toast', 'lightspeed', 'paypal_here', 'ncr']).optional(),
    credentials: zod_1.z.object({
        accessToken: zod_1.z.string().optional(),
        refreshToken: zod_1.z.string().optional(),
        apiKey: zod_1.z.string().optional(),
        shopDomain: zod_1.z.string().optional(),
        merchantId: zod_1.z.string().optional(),
        restaurantGuid: zod_1.z.string().optional()
    }).optional(),
    oauthCode: zod_1.z.string().optional(),
    oauthState: zod_1.z.string().optional(),
    shopDomain: zod_1.z.string().optional()
});
const generateOAuthUrlSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    posType: zod_1.z.enum(['shopify', 'square', 'clover', 'toast']),
    shopDomain: zod_1.z.string().optional()
});
router.post('/start', auth_1.auth, (0, validation_1.validateRequest)({ body: startOnboardingSchema }), async (req, res) => {
    try {
        const { posType, redirectUri } = req.body;
        const businessId = req.user?.businessId || req.user?.id;
        if (!businessId) {
            return res.status(400).json({
                error: 'Business ID is required for onboarding'
            });
        }
        const result = await onboardingManager.startOnboarding(businessId, posType, redirectUri);
        res.json({
            success: result.success,
            sessionId: result.session.id,
            status: result.session.status,
            progress: result.session.progress,
            nextAction: result.nextAction
        });
    }
    catch (error) {
        console.error('Failed to start onboarding:', error);
        res.status(500).json({
            error: 'Failed to start onboarding process',
            details: error.message
        });
    }
});
router.post('/continue', auth_1.auth, (0, validation_1.validateRequest)({ body: continueOnboardingSchema }), async (req, res) => {
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
    }
    catch (error) {
        console.error('Failed to continue onboarding:', error);
        res.status(500).json({
            error: 'Failed to continue onboarding process',
            details: error.message
        });
    }
});
router.post('/oauth/url', auth_1.auth, (0, validation_1.validateRequest)({ body: generateOAuthUrlSchema }), async (req, res) => {
    try {
        const { sessionId, posType, shopDomain } = req.body;
        const oauthUrl = onboardingManager.generateOAuthUrl(sessionId, posType, shopDomain);
        res.json({
            success: true,
            oauthUrl,
            posType
        });
    }
    catch (error) {
        console.error('Failed to generate OAuth URL:', error);
        res.status(500).json({
            error: 'Failed to generate OAuth URL',
            details: error.message
        });
    }
});
router.get('/oauth/callback', async (req, res) => {
    try {
        const { code, state, shop, error: oauthError } = req.query;
        if (oauthError) {
            const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/error?error=${encodeURIComponent(oauthError)}`;
            return res.redirect(errorUrl);
        }
        if (!code || !state) {
            const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/error?error=missing_oauth_parameters`;
            return res.redirect(errorUrl);
        }
        const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}/onboarding/callback`);
        callbackUrl.searchParams.set('code', code);
        callbackUrl.searchParams.set('state', state);
        if (shop) {
            callbackUrl.searchParams.set('shop', shop);
        }
        res.redirect(callbackUrl.toString());
    }
    catch (error) {
        console.error('OAuth callback error:', error);
        const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/onboarding/error?error=oauth_callback_failed`;
        res.redirect(errorUrl);
    }
});
router.get('/progress/:sessionId', auth_1.auth, async (req, res) => {
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
    }
    catch (error) {
        console.error('Failed to get onboarding progress:', error);
        res.status(500).json({
            error: 'Failed to get onboarding progress',
            details: error.message
        });
    }
});
router.post('/cancel/:sessionId', auth_1.auth, async (req, res) => {
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
    }
    catch (error) {
        console.error('Failed to cancel onboarding:', error);
        res.status(500).json({
            error: 'Failed to cancel onboarding',
            details: error.message
        });
    }
});
router.post('/test-connection', auth_1.auth, async (req, res) => {
    try {
        const { posType, credentials } = req.body;
        if (!posType || !credentials) {
            return res.status(400).json({
                error: 'POS type and credentials are required'
            });
        }
        const businessId = req.user?.businessId || req.user?.id;
        const result = await onboardingManager.startOnboarding(businessId, posType);
        const testResult = await onboardingManager.continueOnboarding(result.session.id, { posType, credentials });
        res.json({
            success: testResult.success,
            connectionTest: testResult.success,
            error: testResult.session.error,
            locations: testResult.locations
        });
    }
    catch (error) {
        console.error('Connection test failed:', error);
        res.status(500).json({
            success: false,
            connectionTest: false,
            error: 'Connection test failed',
            details: error.message
        });
    }
});
router.get('/supported', auth_1.auth, async (req, res) => {
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
    }
    catch (error) {
        console.error('Failed to get supported POS systems:', error);
        res.status(500).json({
            error: 'Failed to get supported POS systems',
            details: error.message
        });
    }
});
router.get('/events/:sessionId', auth_1.auth, async (req, res) => {
    const { sessionId } = req.params;
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
    const sendEvent = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const onStepStarted = (data) => {
        if (data.sessionId === sessionId) {
            sendEvent('step_started', data);
        }
    };
    const onStepCompleted = (data) => {
        if (data.sessionId === sessionId) {
            sendEvent('step_completed', data);
        }
    };
    const onStepFailed = (data) => {
        if (data.sessionId === sessionId) {
            sendEvent('step_failed', data);
        }
    };
    const onCompleted = (data) => {
        if (data.sessionId === sessionId) {
            sendEvent('completed', data);
            res.end();
        }
    };
    onboardingManager.on('onboarding:step_started', onStepStarted);
    onboardingManager.on('onboarding:step_completed', onStepCompleted);
    onboardingManager.on('onboarding:step_failed', onStepFailed);
    onboardingManager.on('onboarding:completed', onCompleted);
    req.on('close', () => {
        onboardingManager.off('onboarding:step_started', onStepStarted);
        onboardingManager.off('onboarding:step_completed', onStepCompleted);
        onboardingManager.off('onboarding:step_failed', onStepFailed);
        onboardingManager.off('onboarding:completed', onCompleted);
    });
    const progress = await onboardingManager.getOnboardingProgress(sessionId);
    if (progress) {
        sendEvent('status', progress);
    }
});
exports.default = router;
//# sourceMappingURL=pos-onboarding.js.map