"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSOnboardingManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const redis_1 = require("@/lib/redis");
const types_1 = require("./types");
const detection_1 = require("./detection");
const configuration_1 = require("./configuration");
const webhook_manager_1 = require("./webhook-manager");
const ShopifyAdapter_1 = require("./adapters/ShopifyAdapter");
const SquareAdapter_1 = require("./adapters/SquareAdapter");
class POSOnboardingManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.adapters = new Map();
        this.sessions = new Map();
        this.onboardingSteps = [
            {
                name: 'detect_pos',
                description: 'Detecting POS system type',
                action: this.detectPOSStep.bind(this)
            },
            {
                name: 'authenticate',
                description: 'Authenticating with POS system',
                action: this.authenticateStep.bind(this)
            },
            {
                name: 'test_connection',
                description: 'Testing connection and permissions',
                action: this.testConnectionStep.bind(this)
            },
            {
                name: 'fetch_locations',
                description: 'Retrieving store locations',
                action: this.fetchLocationsStep.bind(this)
            },
            {
                name: 'setup_webhooks',
                description: 'Setting up real-time notifications',
                action: this.setupWebhooksStep.bind(this)
            },
            {
                name: 'test_data_sync',
                description: 'Testing data synchronization',
                action: this.testDataSyncStep.bind(this)
            },
            {
                name: 'save_configuration',
                description: 'Saving configuration',
                action: this.saveConfigurationStep.bind(this)
            }
        ];
        this.initializeAdapters();
        this.webhookManager = webhook_manager_1.WebhookManager.getInstance();
        this.startSessionCleanup();
    }
    static getInstance() {
        if (!POSOnboardingManager.instance) {
            POSOnboardingManager.instance = new POSOnboardingManager();
        }
        return POSOnboardingManager.instance;
    }
    initializeAdapters() {
        this.adapters.set('shopify', new ShopifyAdapter_1.ShopifyAdapter());
        this.adapters.set('square', new SquareAdapter_1.SquareAdapter());
    }
    async startOnboarding(businessId, posType, redirectUri) {
        try {
            const sessionId = crypto_1.default.randomUUID();
            const state = crypto_1.default.randomBytes(16).toString('hex');
            const session = {
                id: sessionId,
                businessId,
                posType,
                state,
                status: 'initiated',
                progress: {
                    step: 0,
                    totalSteps: this.onboardingSteps.length,
                    currentStep: 'starting',
                    completedSteps: []
                },
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + this.SESSION_DURATION),
                metadata: { redirectUri }
            };
            this.sessions.set(sessionId, session);
            await this.persistSession(session);
            if (posType && this.adapters.has(posType)) {
                return await this.continueOnboarding(sessionId);
            }
            return {
                success: true,
                session,
                nextAction: {
                    type: 'manual_credentials',
                    data: {
                        supportedPOS: Array.from(this.adapters.keys()),
                        sessionId
                    }
                }
            };
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to start onboarding: ${error.message}`, 'ONBOARDING_START_FAILED', posType || 'unknown', undefined, true, { businessId, error: error.message });
        }
    }
    async continueOnboarding(sessionId, data) {
        const session = await this.getSession(sessionId);
        if (!session) {
            throw new types_1.POSIntegrationError('Invalid or expired onboarding session', 'SESSION_NOT_FOUND', 'unknown');
        }
        try {
            if (data?.oauthState && data.oauthState !== session.state) {
                throw new types_1.POSIntegrationError('Invalid OAuth state parameter', 'INVALID_STATE', session.posType || 'unknown');
            }
            if (data?.posType && !session.posType) {
                session.posType = data.posType;
            }
            if (data?.credentials) {
                session.credentials = { ...session.credentials, ...data.credentials };
            }
            if (data?.shopDomain) {
                session.credentials = { ...session.credentials, shopDomain: data.shopDomain };
            }
            if (data?.oauthCode && session.posType) {
                const adapter = this.adapters.get(session.posType);
                if (adapter) {
                    const tokenData = await this.exchangeOAuthCode(session.posType, data.oauthCode, session.metadata?.redirectUri);
                    session.credentials = { ...session.credentials, ...tokenData };
                }
            }
            return await this.executeOnboardingSteps(session);
        }
        catch (error) {
            session.status = 'failed';
            session.error = error.message;
            await this.updateSession(session);
            return {
                success: false,
                session,
                nextAction: {
                    type: 'complete'
                }
            };
        }
    }
    generateOAuthUrl(sessionId, posType, shopDomain) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error('Invalid session');
        }
        const baseUrl = process.env.NODE_ENV === 'production'
            ? process.env.NEXT_PUBLIC_APP_URL
            : 'http://localhost:3000';
        const redirectUri = `${baseUrl}/api/pos/oauth/callback`;
        const config = this.OAUTH_CONFIGS[posType];
        if (!config) {
            throw new Error(`OAuth not supported for ${posType}`);
        }
        switch (posType) {
            case 'shopify':
                if (!shopDomain)
                    throw new Error('Shop domain required for Shopify');
                return ShopifyAdapter_1.ShopifyAdapter.generateOAuthUrl(process.env.SHOPIFY_CLIENT_ID, shopDomain, redirectUri, config.scopes);
            case 'square':
                return SquareAdapter_1.SquareAdapter.generateOAuthUrl(process.env.SQUARE_CLIENT_ID, redirectUri, config.scopes, session.state);
            default:
                throw new Error(`OAuth URL generation not implemented for ${posType}`);
        }
    }
    async executeOnboardingSteps(session) {
        try {
            session.status = 'configuring';
            await this.updateSession(session);
            for (let i = session.progress.step; i < this.onboardingSteps.length; i++) {
                const step = this.onboardingSteps[i];
                session.progress.step = i;
                session.progress.currentStep = step.name;
                await this.updateSession(session);
                this.emit('onboarding:step_started', {
                    sessionId: session.id,
                    businessId: session.businessId,
                    step: step.name,
                    description: step.description
                });
                try {
                    session = await step.action(session);
                    session.progress.completedSteps.push(step.name);
                    this.emit('onboarding:step_completed', {
                        sessionId: session.id,
                        businessId: session.businessId,
                        step: step.name
                    });
                }
                catch (stepError) {
                    session.status = 'failed';
                    session.error = `Failed at ${step.name}: ${stepError.message}`;
                    await this.updateSession(session);
                    this.emit('onboarding:step_failed', {
                        sessionId: session.id,
                        businessId: session.businessId,
                        step: step.name,
                        error: stepError.message
                    });
                    if (step.rollback) {
                        try {
                            await step.rollback(session);
                        }
                        catch (rollbackError) {
                            console.error('Rollback failed:', rollbackError);
                        }
                    }
                    throw stepError;
                }
            }
            session.status = 'completed';
            session.progress.step = this.onboardingSteps.length;
            session.progress.currentStep = 'completed';
            await this.updateSession(session);
            const configuration = await configuration_1.ConfigurationManager.loadConfiguration(session.businessId, session.posType);
            this.emit('onboarding:completed', {
                sessionId: session.id,
                businessId: session.businessId,
                posType: session.posType,
                configuration
            });
            return {
                success: true,
                session,
                configuration: configuration || undefined,
                nextAction: {
                    type: 'complete'
                }
            };
        }
        catch (error) {
            console.error('Onboarding failed:', error);
            return {
                success: false,
                session,
                nextAction: {
                    type: 'complete'
                }
            };
        }
    }
    async detectPOSStep(session) {
        if (session.posType && session.credentials?.accessToken) {
            try {
                const detection = await detection_1.POSDetector.detectPOSSystem(session.credentials);
                if (detection.posType !== session.posType) {
                    console.warn(`POS type mismatch: expected ${session.posType}, detected ${detection.posType}`);
                }
                session.detectionResults = [detection];
            }
            catch (error) {
                console.warn('POS detection failed, continuing with provided type:', error.message);
            }
        }
        return session;
    }
    async authenticateStep(session) {
        if (!session.posType || !session.credentials) {
            throw new Error('POS type and credentials required');
        }
        const adapter = this.adapters.get(session.posType);
        if (!adapter) {
            throw new Error(`No adapter available for ${session.posType}`);
        }
        const authenticatedCredentials = await adapter.authenticate(session.credentials);
        session.credentials = authenticatedCredentials;
        return session;
    }
    async testConnectionStep(session) {
        const adapter = this.adapters.get(session.posType);
        const connectionTest = await adapter.testConnection(session.credentials);
        if (!connectionTest) {
            throw new Error('Connection test failed - please check your credentials');
        }
        return session;
    }
    async fetchLocationsStep(session) {
        const adapter = this.adapters.get(session.posType);
        const locations = await adapter.getLocations(session.credentials);
        if (locations.length === 0) {
            throw new Error('No locations found - please ensure your account has at least one location configured');
        }
        session.metadata = { ...session.metadata, locations };
        return session;
    }
    async setupWebhooksStep(session) {
        const baseUrl = process.env.NODE_ENV === 'production'
            ? process.env.NEXT_PUBLIC_APP_URL
            : 'http://localhost:3000';
        const webhookUrl = `${baseUrl}/api/webhooks`;
        try {
            await this.webhookManager.setupWebhooks(session.businessId, session.posType, webhookUrl, session.credentials);
        }
        catch (error) {
            console.warn('Webhook setup failed, continuing without webhooks:', error.message);
        }
        return session;
    }
    async testDataSyncStep(session) {
        const adapter = this.adapters.get(session.posType);
        const locations = session.metadata?.locations || [];
        if (locations.length > 0) {
            const testLocation = locations[0];
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            try {
                const sampleData = await adapter.getTransactions(session.credentials, testLocation.id, startDate, endDate);
                session.metadata = { ...session.metadata, sampleData: sampleData.slice(0, 5) };
            }
            catch (error) {
                console.warn('Sample data fetch failed:', error.message);
            }
        }
        return session;
    }
    async saveConfigurationStep(session) {
        const template = detection_1.POSDetector.getConfigurationTemplate(session.posType);
        const configuration = {
            ...template,
            posType: session.posType,
            credentials: session.credentials,
            isActive: true,
            settings: {
                autoSync: true,
                syncInterval: 30,
                enableWebhooks: true,
                taxCalculationMode: 'pos',
                multiLocationSupport: (session.metadata?.locations || []).length > 1
            }
        };
        await configuration_1.ConfigurationManager.saveConfiguration(session.businessId, configuration);
        return session;
    }
    async exchangeOAuthCode(posType, code, redirectUri) {
        const baseUrl = process.env.NODE_ENV === 'production'
            ? process.env.NEXT_PUBLIC_APP_URL
            : 'http://localhost:3000';
        const actualRedirectUri = redirectUri || `${baseUrl}/api/pos/oauth/callback`;
        switch (posType) {
            case 'shopify':
                throw new Error('Shopify OAuth exchange requires shop domain - implement in continueOnboarding');
            case 'square':
                const squareTokens = await SquareAdapter_1.SquareAdapter.exchangeCodeForToken(process.env.SQUARE_CLIENT_ID, process.env.SQUARE_CLIENT_SECRET, code, actualRedirectUri);
                return {
                    type: 'oauth',
                    accessToken: squareTokens.accessToken,
                    refreshToken: squareTokens.refreshToken
                };
            default:
                throw new Error(`OAuth exchange not implemented for ${posType}`);
        }
    }
    async getSession(sessionId) {
        let session = this.sessions.get(sessionId);
        if (!session) {
            try {
                const stored = await redis_1.redis.get(`onboarding_session:${sessionId}`);
                if (stored) {
                    session = JSON.parse(stored);
                    session.createdAt = new Date(session.createdAt);
                    session.expiresAt = new Date(session.expiresAt);
                    this.sessions.set(sessionId, session);
                }
            }
            catch (error) {
                console.error('Failed to load session from Redis:', error);
            }
        }
        if (session && session.expiresAt < new Date()) {
            this.sessions.delete(sessionId);
            await redis_1.redis.del(`onboarding_session:${sessionId}`);
            return null;
        }
        return session || null;
    }
    async updateSession(session) {
        this.sessions.set(session.id, session);
        await this.persistSession(session);
    }
    async persistSession(session) {
        try {
            const ttl = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
            await redis_1.redis.setex(`onboarding_session:${session.id}`, ttl, JSON.stringify(session));
        }
        catch (error) {
            console.error('Failed to persist session to Redis:', error);
        }
    }
    startSessionCleanup() {
        setInterval(() => {
            const now = new Date();
            const expiredSessions = Array.from(this.sessions.entries())
                .filter(([_, session]) => session.expiresAt < now)
                .map(([id, _]) => id);
            expiredSessions.forEach(id => {
                this.sessions.delete(id);
                redis_1.redis.del(`onboarding_session:${id}`).catch(console.error);
            });
            if (expiredSessions.length > 0) {
                console.log(`Cleaned up ${expiredSessions.length} expired onboarding sessions`);
            }
        }, 5 * 60 * 1000);
    }
    async cancelOnboarding(sessionId) {
        const session = await this.getSession(sessionId);
        if (session) {
            session.status = 'failed';
            session.error = 'Cancelled by user';
            await this.updateSession(session);
            this.emit('onboarding:cancelled', {
                sessionId: session.id,
                businessId: session.businessId
            });
        }
    }
    async getOnboardingProgress(sessionId) {
        const session = await this.getSession(sessionId);
        if (!session)
            return null;
        return {
            progress: session.progress,
            status: session.status,
            error: session.error
        };
    }
}
exports.POSOnboardingManager = POSOnboardingManager;
POSOnboardingManager.SESSION_DURATION = 30 * 60 * 1000;
POSOnboardingManager.OAUTH_CONFIGS = {
    shopify: {
        scopes: ['read_orders', 'read_products', 'read_locations', 'write_webhooks'],
        additionalParams: {}
    },
    square: {
        scopes: ['ORDERS_READ', 'PAYMENTS_READ', 'MERCHANT_PROFILE_READ', 'WEBHOOKS_WRITE'],
        additionalParams: { session: 'false' }
    },
    clover: {
        scopes: ['read:orders', 'read:payments', 'read:merchant'],
        additionalParams: {}
    },
    toast: {
        scopes: ['orders:read', 'config:read'],
        additionalParams: {}
    }
};
//# sourceMappingURL=onboarding.js.map