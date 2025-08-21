import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  events: string[];
  status: 'active' | 'inactive' | 'failed';
  integrationId: string;
  createdAt: Date;
  lastDelivery?: Date;
  lastSuccess?: Date;
  failureCount: number;
  rateLimitReset?: Date;
  rateLimitRemaining?: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  attemptNumber: number;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  statusCode?: number;
  responseBody?: string;
  error?: string;
  deliveredAt?: Date;
  nextRetryAt?: Date;
  createdAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  integrationId: string;
  timestamp: Date;
  livemode: boolean;
  retry: boolean;
}

export interface WebhookRetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
  enableJitter: boolean;
}

export interface WebhookRateLimit {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  resetWindowMinutes: number;
}

export class WebhookManager extends EventEmitter {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private deliveryQueue: Map<string, WebhookDelivery[]> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  
  private defaultRetryConfig: WebhookRetryConfig = {
    maxAttempts: 5,
    backoffMultiplier: 2,
    initialDelay: 1000, // 1 second
    maxDelay: 300000, // 5 minutes
    enableJitter: true
  };

  private defaultRateLimit: WebhookRateLimit = {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    resetWindowMinutes: 1
  };

  constructor() {
    super();
    this.startDeliveryProcessor();
  }

  async registerWebhook(endpoint: Omit<WebhookEndpoint, 'id' | 'createdAt' | 'failureCount'>): Promise<string> {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const webhookEndpoint: WebhookEndpoint = {
      id: webhookId,
      createdAt: new Date(),
      failureCount: 0,
      ...endpoint
    };

    this.endpoints.set(webhookId, webhookEndpoint);
    this.deliveryQueue.set(webhookId, []);

    // Initialize rate limiter
    const rateLimiter = new RateLimiter(this.defaultRateLimit);
    this.rateLimiters.set(webhookId, rateLimiter);

    logger.info(`Registered webhook endpoint: ${webhookId} for ${endpoint.url}`);
    
    this.emit('webhook:registered', { webhook: webhookEndpoint });
    
    return webhookId;
  }

  async unregisterWebhook(webhookId: string): Promise<void> {
    const webhook = this.endpoints.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    // Clean up pending deliveries
    this.deliveryQueue.delete(webhookId);
    
    // Clear retry timers
    const timer = this.retryTimers.get(webhookId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(webhookId);
    }

    // Remove rate limiter
    this.rateLimiters.delete(webhookId);

    this.endpoints.delete(webhookId);

    logger.info(`Unregistered webhook endpoint: ${webhookId}`);
    
    this.emit('webhook:unregistered', { webhookId, webhook });
  }

  async deliverEvent(event: WebhookEvent): Promise<void> {
    const relevantWebhooks = Array.from(this.endpoints.values()).filter(
      webhook => 
        webhook.status === 'active' && 
        webhook.integrationId === event.integrationId &&
        webhook.events.includes(event.type)
    );

    if (relevantWebhooks.length === 0) {
      logger.debug(`No webhooks registered for event ${event.type} on integration ${event.integrationId}`);
      return;
    }

    for (const webhook of relevantWebhooks) {
      await this.queueDelivery(webhook, event);
    }
  }

