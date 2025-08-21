"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const pos_1 = require("@/integrations/pos");
const PrismaTaxCalculator_1 = require("@/services/tax-calculation/PrismaTaxCalculator");
const library_1 = require("@prisma/client/runtime/library");
const router = express_1.default.Router();
const taxCalculator = new PrismaTaxCalculator_1.PrismaTaxCalculator();
const setupIntegrationSchema = joi_1.default.object({
    businessId: joi_1.default.string().required(),
    provider: joi_1.default.string().valid('square', 'shopify', 'clover').required(),
    credentials: joi_1.default.object().required(),
    settings: joi_1.default.object().optional()
});
const syncRequestSchema = joi_1.default.object({
    businessId: joi_1.default.string().required(),
    integrationId: joi_1.default.string().required(),
    startDate: joi_1.default.date().optional(),
    endDate: joi_1.default.date().optional(),
    locationId: joi_1.default.string().optional()
});
router.get('/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { id: businessId, isActive: true }
                }
            }
        });
        if (!user || user.businesses.length === 0) {
            return res.status(403).json({ error: 'Access denied to this business' });
        }
        const integrations = await prisma_1.default.posIntegration.findMany({
            where: { businessId },
            select: {
                id: true,
                provider: true,
                isActive: true,
                lastSyncAt: true,
                syncStatus: true,
                errorMessage: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json(integrations);
    }
    catch (error) {
        console.error('Error fetching integrations:', error);
        res.status(500).json({ error: 'Failed to fetch integrations' });
    }
});
router.post('/setup', async (req, res) => {
    try {
        const { error, value } = setupIntegrationSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { id: value.businessId, isActive: true }
                }
            }
        });
        if (!user || user.businesses.length === 0) {
            return res.status(403).json({ error: 'Access denied to this business' });
        }
        const encryptedCredentials = Buffer.from(JSON.stringify(value.credentials)).toString('base64');
        let testResult = false;
        if (value.provider === 'square') {
            const squareIntegration = new pos_1.SquareIntegration();
            testResult = await squareIntegration.testConnection();
        }
        if (!testResult) {
            return res.status(400).json({ error: 'Failed to connect to POS system. Please check your credentials.' });
        }
        const integration = await prisma_1.default.posIntegration.upsert({
            where: {
                businessId_provider: {
                    businessId: value.businessId,
                    provider: value.provider
                }
            },
            update: {
                credentials: encryptedCredentials,
                settings: value.settings,
                isActive: true,
                syncStatus: 'PENDING',
                errorMessage: null
            },
            create: {
                businessId: value.businessId,
                provider: value.provider,
                credentials: encryptedCredentials,
                settings: value.settings,
                webhookUrl: `/api/integrations/webhook/${value.provider}`,
                syncStatus: 'PENDING'
            }
        });
        res.status(201).json({
            id: integration.id,
            provider: integration.provider,
            isActive: integration.isActive,
            syncStatus: integration.syncStatus,
            webhookUrl: integration.webhookUrl,
            createdAt: integration.createdAt
        });
    }
    catch (error) {
        console.error('Error setting up integration:', error);
        res.status(500).json({ error: 'Failed to setup integration' });
    }
});
router.post('/sync', async (req, res) => {
    try {
        const { error, value } = syncRequestSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            include: {
                businesses: {
                    where: { id: value.businessId, isActive: true }
                }
            }
        });
        if (!user || user.businesses.length === 0) {
            return res.status(403).json({ error: 'Access denied to this business' });
        }
        const integration = await prisma_1.default.posIntegration.findUnique({
            where: { id: value.integrationId },
            include: { business: true }
        });
        if (!integration || integration.businessId !== value.businessId) {
            return res.status(404).json({ error: 'Integration not found' });
        }
        await prisma_1.default.posIntegration.update({
            where: { id: integration.id },
            data: {
                syncStatus: 'SYNCING',
                errorMessage: null
            }
        });
        processPOSSync(integration.id, value.startDate, value.endDate, value.locationId);
        res.json({
            message: 'Sync initiated',
            integrationId: integration.id,
            status: 'SYNCING'
        });
    }
    catch (error) {
        console.error('Error initiating sync:', error);
        res.status(500).json({ error: 'Failed to initiate sync' });
    }
});
router.post('/test-connection', async (req, res) => {
    try {
        const { provider, credentials } = req.body;
        if (!provider || !credentials) {
            return res.status(400).json({ error: 'Provider and credentials are required' });
        }
        let testResult = false;
        let errorMessage = '';
        try {
            if (provider === 'square') {
                const squareIntegration = new pos_1.SquareIntegration();
                testResult = await squareIntegration.testConnection();
            }
            else {
                return res.status(400).json({ error: 'Unsupported POS provider' });
            }
        }
        catch (error) {
            errorMessage = error instanceof Error ? error.message : 'Connection test failed';
        }
        if (testResult) {
            res.json({ status: 'connected', provider });
        }
        else {
            res.status(401).json({
                status: 'failed',
                provider,
                error: errorMessage || 'Invalid credentials or connection failed'
            });
        }
    }
    catch (error) {
        console.error('Error testing connection:', error);
        res.status(500).json({ error: 'Failed to test connection' });
    }
});
router.post('/webhook/square', express_1.default.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const signature = req.get('x-square-signature');
        const body = req.body;
        const webhookEvent = await prisma_1.default.webhookEvent.create({
            data: {
                provider: 'square',
                eventType: req.body.type || 'unknown',
                eventId: req.body.event_id,
                payload: req.body
            }
        });
        processSquareWebhook(webhookEvent.id);
        res.json({ status: 'received', eventId: webhookEvent.id });
    }
    catch (error) {
        console.error('Error processing Square webhook:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
router.get('/sync-status/:integrationId', async (req, res) => {
    try {
        const { integrationId } = req.params;
        const clerkUserId = req.auth.userId;
        const integration = await prisma_1.default.posIntegration.findUnique({
            where: { id: integrationId },
            include: {
                business: {
                    select: { ownerId: true, name: true }
                }
            }
        });
        if (!integration) {
            return res.status(404).json({ error: 'Integration not found' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user || integration.business.ownerId !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.json({
            id: integration.id,
            provider: integration.provider,
            syncStatus: integration.syncStatus,
            lastSyncAt: integration.lastSyncAt,
            errorMessage: integration.errorMessage,
            isActive: integration.isActive
        });
    }
    catch (error) {
        console.error('Error fetching sync status:', error);
        res.status(500).json({ error: 'Failed to fetch sync status' });
    }
});
async function processPOSSync(integrationId, startDate, endDate, locationId) {
    try {
        const integration = await prisma_1.default.posIntegration.findUnique({
            where: { id: integrationId },
            include: { business: true }
        });
        if (!integration)
            return;
        if (integration.provider === 'square') {
            const squareIntegration = new pos_1.SquareIntegration();
            const transactions = await squareIntegration.syncPayments(locationId || 'main', startDate, endDate);
            if (Array.isArray(transactions)) {
                for (const transaction of transactions) {
                    await processTransactionFromPOS(transaction, integration.businessId, 'square');
                }
            }
        }
        await prisma_1.default.posIntegration.update({
            where: { id: integrationId },
            data: {
                syncStatus: 'COMPLETED',
                lastSyncAt: new Date(),
                errorMessage: null
            }
        });
    }
    catch (error) {
        console.error('POS sync error:', error);
        await prisma_1.default.posIntegration.update({
            where: { id: integrationId },
            data: {
                syncStatus: 'ERROR',
                errorMessage: error instanceof Error ? error.message : 'Sync failed'
            }
        });
    }
}
async function processSquareWebhook(eventId) {
    try {
        const event = await prisma_1.default.webhookEvent.findUnique({
            where: { id: eventId }
        });
        if (!event || event.processed)
            return;
        const payload = event.payload;
        if (payload.type === 'payment.updated' && payload.data?.object?.payment) {
            const payment = payload.data.object.payment;
            const integrations = await prisma_1.default.posIntegration.findMany({
                where: { provider: 'square', isActive: true }
            });
            for (const integration of integrations) {
                await processTransactionFromPOS(payment, integration.businessId, 'square');
            }
        }
        await prisma_1.default.webhookEvent.update({
            where: { id: eventId },
            data: { processed: true }
        });
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        await prisma_1.default.webhookEvent.update({
            where: { id: eventId },
            data: {
                processed: false,
                processingError: error instanceof Error ? error.message : 'Processing failed',
                attempts: { increment: 1 }
            }
        });
    }
}
async function processTransactionFromPOS(posTransaction, businessId, source) {
    try {
        const existingTransaction = await prisma_1.default.transaction.findFirst({
            where: {
                externalId: posTransaction.id,
                businessId
            }
        });
        if (existingTransaction) {
            console.log(`Transaction ${posTransaction.id} already exists, skipping`);
            return;
        }
        const amount = parseFloat(posTransaction.amount_money?.amount || 0) / 100;
        const location = posTransaction.location_id || 'Unknown';
        if (amount <= 0)
            return;
        const taxBreakdown = await taxCalculator.calculateTax({
            amount,
            businessId,
            saleLocation: location,
            productCategory: 'GENERAL',
            customerType: 'RETAIL',
            transactionDate: new Date(posTransaction.created_at || Date.now())
        });
        await prisma_1.default.transaction.create({
            data: {
                businessId,
                externalId: posTransaction.id,
                amount: new library_1.Decimal(amount),
                taxAmount: new library_1.Decimal(taxBreakdown.totalTax),
                totalAmount: new library_1.Decimal(amount + taxBreakdown.totalTax),
                federalTax: new library_1.Decimal(taxBreakdown.federalTax),
                stateTax: new library_1.Decimal(taxBreakdown.stateTax),
                countyTax: new library_1.Decimal(taxBreakdown.countyTax),
                cityTax: new library_1.Decimal(taxBreakdown.cityTax),
                specialDistrictTax: new library_1.Decimal(taxBreakdown.specialDistrictTax),
                description: `${source.toUpperCase()} Transaction`,
                productCategory: 'GENERAL',
                customerType: 'RETAIL',
                saleLocation: location,
                paymentMethod: posTransaction.card_details?.card?.card_brand || 'Unknown',
                posSource: source,
                transactionDate: new Date(posTransaction.created_at || Date.now()),
                status: 'COMPLETED'
            }
        });
        console.log(`Processed ${source} transaction: ${posTransaction.id}`);
    }
    catch (error) {
        console.error(`Error processing ${source} transaction:`, error);
    }
}
exports.default = router;
//# sourceMappingURL=integrations.js.map