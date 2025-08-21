import { EventEmitter } from 'events';
import { POSSystemType, POSAdapter, AuthCredentials, POSEventHandler, StandardizedTaxData } from './types';
interface WebhookSubscription {
    id: string;
    businessId: string;
    posType: POSSystemType;
    webhookUrl: string;
    events: string[];
    secretKey: string;
    isActive: boolean;
    lastProcessed?: Date;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}
interface ProcessingResult {
    success: boolean;
    transactionData?: StandardizedTaxData;
    error?: string;
    retryable: boolean;
}
export declare class WebhookManager extends EventEmitter {
    private static instance;
    private adapters;
    private transformers;
    private eventHandlers;
    private processingQueue;
    private isProcessing;
    private static readonly CACHE_TTL;
    private static readonly RETRY_DELAYS;
    private static readonly MAX_FAILURES;
    private constructor();
    static getInstance(): WebhookManager;
    private initializeAdapters;
    setupWebhooks(businessId: string, posType: POSSystemType, webhookUrl: string, credentials: AuthCredentials): Promise<WebhookSubscription>;
    processWebhook(posType: POSSystemType, event: string, payload: any, signature: string, businessId?: string): Promise<ProcessingResult>;
    private startProcessingQueue;
    private processWebhookInternal;
    private validateWebhookSignature;
    private getSubscription;
    private updateSubscriptionLastProcessed;
    private handleWebhookFailure;
    private disableWebhook;
    on(eventType: string, handler: POSEventHandler): void;
    private executeEventHandlers;
    private isTransactionEvent;
    private mapEventType;
    private extractLocationId;
    getWebhookStats(): Promise<{
        activeSubscriptions: number;
        subscriptionsByPOS: Record<POSSystemType, number>;
        recentlyProcessed: number;
        failedSubscriptions: number;
    }>;
    removeWebhook(businessId: string, posType: POSSystemType): Promise<void>;
    addAdapter(posType: POSSystemType, adapter: POSAdapter): void;
}
export {};
//# sourceMappingURL=webhook-manager.d.ts.map