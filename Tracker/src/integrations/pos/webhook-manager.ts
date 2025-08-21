/**
 * Webhook Management System
 * Handles webhook lifecycle, validation, and processing for all POS systems
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import {
  POSSystemType,
  POSAdapter,
  WebhookConfiguration,
  AuthCredentials,
  POSEvent,
  POSEventHandler,
  StandardizedTaxData,
  POSIntegrationError
} from './types';
import { ShopifyAdapter } from './adapters/ShopifyAdapter';
import { SquareAdapter } from './adapters/SquareAdapter';
import { TaxDataTransformer } from './transformer';
import { ConfigurationManager } from './configuration';

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

interface IncomingWebhook {
  posType: POSSystemType;
  event: string;
  payload: any;
  signature: string;
  timestamp: Date;
  businessId?: string;
}

interface ProcessingResult {
  success: boolean;
  transactionData?: StandardizedTaxData;
  error?: string;
  retryable: boolean;
}

export class WebhookManager extends EventEmitter {
  private static instance: WebhookManager;
  private adapters: Map<POSSystemType, POSAdapter> = new Map();
  private transformers: Map<POSSystemType, TaxDataTransformer> = new Map();
  private eventHandlers: Map<string, POSEventHandler[]> = new Map();
  private processingQueue: IncomingWebhook[] = [];
  private isProcessing = false;

  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly RETRY_DELAYS = [1000, 5000, 15000, 60000]; // Progressive delays in ms
  private static readonly MAX_FAILURES = 10;

  private constructor() {
    super();
    this.initializeAdapters();
    this.startProcessingQueue();
  }

  public static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager();
    }
    return WebhookManager.instance;
  }

  /**
   * Initialize POS adapters
   */
  private initializeAdapters(): void {
    this.adapters.set('shopify', new ShopifyAdapter());
    this.adapters.set('square', new SquareAdapter());

    // Initialize transformers
    this.transformers.set('shopify', new TaxDataTransformer('shopify', {
      totalTaxField: 'total_tax',
      taxLinesField: 'tax_lines',
      taxRateField: 'rate',
      taxAmountField: 'price',
      jurisdictionField: 'source',
      locationField: 'location_id',
      transactionIdField: 'id',
      timestampField: 'created_at',
      totalAmountField: 'total_price',
      lineItemsField: 'line_items',
      statusField: 'financial_status'
    }));

    this.transformers.set('square', new TaxDataTransformer('square', {
      totalTaxField: 'total_tax_money.amount',
      taxLinesField: 'line_items[].taxes',
      taxRateField: 'percentage',
      taxAmountField: 'applied_money.amount',
      locationField: 'location_id',
      transactionIdField: 'id',
      timestampField: 'created_at',
      totalAmountField: 'total_money.amount',
      lineItemsField: 'line_items',
      statusField: 'state'
    }));
  }

  /**
   * Setup webhooks for a business and POS type
   */
  public async setupWebhooks(
    businessId: string,
    posType: POSSystemType,
    webhookUrl: string,
    credentials: AuthCredentials
  ): Promise<WebhookSubscription> {
    try {
      const adapter = this.adapters.get(posType);
      if (!adapter) {
        throw new POSIntegrationError(
          `No adapter found for POS type: ${posType}`,
          'ADAPTER_NOT_FOUND',
          posType
        );
      }

      // Setup webhooks with the POS system
      const webhookConfig = await adapter.setupWebhooks(credentials, webhookUrl);

      // Generate secret key for this subscription
      const secretKey = crypto.randomBytes(32).toString('hex');

      // Save subscription to database
      const subscription = await prisma.webhookSubscription.upsert({
        where: {
          businessId_posType: {
            businessId,
            posType
          }
        },
        update: {
          webhookUrl,
          events: JSON.stringify(webhookConfig.events),
          secretKey,
          isActive: true,
          failureCount: 0,
          updatedAt: new Date()
        },
        create: {
          id: crypto.randomUUID(),
          businessId,
          posType,
          webhookUrl,
          events: JSON.stringify(webhookConfig.events),
          secretKey,
          isActive: true,
          failureCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Cache the subscription
      const cacheKey = `webhook_sub:${businessId}:${posType}`;
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(subscription));

      console.log(`Webhooks setup successfully for ${businessId}:${posType}`);

      return {
        id: subscription.id,
        businessId: subscription.businessId,
        posType: subscription.posType as POSSystemType,
        webhookUrl: subscription.webhookUrl,
        events: JSON.parse(subscription.events),
        secretKey: subscription.secretKey,
        isActive: subscription.isActive,
        lastProcessed: subscription.lastProcessed || undefined,
        failureCount: subscription.failureCount,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt
      };
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to setup webhooks: ${error.message}`,
        'WEBHOOK_SETUP_FAILED',
        posType,
        undefined,
        true,
        { businessId, error: error.message }
      );
    }
  }

  /**
   * Process incoming webhook
   */
  public async processWebhook(
    posType: POSSystemType,
    event: string,
    payload: any,
    signature: string,
    businessId?: string
  ): Promise<ProcessingResult> {
    try {
      const webhook: IncomingWebhook = {
        posType,
        event,
        payload,
        signature,
        timestamp: new Date(),
        businessId
      };

      // Add to processing queue
      this.processingQueue.push(webhook);

      // Start processing if not already running
      if (!this.isProcessing) {
        this.startProcessingQueue();
      }

      return { success: true, retryable: false };
    } catch (error) {
      console.error('Failed to queue webhook for processing:', error);
      return {
        success: false,
        error: error.message,
        retryable: true
      };
    }
  }

  /**
   * Start processing webhook queue
   */
  private async startProcessingQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const webhook = this.processingQueue.shift();
        if (!webhook) continue;

        try {
          await this.processWebhookInternal(webhook);
        } catch (error) {
          console.error('Failed to process webhook:', error);
          
          // Handle retryable errors
          if (error.retryable && webhook.businessId) {
            await this.handleWebhookFailure(webhook, error);
          }
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Internal webhook processing
   */
  private async processWebhookInternal(webhook: IncomingWebhook): Promise<void> {
    const { posType, event, payload, signature, businessId } = webhook;

    // Get subscription for validation
    const subscription = businessId 
      ? await this.getSubscription(businessId, posType)
      : null;

    // Validate webhook signature if subscription exists
    if (subscription) {
      const isValid = await this.validateWebhookSignature(
        posType,
        payload,
        signature,
        subscription.secretKey
      );

      if (!isValid) {
        throw new POSIntegrationError(
          'Invalid webhook signature',
          'WEBHOOK_INVALID_SIGNATURE',
          posType,
          undefined,
          false
        );
      }
    }

    // Transform webhook data to standardized format
    let transactionData: StandardizedTaxData | null = null;

    if (this.isTransactionEvent(event)) {
      const transformer = this.transformers.get(posType);
      if (transformer) {
        try {
          transactionData = transformer.transform(payload);
        } catch (error) {
          console.warn(`Failed to transform ${posType} webhook data:`, error);
        }
      }
    }

    // Emit POS event
    const posEvent: POSEvent = {
      type: this.mapEventType(event),
      posType,
      locationId: this.extractLocationId(payload, posType),
      timestamp: new Date(),
      data: transactionData || payload
    };

    this.emit('webhook:received', posEvent);

    // Execute registered event handlers
    await this.executeEventHandlers(posEvent);

    // Update subscription last processed time
    if (subscription) {
      await this.updateSubscriptionLastProcessed(subscription.id);
    }

    console.log(`Processed ${posType} webhook: ${event}`);
  }

  /**
   * Validate webhook signature
   */
  private async validateWebhookSignature(
    posType: POSSystemType,
    payload: any,
    signature: string,
    secretKey: string
  ): Promise<boolean> {
    try {
      const adapter = this.adapters.get(posType);
      if (!adapter) {
        console.warn(`No adapter found for signature validation: ${posType}`);
        return false;
      }

      return adapter.validateWebhook(payload, signature, secretKey);
    } catch (error) {
      console.error(`Webhook signature validation failed for ${posType}:`, error);
      return false;
    }
  }

  /**
   * Get webhook subscription from cache or database
   */
  private async getSubscription(
    businessId: string,
    posType: POSSystemType
  ): Promise<WebhookSubscription | null> {
    try {
      // Try cache first
      const cacheKey = `webhook_sub:${businessId}:${posType}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const subscription = JSON.parse(cached);
        return {
          ...subscription,
          events: JSON.parse(subscription.events),
          createdAt: new Date(subscription.createdAt),
          updatedAt: new Date(subscription.updatedAt),
          lastProcessed: subscription.lastProcessed ? new Date(subscription.lastProcessed) : undefined
        };
      }

      // Fallback to database
      const stored = await prisma.webhookSubscription.findUnique({
        where: {
          businessId_posType: {
            businessId,
            posType
          }
        }
      });

      if (!stored) return null;

      const subscription: WebhookSubscription = {
        id: stored.id,
        businessId: stored.businessId,
        posType: stored.posType as POSSystemType,
        webhookUrl: stored.webhookUrl,
        events: JSON.parse(stored.events),
        secretKey: stored.secretKey,
        isActive: stored.isActive,
        lastProcessed: stored.lastProcessed || undefined,
        failureCount: stored.failureCount,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt
      };

      // Update cache
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stored));

      return subscription;
    } catch (error) {
      console.error('Failed to get webhook subscription:', error);
      return null;
    }
  }

  /**
   * Update subscription last processed timestamp
   */
  private async updateSubscriptionLastProcessed(subscriptionId: string): Promise<void> {
    try {
      await prisma.webhookSubscription.update({
        where: { id: subscriptionId },
        data: { 
          lastProcessed: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to update subscription last processed:', error);
    }
  }

  /**
   * Handle webhook processing failure
   */
  private async handleWebhookFailure(
    webhook: IncomingWebhook,
    error: POSIntegrationError
  ): Promise<void> {
    if (!webhook.businessId) return;

    try {
      // Increment failure count
      await prisma.webhookSubscription.updateMany({
        where: {
          businessId: webhook.businessId,
          posType: webhook.posType
        },
        data: {
          failureCount: { increment: 1 },
          updatedAt: new Date()
        }
      });

      // Get current failure count
      const subscription = await this.getSubscription(webhook.businessId, webhook.posType);
      if (!subscription) return;

      // Disable webhook if too many failures
      if (subscription.failureCount >= this.MAX_FAILURES) {
        await this.disableWebhook(webhook.businessId, webhook.posType);
        
        // Emit webhook failure event
        this.emit('webhook:disabled', {
          businessId: webhook.businessId,
          posType: webhook.posType,
          reason: 'Too many failures',
          failureCount: subscription.failureCount
        });

        console.error(`Disabled webhook for ${webhook.businessId}:${webhook.posType} due to excessive failures`);
        return;
      }

      // Schedule retry if retryable
      if (error.retryable && subscription.failureCount < this.RETRY_DELAYS.length) {
        const delay = this.RETRY_DELAYS[subscription.failureCount - 1] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
        
        setTimeout(() => {
          this.processingQueue.push(webhook);
          if (!this.isProcessing) {
            this.startProcessingQueue();
          }
        }, delay);

        console.log(`Scheduled webhook retry for ${webhook.posType} in ${delay}ms`);
      }
    } catch (error) {
      console.error('Failed to handle webhook failure:', error);
    }
  }

  /**
   * Disable webhook subscription
   */
  private async disableWebhook(businessId: string, posType: POSSystemType): Promise<void> {
    try {
      await prisma.webhookSubscription.updateMany({
        where: {
          businessId,
          posType
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Clear cache
      const cacheKey = `webhook_sub:${businessId}:${posType}`;
      await redis.del(cacheKey);
    } catch (error) {
      console.error('Failed to disable webhook:', error);
    }
  }

  /**
   * Register event handler
   */
  public on(eventType: string, handler: POSEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
    super.on(eventType, handler);
  }

  /**
   * Execute registered event handlers
   */
  private async executeEventHandlers(event: POSEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Event handler failed for ${event.type}:`, error);
        }
      })
    );
  }

  /**
   * Check if event is a transaction-related event
   */
  private isTransactionEvent(event: string): boolean {
    const transactionEvents = [
      'orders/create',
      'orders/updated',
      'orders/paid',
      'order.created',
      'order.updated',
      'payment.created',
      'payment.updated'
    ];
    
    return transactionEvents.some(txEvent => event.includes(txEvent));
  }

  /**
   * Map POS-specific event names to standard event types
   */
  private mapEventType(event: string): POSEvent['type'] {
    if (event.includes('create')) return 'transaction.created';
    if (event.includes('updated') || event.includes('paid')) return 'transaction.updated';
    if (event.includes('refund') || event.includes('cancel')) return 'transaction.refunded';
    if (event.includes('sync')) return 'sync.completed';
    return 'transaction.updated';
  }

  /**
   * Extract location ID from webhook payload
   */
  private extractLocationId(payload: any, posType: POSSystemType): string | undefined {
    switch (posType) {
      case 'shopify':
        return payload.location_id?.toString();
      case 'square':
        return payload.location_id || payload.order?.location_id;
      default:
        return undefined;
    }
  }

  /**
   * Get webhook statistics for monitoring
   */
  public async getWebhookStats(): Promise<{
    activeSubscriptions: number;
    subscriptionsByPOS: Record<POSSystemType, number>;
    recentlyProcessed: number;
    failedSubscriptions: number;
  }> {
    try {
      const total = await prisma.webhookSubscription.count({
        where: { isActive: true }
      });

      const byPOS = await prisma.webhookSubscription.groupBy({
        by: ['posType'],
        where: { isActive: true },
        _count: true
      });

      const subscriptionsByPOS = byPOS.reduce((acc, item) => {
        acc[item.posType as POSSystemType] = item._count;
        return acc;
      }, {} as Record<POSSystemType, number>);

      const recentlyProcessed = await prisma.webhookSubscription.count({
        where: {
          isActive: true,
          lastProcessed: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      const failed = await prisma.webhookSubscription.count({
        where: {
          failureCount: { gte: this.MAX_FAILURES }
        }
      });

      return {
        activeSubscriptions: total,
        subscriptionsByPOS,
        recentlyProcessed,
        failedSubscriptions: failed
      };
    } catch (error) {
      console.error('Failed to get webhook stats:', error);
      return {
        activeSubscriptions: 0,
        subscriptionsByPOS: {} as Record<POSSystemType, number>,
        recentlyProcessed: 0,
        failedSubscriptions: 0
      };
    }
  }

  /**
   * Remove webhook subscription
   */
  public async removeWebhook(businessId: string, posType: POSSystemType): Promise<void> {
    try {
      await prisma.webhookSubscription.deleteMany({
        where: { businessId, posType }
      });

      // Clear cache
      const cacheKey = `webhook_sub:${businessId}:${posType}`;
      await redis.del(cacheKey);

      console.log(`Removed webhook subscription for ${businessId}:${posType}`);
    } catch (error) {
      console.error('Failed to remove webhook:', error);
    }
  }

  /**
   * Add new POS adapter (for future integrations)
   */
  public addAdapter(posType: POSSystemType, adapter: POSAdapter): void {
    this.adapters.set(posType, adapter);
    console.log(`Added adapter for ${posType}`);
  }
}
