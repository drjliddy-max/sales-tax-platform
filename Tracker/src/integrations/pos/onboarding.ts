/**
 * POS Onboarding System
 * Handles the complete onboarding flow for connecting POS systems
 * Including OAuth flows, connection verification, and automatic configuration
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import {
  POSSystemType,
  POSAdapter,
  AuthCredentials,
  POSConfiguration,
  LocationInfo,
  StandardizedTaxData,
  POSIntegrationError
} from './types';
import { POSDetector } from './detection';
import { ConfigurationManager } from './configuration';
import { WebhookManager } from './webhook-manager';
import { ShopifyAdapter } from './adapters/ShopifyAdapter';
import { SquareAdapter } from './adapters/SquareAdapter';

interface OnboardingSession {
  id: string;
  businessId: string;
  posType?: POSSystemType;
  state: string; // CSRF protection
  status: 'initiated' | 'authenticating' | 'configuring' | 'testing' | 'completed' | 'failed';
  credentials?: Partial<AuthCredentials>;
  detectionResults?: any[];
  error?: string;
  progress: {
    step: number;
    totalSteps: number;
    currentStep: string;
    completedSteps: string[];
  };
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, any>;
}

interface OnboardingStep {
  name: string;
  description: string;
  action: (session: OnboardingSession, data?: any) => Promise<OnboardingSession>;
  rollback?: (session: OnboardingSession) => Promise<void>;
}

interface OnboardingResult {
  success: boolean;
  session: OnboardingSession;
  configuration?: POSConfiguration;
  locations?: LocationInfo[];
  sampleData?: StandardizedTaxData[];
  nextAction?: {
    type: 'oauth_redirect' | 'manual_credentials' | 'complete';
    url?: string;
    data?: any;
  };
}

export class POSOnboardingManager extends EventEmitter {
  private static instance: POSOnboardingManager;
  private adapters: Map<POSSystemType, POSAdapter> = new Map();
  private sessions: Map<string, OnboardingSession> = new Map();
  private webhookManager: WebhookManager;

  private static readonly SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
  private static readonly OAUTH_CONFIGS = {
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

  private readonly onboardingSteps: OnboardingStep[] = [
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

  private constructor() {
    super();
    this.initializeAdapters();
    this.webhookManager = WebhookManager.getInstance();
    this.startSessionCleanup();
  }

  public static getInstance(): POSOnboardingManager {
    if (!POSOnboardingManager.instance) {
      POSOnboardingManager.instance = new POSOnboardingManager();
    }
    return POSOnboardingManager.instance;
  }

  /**
   * Initialize POS adapters
   */
  private initializeAdapters(): void {
    this.adapters.set('shopify', new ShopifyAdapter());
    this.adapters.set('square', new SquareAdapter());
    // Additional adapters will be added here
  }

  /**
   * Start the onboarding process for a business
   */
  public async startOnboarding(
    businessId: string,
    posType?: POSSystemType,
    redirectUri?: string
  ): Promise<OnboardingResult> {
    try {
      const sessionId = crypto.randomUUID();
      const state = crypto.randomBytes(16).toString('hex');
      
      const session: OnboardingSession = {
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

      // If POS type is known, start authentication
      if (posType && this.adapters.has(posType)) {
        return await this.continueOnboarding(sessionId);
      }

      // Otherwise, return session for POS selection
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
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to start onboarding: ${error.message}`,
        'ONBOARDING_START_FAILED',
        posType || 'unknown',
        undefined,
        true,
        { businessId, error: error.message }
      );
    }
  }

  /**
   * Continue onboarding process with POS credentials or OAuth callback
   */
  public async continueOnboarding(
    sessionId: string,
    data?: {
      posType?: POSSystemType;
      credentials?: Partial<AuthCredentials>;
      oauthCode?: string;
      oauthState?: string;
      shopDomain?: string; // For Shopify
    }
  ): Promise<OnboardingResult> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new POSIntegrationError(
        'Invalid or expired onboarding session',
        'SESSION_NOT_FOUND',
        'unknown'
      );
    }

    try {
      // Verify CSRF state if provided
      if (data?.oauthState && data.oauthState !== session.state) {
        throw new POSIntegrationError(
          'Invalid OAuth state parameter',
          'INVALID_STATE',
          session.posType || 'unknown'
        );
      }

      // Update session with new data
      if (data?.posType && !session.posType) {
        session.posType = data.posType;
      }

      if (data?.credentials) {
        session.credentials = { ...session.credentials, ...data.credentials };
      }

      if (data?.shopDomain) {
        session.credentials = { ...session.credentials, shopDomain: data.shopDomain };
      }

      // Handle OAuth callback
      if (data?.oauthCode && session.posType) {
        const adapter = this.adapters.get(session.posType);
        if (adapter) {
          const tokenData = await this.exchangeOAuthCode(session.posType, data.oauthCode, session.metadata?.redirectUri);
          session.credentials = { ...session.credentials, ...tokenData };
        }
      }

      // Continue with onboarding steps
      return await this.executeOnboardingSteps(session);
    } catch (error) {
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

  /**
   * Generate OAuth URL for POS system
   */
  public generateOAuthUrl(
    sessionId: string,
    posType: POSSystemType,
    shopDomain?: string
  ): string {
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
        if (!shopDomain) throw new Error('Shop domain required for Shopify');
        return ShopifyAdapter.generateOAuthUrl(
          process.env.SHOPIFY_CLIENT_ID!,
          shopDomain,
          redirectUri,
          config.scopes
        );

      case 'square':
        return SquareAdapter.generateOAuthUrl(
          process.env.SQUARE_CLIENT_ID!,
          redirectUri,
          config.scopes,
          session.state
        );

      default:
        throw new Error(`OAuth URL generation not implemented for ${posType}`);
    }
  }

  /**
   * Execute onboarding steps sequentially
   */
  private async executeOnboardingSteps(session: OnboardingSession): Promise<OnboardingResult> {
    try {
      session.status = 'configuring';
      await this.updateSession(session);

      // Execute each onboarding step
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
        } catch (stepError) {
          // Handle step failure
          session.status = 'failed';
          session.error = `Failed at ${step.name}: ${stepError.message}`;
          await this.updateSession(session);

          this.emit('onboarding:step_failed', {
            sessionId: session.id,
            businessId: session.businessId,
            step: step.name,
            error: stepError.message
          });

          // Attempt rollback if available
          if (step.rollback) {
            try {
              await step.rollback(session);
            } catch (rollbackError) {
              console.error('Rollback failed:', rollbackError);
            }
          }

          throw stepError;
        }
      }

      // All steps completed successfully
      session.status = 'completed';
      session.progress.step = this.onboardingSteps.length;
      session.progress.currentStep = 'completed';
      await this.updateSession(session);

      // Load the saved configuration
      const configuration = await ConfigurationManager.loadConfiguration(
        session.businessId,
        session.posType!
      );

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

    } catch (error) {
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

  /**
   * Detect POS system type
   */
  private async detectPOSStep(session: OnboardingSession): Promise<OnboardingSession> {
    if (session.posType && session.credentials?.accessToken) {
      // POS type already known, verify with detection
      try {
        const detection = await POSDetector.detectPOSSystem(session.credentials as AuthCredentials);
        if (detection.posType !== session.posType) {
          console.warn(`POS type mismatch: expected ${session.posType}, detected ${detection.posType}`);
        }
        session.detectionResults = [detection];
      } catch (error) {
        console.warn('POS detection failed, continuing with provided type:', error.message);
      }
    }
    
    return session;
  }

  /**
   * Authenticate with POS system
   */
  private async authenticateStep(session: OnboardingSession): Promise<OnboardingSession> {
    if (!session.posType || !session.credentials) {
      throw new Error('POS type and credentials required');
    }

    const adapter = this.adapters.get(session.posType);
    if (!adapter) {
      throw new Error(`No adapter available for ${session.posType}`);
    }

    const authenticatedCredentials = await adapter.authenticate(session.credentials as AuthCredentials);
    session.credentials = authenticatedCredentials;
    
    return session;
  }

  /**
   * Test connection and permissions
   */
  private async testConnectionStep(session: OnboardingSession): Promise<OnboardingSession> {
    const adapter = this.adapters.get(session.posType!);
    const connectionTest = await adapter!.testConnection(session.credentials as AuthCredentials);
    
    if (!connectionTest) {
      throw new Error('Connection test failed - please check your credentials');
    }
    
    return session;
  }

  /**
   * Fetch store locations
   */
  private async fetchLocationsStep(session: OnboardingSession): Promise<OnboardingSession> {
    const adapter = this.adapters.get(session.posType!);
    const locations = await adapter!.getLocations(session.credentials as AuthCredentials);
    
    if (locations.length === 0) {
      throw new Error('No locations found - please ensure your account has at least one location configured');
    }
    
    session.metadata = { ...session.metadata, locations };
    return session;
  }

  /**
   * Setup webhooks
   */
  private async setupWebhooksStep(session: OnboardingSession): Promise<OnboardingSession> {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_APP_URL 
      : 'http://localhost:3000';
    
    const webhookUrl = `${baseUrl}/api/webhooks`;

    try {
      await this.webhookManager.setupWebhooks(
        session.businessId,
        session.posType!,
        webhookUrl,
        session.credentials as AuthCredentials
      );
    } catch (error) {
      console.warn('Webhook setup failed, continuing without webhooks:', error.message);
      // Don't fail onboarding if webhooks fail - they can be setup later
    }
    
    return session;
  }

  /**
   * Test data synchronization
   */
  private async testDataSyncStep(session: OnboardingSession): Promise<OnboardingSession> {
    const adapter = this.adapters.get(session.posType!);
    const locations = session.metadata?.locations as LocationInfo[] || [];
    
    if (locations.length > 0) {
      const testLocation = locations[0];
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Last 7 days
      
      try {
        const sampleData = await adapter!.getTransactions(
          session.credentials as AuthCredentials,
          testLocation.id,
          startDate,
          endDate
        );
        
        session.metadata = { ...session.metadata, sampleData: sampleData.slice(0, 5) }; // Store first 5 transactions
      } catch (error) {
        console.warn('Sample data fetch failed:', error.message);
        // Don't fail if no recent transactions
      }
    }
    
    return session;
  }

  /**
   * Save configuration
   */
  private async saveConfigurationStep(session: OnboardingSession): Promise<OnboardingSession> {
    const template = POSDetector.getConfigurationTemplate(session.posType!);
    
    const configuration: POSConfiguration = {
      ...template,
      posType: session.posType!,
      credentials: session.credentials as AuthCredentials,
      isActive: true,
      settings: {
        autoSync: true,
        syncInterval: 30, // 30 minutes
        enableWebhooks: true,
        taxCalculationMode: 'pos',
        multiLocationSupport: (session.metadata?.locations as LocationInfo[] || []).length > 1
      }
    };

    await ConfigurationManager.saveConfiguration(session.businessId, configuration);
    return session;
  }

  /**
   * Exchange OAuth code for tokens
   */
  private async exchangeOAuthCode(
    posType: POSSystemType,
    code: string,
    redirectUri?: string
  ): Promise<Partial<AuthCredentials>> {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_APP_URL 
      : 'http://localhost:3000';
    
    const actualRedirectUri = redirectUri || `${baseUrl}/api/pos/oauth/callback`;

    switch (posType) {
      case 'shopify':
        // Note: Shopify requires shop domain in the exchange, which should be in session
        throw new Error('Shopify OAuth exchange requires shop domain - implement in continueOnboarding');

      case 'square':
        const squareTokens = await SquareAdapter.exchangeCodeForToken(
          process.env.SQUARE_CLIENT_ID!,
          process.env.SQUARE_CLIENT_SECRET!,
          code,
          actualRedirectUri
        );
        return {
          type: 'oauth',
          accessToken: squareTokens.accessToken,
          refreshToken: squareTokens.refreshToken
        };

      default:
        throw new Error(`OAuth exchange not implemented for ${posType}`);
    }
  }

  /**
   * Get onboarding session
   */
  public async getSession(sessionId: string): Promise<OnboardingSession | null> {
    // Try memory first
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Try database
      try {
        const stored = await redis.get(`onboarding_session:${sessionId}`);
        if (stored) {
          session = JSON.parse(stored);
          session!.createdAt = new Date(session!.createdAt);
          session!.expiresAt = new Date(session!.expiresAt);
          this.sessions.set(sessionId, session!);
        }
      } catch (error) {
        console.error('Failed to load session from Redis:', error);
      }
    }

    // Check expiration
    if (session && session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      await redis.del(`onboarding_session:${sessionId}`);
      return null;
    }

    return session || null;
  }

  /**
   * Update session
   */
  private async updateSession(session: OnboardingSession): Promise<void> {
    this.sessions.set(session.id, session);
    await this.persistSession(session);
  }

  /**
   * Persist session to Redis
   */
  private async persistSession(session: OnboardingSession): Promise<void> {
    try {
      const ttl = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
      await redis.setex(`onboarding_session:${session.id}`, ttl, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to persist session to Redis:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions = Array.from(this.sessions.entries())
        .filter(([_, session]) => session.expiresAt < now)
        .map(([id, _]) => id);

      expiredSessions.forEach(id => {
        this.sessions.delete(id);
        redis.del(`onboarding_session:${id}`).catch(console.error);
      });

      if (expiredSessions.length > 0) {
        console.log(`Cleaned up ${expiredSessions.length} expired onboarding sessions`);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Cancel onboarding session
   */
  public async cancelOnboarding(sessionId: string): Promise<void> {
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

  /**
   * Get onboarding progress
   */
  public async getOnboardingProgress(sessionId: string): Promise<{
    progress: OnboardingSession['progress'];
    status: OnboardingSession['status'];
    error?: string;
  } | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;

    return {
      progress: session.progress,
      status: session.status,
      error: session.error
    };
  }
}
