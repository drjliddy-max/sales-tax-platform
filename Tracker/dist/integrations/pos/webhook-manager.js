"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const redis_1 = require("@/lib/redis");
const prisma_1 = require("@/lib/prisma");
const types_1 = require("./types");
const ShopifyAdapter_1 = require("./adapters/ShopifyAdapter");
const SquareAdapter_1 = require("./adapters/SquareAdapter");
const transformer_1 = require("./transformer");
class WebhookManager extends events_1.EventEmitter {
    constructor() {
        super();
        this.adapters = new Map();
        this.transformers = new Map();
        this.eventHandlers = new Map();
        this.processingQueue = [];
        this.isProcessing = false;
        this.initializeAdapters();
        this.startProcessingQueue();
    }
    static getInstance() {
        if (!WebhookManager.instance) {
            WebhookManager.instance = new WebhookManager();
        }
        return WebhookManager.instance;
    }
    initializeAdapters() {
        this.adapters.set('shopify', new ShopifyAdapter_1.ShopifyAdapter());
        this.adapters.set('square', new SquareAdapter_1.SquareAdapter());
        this.transformers.set('shopify', new transformer_1.TaxDataTransformer('shopify', {
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
        this.transformers.set('square', new transformer_1.TaxDataTransformer('square', {
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
    async setupWebhooks(businessId, posType, webhookUrl, credentials) {
        try {
            const adapter = this.adapters.get(posType);
            if (!adapter) {
                throw new types_1.POSIntegrationError(`No adapter found for POS type: ${posType}`, 'ADAPTER_NOT_FOUND', posType);
            }
            const webhookConfig = await adapter.setupWebhooks(credentials, webhookUrl);
            const secretKey = crypto_1.default.randomBytes(32).toString('hex');
            const subscription = await prisma_1.prisma.webhookSubscription.upsert({
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
                    id: crypto_1.default.randomUUID(),
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
            const cacheKey = `webhook_sub:${businessId}:${posType}`;
            await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(subscription));
            console.log(`Webhooks setup successfully for ${businessId}:${posType}`);
            return {
                id: subscription.id,
                businessId: subscription.businessId,
                posType: subscription.posType,
                webhookUrl: subscription.webhookUrl,
                events: JSON.parse(subscription.events),
                secretKey: subscription.secretKey,
                isActive: subscription.isActive,
                lastProcessed: subscription.lastProcessed || undefined,
                failureCount: subscription.failureCount,
                createdAt: subscription.createdAt,
                updatedAt: subscription.updatedAt
            };
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to setup webhooks: ${error.message}`, 'WEBHOOK_SETUP_FAILED', posType, undefined, true, { businessId, error: error.message });
        }
    }
    async processWebhook(posType, event, payload, signature, businessId) {
        try {
            const webhook = {
                posType,
                event,
                payload,
                signature,
                timestamp: new Date(),
                businessId
            };
            this.processingQueue.push(webhook);
            if (!this.isProcessing) {
                this.startProcessingQueue();
            }
            return { success: true, retryable: false };
        }
        catch (error) {
            console.error('Failed to queue webhook for processing:', error);
            return {
                success: false,
                error: error.message,
                retryable: true
            };
        }
    }
    async startProcessingQueue() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        try {
            while (this.processingQueue.length > 0) {
                const webhook = this.processingQueue.shift();
                if (!webhook)
                    continue;
                try {
                    await this.processWebhookInternal(webhook);
                }
                catch (error) {
                    console.error('Failed to process webhook:', error);
                    if (error.retryable && webhook.businessId) {
                        await this.handleWebhookFailure(webhook, error);
                    }
                }
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processWebhookInternal(webhook) {
        const { posType, event, payload, signature, businessId } = webhook;
        const subscription = businessId
            ? await this.getSubscription(businessId, posType)
            : null;
        if (subscription) {
            const isValid = await this.validateWebhookSignature(posType, payload, signature, subscription.secretKey);
            if (!isValid) {
                throw new types_1.POSIntegrationError('Invalid webhook signature', 'WEBHOOK_INVALID_SIGNATURE', posType, undefined, false);
            }
        }
        let transactionData = null;
        if (this.isTransactionEvent(event)) {
            const transformer = this.transformers.get(posType);
            if (transformer) {
                try {
                    transactionData = transformer.transform(payload);
                }
                catch (error) {
                    console.warn(`Failed to transform ${posType} webhook data:`, error);
                }
            }
        }
        const posEvent = {
            type: this.mapEventType(event),
            posType,
            locationId: this.extractLocationId(payload, posType),
            timestamp: new Date(),
            data: transactionData || payload
        };
        this.emit('webhook:received', posEvent);
        await this.executeEventHandlers(posEvent);
        if (subscription) {
            await this.updateSubscriptionLastProcessed(subscription.id);
        }
        console.log(`Processed ${posType} webhook: ${event}`);
    }
    async validateWebhookSignature(posType, payload, signature, secretKey) {
        try {
            const adapter = this.adapters.get(posType);
            if (!adapter) {
                console.warn(`No adapter found for signature validation: ${posType}`);
                return false;
            }
            return adapter.validateWebhook(payload, signature, secretKey);
        }
        catch (error) {
            console.error(`Webhook signature validation failed for ${posType}:`, error);
            return false;
        }
    }
    async getSubscription(businessId, posType) {
        try {
            const cacheKey = `webhook_sub:${businessId}:${posType}`;
            const cached = await redis_1.redis.get(cacheKey);
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
            const stored = await prisma_1.prisma.webhookSubscription.findUnique({
                where: {
                    businessId_posType: {
                        businessId,
                        posType
                    }
                }
            });
            if (!stored)
                return null;
            const subscription = {
                id: stored.id,
                businessId: stored.businessId,
                posType: stored.posType,
                webhookUrl: stored.webhookUrl,
                events: JSON.parse(stored.events),
                secretKey: stored.secretKey,
                isActive: stored.isActive,
                lastProcessed: stored.lastProcessed || undefined,
                failureCount: stored.failureCount,
                createdAt: stored.createdAt,
                updatedAt: stored.updatedAt
            };
            await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stored));
            return subscription;
        }
        catch (error) {
            console.error('Failed to get webhook subscription:', error);
            return null;
        }
    }
    async updateSubscriptionLastProcessed(subscriptionId) {
        try {
            await prisma_1.prisma.webhookSubscription.update({
                where: { id: subscriptionId },
                data: {
                    lastProcessed: new Date(),
                    updatedAt: new Date()
                }
            });
        }
        catch (error) {
            console.error('Failed to update subscription last processed:', error);
        }
    }
    async handleWebhookFailure(webhook, error) {
        if (!webhook.businessId)
            return;
        try {
            await prisma_1.prisma.webhookSubscription.updateMany({
                where: {
                    businessId: webhook.businessId,
                    posType: webhook.posType
                },
                data: {
                    failureCount: { increment: 1 },
                    updatedAt: new Date()
                }
            });
            const subscription = await this.getSubscription(webhook.businessId, webhook.posType);
            if (!subscription)
                return;
            if (subscription.failureCount >= this.MAX_FAILURES) {
                await this.disableWebhook(webhook.businessId, webhook.posType);
                this.emit('webhook:disabled', {
                    businessId: webhook.businessId,
                    posType: webhook.posType,
                    reason: 'Too many failures',
                    failureCount: subscription.failureCount
                });
                console.error(`Disabled webhook for ${webhook.businessId}:${webhook.posType} due to excessive failures`);
                return;
            }
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
        }
        catch (error) {
            console.error('Failed to handle webhook failure:', error);
        }
    }
    async disableWebhook(businessId, posType) {
        try {
            await prisma_1.prisma.webhookSubscription.updateMany({
                where: {
                    businessId,
                    posType
                },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });
            const cacheKey = `webhook_sub:${businessId}:${posType}`;
            await redis_1.redis.del(cacheKey);
        }
        catch (error) {
            console.error('Failed to disable webhook:', error);
        }
    }
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        this.eventHandlers.get(eventType).push(handler);
        super.on(eventType, handler);
    }
    async executeEventHandlers(event) {
        const handlers = this.eventHandlers.get(event.type) || [];
        await Promise.all(handlers.map(async (handler) => {
            try {
                await handler(event);
            }
            catch (error) {
                console.error(`Event handler failed for ${event.type}:`, error);
            }
        }));
    }
    isTransactionEvent(event) {
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
    mapEventType(event) {
        if (event.includes('create'))
            return 'transaction.created';
        if (event.includes('updated') || event.includes('paid'))
            return 'transaction.updated';
        if (event.includes('refund') || event.includes('cancel'))
            return 'transaction.refunded';
        if (event.includes('sync'))
            return 'sync.completed';
        return 'transaction.updated';
    }
    extractLocationId(payload, posType) {
        switch (posType) {
            case 'shopify':
                return payload.location_id?.toString();
            case 'square':
                return payload.location_id || payload.order?.location_id;
            default:
                return undefined;
        }
    }
    async getWebhookStats() {
        try {
            const total = await prisma_1.prisma.webhookSubscription.count({
                where: { isActive: true }
            });
            const byPOS = await prisma_1.prisma.webhookSubscription.groupBy({
                by: ['posType'],
                where: { isActive: true },
                _count: true
            });
            const subscriptionsByPOS = byPOS.reduce((acc, item) => {
                acc[item.posType] = item._count;
                return acc;
            }, {});
            const recentlyProcessed = await prisma_1.prisma.webhookSubscription.count({
                where: {
                    isActive: true,
                    lastProcessed: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            });
            const failed = await prisma_1.prisma.webhookSubscription.count({
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
        }
        catch (error) {
            console.error('Failed to get webhook stats:', error);
            return {
                activeSubscriptions: 0,
                subscriptionsByPOS: {},
                recentlyProcessed: 0,
                failedSubscriptions: 0
            };
        }
    }
    async removeWebhook(businessId, posType) {
        try {
            await prisma_1.prisma.webhookSubscription.deleteMany({
                where: { businessId, posType }
            });
            const cacheKey = `webhook_sub:${businessId}:${posType}`;
            await redis_1.redis.del(cacheKey);
            console.log(`Removed webhook subscription for ${businessId}:${posType}`);
        }
        catch (error) {
            console.error('Failed to remove webhook:', error);
        }
    }
    addAdapter(posType, adapter) {
        this.adapters.set(posType, adapter);
        console.log(`Added adapter for ${posType}`);
    }
}
exports.WebhookManager = WebhookManager;
WebhookManager.CACHE_TTL = 300;
WebhookManager.RETRY_DELAYS = [1000, 5000, 15000, 60000];
WebhookManager.MAX_FAILURES = 10;
//# sourceMappingURL=webhook-manager.js.map