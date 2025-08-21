import { EventEmitter } from 'events';
import { POSSystemType, AuthCredentials, POSConfiguration, LocationInfo, StandardizedTaxData } from './types';
interface OnboardingSession {
    id: string;
    businessId: string;
    posType?: POSSystemType;
    state: string;
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
export declare class POSOnboardingManager extends EventEmitter {
    private static instance;
    private adapters;
    private sessions;
    private webhookManager;
    private static readonly SESSION_DURATION;
    private static readonly OAUTH_CONFIGS;
    private readonly onboardingSteps;
    private constructor();
    static getInstance(): POSOnboardingManager;
    private initializeAdapters;
    startOnboarding(businessId: string, posType?: POSSystemType, redirectUri?: string): Promise<OnboardingResult>;
    continueOnboarding(sessionId: string, data?: {
        posType?: POSSystemType;
        credentials?: Partial<AuthCredentials>;
        oauthCode?: string;
        oauthState?: string;
        shopDomain?: string;
    }): Promise<OnboardingResult>;
    generateOAuthUrl(sessionId: string, posType: POSSystemType, shopDomain?: string): string;
    private executeOnboardingSteps;
    private detectPOSStep;
    private authenticateStep;
    private testConnectionStep;
    private fetchLocationsStep;
    private setupWebhooksStep;
    private testDataSyncStep;
    private saveConfigurationStep;
    private exchangeOAuthCode;
    getSession(sessionId: string): Promise<OnboardingSession | null>;
    private updateSession;
    private persistSession;
    private startSessionCleanup;
    cancelOnboarding(sessionId: string): Promise<void>;
    getOnboardingProgress(sessionId: string): Promise<{
        progress: OnboardingSession['progress'];
        status: OnboardingSession['status'];
        error?: string;
    } | null>;
}
export {};
//# sourceMappingURL=onboarding.d.ts.map