  private async queueDelivery(webhook: WebhookEndpoint, event: WebhookEvent): Promise<void> {
    const delivery: WebhookDelivery = {
      id: `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      webhookId: webhook.id,
      event,
      attemptNumber: 1,
      status: 'pending',
      createdAt: new Date()
    };

    const queue = this.deliveryQueue.get(webhook.id) || [];
    queue.push(delivery);
    this.deliveryQueue.set(webhook.id, queue);

    logger.debug(`Queued delivery ${delivery.id} for webhook ${webhook.id}`);
    
    this.emit('delivery:queued', { delivery, webhook });

    // Process immediately if rate limits allow
    await this.processDelivery(delivery, webhook);
  }

  private async processDelivery(delivery: WebhookDelivery, webhook: WebhookEndpoint): Promise<void> {
    const rateLimiter = this.rateLimiters.get(webhook.id);
    
    // Check rate limits
    if (rateLimiter && !rateLimiter.canMakeRequest()) {
      logger.debug(`Rate limited for webhook ${webhook.id}, delaying delivery`);
      
      // Schedule retry when rate limit resets
      const resetTime = rateLimiter.getResetTime();
      const delay = resetTime.getTime() - Date.now();
      
      setTimeout(() => {
        this.processDelivery(delivery, webhook);
      }, Math.max(delay, 1000));
      
      return;
    }

    try {
      delivery.status = 'pending';
      
      const startTime = Date.now();
      
      // Create webhook signature
      const signature = await this.createSignature(delivery.event, webhook.secret);
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SalesTaxTracker-Webhooks/1.0',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event-Type': delivery.event.type,
          'X-Webhook-Event-Id': delivery.event.id,
          'X-Webhook-Delivery-Id': delivery.id,
          'X-Webhook-Timestamp': delivery.event.timestamp.toISOString()
        },
        body: JSON.stringify(delivery.event.data),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const deliveryTime = Date.now() - startTime;
      
      delivery.statusCode = response.status;
      delivery.responseBody = await response.text().catch(() => '');
      delivery.deliveredAt = new Date();

      // Record rate limit usage
      if (rateLimiter) {
        rateLimiter.recordRequest();
        
        // Update webhook rate limit status from response headers
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        
        if (rateLimitRemaining) {
          webhook.rateLimitRemaining = parseInt(rateLimitRemaining);
        }
        
        if (rateLimitReset) {
          webhook.rateLimitReset = new Date(parseInt(rateLimitReset) * 1000);
        }
      }

      if (response.ok) {
        delivery.status = 'delivered';
        webhook.lastSuccess = new Date();
        webhook.lastDelivery = new Date();
        webhook.failureCount = 0; // Reset failure count on success

        logger.info(`Webhook delivery successful: ${delivery.id} to ${webhook.url} (${deliveryTime}ms)`);
        
        this.emit('delivery:success', { delivery, webhook, deliveryTime });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      webhook.failureCount++;

      logger.error(`Webhook delivery failed: ${delivery.id} to ${webhook.url} - ${delivery.error}`);
      
      this.emit('delivery:failed', { delivery, webhook, error });

      // Schedule retry if we haven't exceeded max attempts
      if (delivery.attemptNumber < this.defaultRetryConfig.maxAttempts && delivery.event.retry) {
        await this.scheduleRetry(delivery, webhook);
      } else {
        // Disable webhook if it has too many consecutive failures
        if (webhook.failureCount >= 10) {
          webhook.status = 'failed';
          logger.warn(`Webhook disabled due to excessive failures: ${webhook.id}`);
          
          this.emit('webhook:disabled', { webhook });
        }
      }
    }

    // Remove from queue if processing is complete
    if (delivery.status === 'delivered' || 
        delivery.attemptNumber >= this.defaultRetryConfig.maxAttempts) {
      this.removeFromQueue(webhook.id, delivery.id);
    }
  }

  private async scheduleRetry(delivery: WebhookDelivery, webhook: WebhookEndpoint): Promise<void> {
    const config = this.defaultRetryConfig;
    let delay = config.initialDelay * Math.pow(config.backoffMultiplier, delivery.attemptNumber - 1);
    
    // Apply maximum delay cap
    delay = Math.min(delay, config.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (config.enableJitter) {
      delay = delay + (Math.random() * delay * 0.1); // Add up to 10% jitter
    }

    delivery.attemptNumber++;
    delivery.status = 'retrying';
    delivery.nextRetryAt = new Date(Date.now() + delay);

    logger.debug(`Scheduling retry ${delivery.attemptNumber} for delivery ${delivery.id} in ${delay}ms`);
    
    this.emit('delivery:retry_scheduled', { delivery, webhook, delay });

    // Clear existing timer if any
    const existingTimer = this.retryTimers.get(delivery.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule the retry
    const timer = setTimeout(() => {
      this.processDelivery(delivery, webhook);
      this.retryTimers.delete(delivery.id);
    }, delay);

    this.retryTimers.set(delivery.id, timer);
  }

  private removeFromQueue(webhookId: string, deliveryId: string): void {
    const queue = this.deliveryQueue.get(webhookId);
    if (queue) {
      const filteredQueue = queue.filter(d => d.id !== deliveryId);
      this.deliveryQueue.set(webhookId, filteredQueue);
    }
  }

  private async createSignature(event: WebhookEvent, secret: string): Promise<string> {
    const crypto = await import('crypto');
    const payload = JSON.stringify(event.data);
    const timestamp = Math.floor(event.timestamp.getTime() / 1000);
    
    const signaturePayload = `${timestamp}.${payload}`;
    const signature = crypto.createHmac('sha256', secret)
      .update(signaturePayload, 'utf8')
      .digest('hex');
    
    return `t=${timestamp},v1=${signature}`;
  }

  private startDeliveryProcessor(): void {
    // Process pending deliveries every 10 seconds
    setInterval(() => {
      this.processPendingDeliveries();
    }, 10000);
  }

  private async processPendingDeliveries(): Promise<void> {
    for (const [webhookId, deliveries] of this.deliveryQueue.entries()) {
      const webhook = this.endpoints.get(webhookId);
      if (!webhook || webhook.status !== 'active') continue;

      const pendingDeliveries = deliveries.filter(d => 
        d.status === 'pending' || 
        (d.status === 'retrying' && d.nextRetryAt && d.nextRetryAt <= new Date())
      );

      for (const delivery of pendingDeliveries) {
        await this.processDelivery(delivery, webhook);
      }
    }
  }

  // Management methods
  
  getWebhook(webhookId: string): WebhookEndpoint | undefined {
    return this.endpoints.get(webhookId);
  }

  getAllWebhooks(): WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  getWebhooksByIntegration(integrationId: string): WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter(
      webhook => webhook.integrationId === integrationId
    );
  }

  getPendingDeliveries(webhookId: string): WebhookDelivery[] {
    return this.deliveryQueue.get(webhookId) || [];
  }

  getWebhookStats(webhookId: string): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    averageDeliveryTime: number;
    successRate: number;
  } {
    const webhook = this.endpoints.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    // This would typically query a database for historical delivery data
    // For now, we'll return current queue stats
    const pendingDeliveries = this.getPendingDeliveries(webhookId);
    
    return {
      totalDeliveries: 0, // Would come from database
      successfulDeliveries: 0, // Would come from database
      failedDeliveries: webhook.failureCount,
      pendingDeliveries: pendingDeliveries.length,
      averageDeliveryTime: 0, // Would be calculated from delivery history
      successRate: webhook.failureCount === 0 ? 100 : 0 // Simplified calculation
    };
  }

  async updateWebhook(
    webhookId: string, 
    updates: Partial<Pick<WebhookEndpoint, 'url' | 'events' | 'status' | 'secret'>>
  ): Promise<void> {
    const webhook = this.endpoints.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    Object.assign(webhook, updates);
    
    logger.info(`Updated webhook ${webhookId}`);
    
    this.emit('webhook:updated', { webhook, updates });
  }

  async testWebhook(webhookId: string): Promise<boolean> {
    const webhook = this.endpoints.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    const testEvent: WebhookEvent = {
      id: `test_${Date.now()}`,
      type: 'webhook.test',
      data: {
        message: 'This is a test webhook delivery',
        webhook_id: webhookId,
        timestamp: new Date().toISOString()
      },
      integrationId: webhook.integrationId,
      timestamp: new Date(),
      livemode: false,
      retry: false
    };

    try {
      await this.queueDelivery(webhook, testEvent);
      return true;
    } catch (error) {
      logger.error(`Webhook test failed for ${webhookId}:`, error);
      return false;
    }
  }

  // Cleanup method
  cleanup(): void {
    // Clear all retry timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    
    // Clear all data
    this.endpoints.clear();
    this.deliveryQueue.clear();
    this.rateLimiters.clear();
    
    this.removeAllListeners();
  }
}

class RateLimiter {
  private requests: Array<{ timestamp: number }> = [];
  private config: WebhookRateLimit;

  constructor(config: WebhookRateLimit) {
    this.config = config;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);

    // Clean old requests
    this.requests = this.requests.filter(req => req.timestamp > oneHourAgo);

    // Check limits
    const minuteRequests = this.requests.filter(req => req.timestamp > oneMinuteAgo).length;
    const hourRequests = this.requests.length;

    return minuteRequests < this.config.maxRequestsPerMinute && 
           hourRequests < this.config.maxRequestsPerHour;
  }

  recordRequest(): void {
    this.requests.push({ timestamp: Date.now() });
  }

  getResetTime(): Date {
    // Return next minute boundary
    const now = new Date();
    const nextMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                                now.getHours(), now.getMinutes() + 1, 0, 0);
    return nextMinute;
  }

  getRemainingRequests(): { perMinute: number; perHour: number } {
    const now = Date.now();
    const oneMinuteAgo = now - (60 * 1000);
    
    const minuteRequests = this.requests.filter(req => req.timestamp > oneMinuteAgo).length;
    const hourRequests = this.requests.length;

    return {
      perMinute: Math.max(0, this.config.maxRequestsPerMinute - minuteRequests),
      perHour: Math.max(0, this.config.maxRequestsPerHour - hourRequests)
    };
  }
}

export const webhookManager = new WebhookManager();
