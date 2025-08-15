import express from 'express';
import Joi from 'joi';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { SquareIntegration } from '@/integrations/pos';
import { PrismaTaxCalculator } from '@/services/tax-calculation/PrismaTaxCalculator';
import { Decimal } from '@prisma/client/runtime/library';

const router = express.Router();
const taxCalculator = new PrismaTaxCalculator();

// Validation schemas
const setupIntegrationSchema = Joi.object({
  businessId: Joi.string().required(),
  provider: Joi.string().valid('square', 'shopify', 'clover').required(),
  credentials: Joi.object().required(),
  settings: Joi.object().optional()
});

const syncRequestSchema = Joi.object({
  businessId: Joi.string().required(),
  integrationId: Joi.string().required(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  locationId: Joi.string().optional()
});

// Get all integrations for a business
router.get('/:businessId', async (req: any, res) => {
  try {
    const { businessId } = req.params;
    const clerkUserId = req.auth.userId;
    
    // Verify business access
    const user = await prisma.user.findUnique({
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

    const integrations = await prisma.posIntegration.findMany({
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
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Setup new POS integration
router.post('/setup', async (req: any, res) => {
  try {
    const { error, value } = setupIntegrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    // Verify business access
    const user = await prisma.user.findUnique({
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

    // Encrypt credentials (in production, use proper encryption)
    const encryptedCredentials = Buffer.from(JSON.stringify(value.credentials)).toString('base64');

    // Test connection before saving
    let testResult = false;
    if (value.provider === 'square') {
      const squareIntegration = new SquareIntegration();
      testResult = await squareIntegration.testConnection();
    }

    if (!testResult) {
      return res.status(400).json({ error: 'Failed to connect to POS system. Please check your credentials.' });
    }

    // Create or update integration
    const integration = await prisma.posIntegration.upsert({
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
  } catch (error) {
    console.error('Error setting up integration:', error);
    res.status(500).json({ error: 'Failed to setup integration' });
  }
});

// Sync transactions from POS
router.post('/sync', async (req: any, res) => {
  try {
    const { error, value } = syncRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    // Verify business access
    const user = await prisma.user.findUnique({
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

    // Get integration
    const integration = await prisma.posIntegration.findUnique({
      where: { id: value.integrationId },
      include: { business: true }
    });

    if (!integration || integration.businessId !== value.businessId) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Update sync status
    await prisma.posIntegration.update({
      where: { id: integration.id },
      data: {
        syncStatus: 'SYNCING',
        errorMessage: null
      }
    });

    // Start sync process (async)
    processPOSSync(integration.id, value.startDate, value.endDate, value.locationId);

    res.json({ 
      message: 'Sync initiated', 
      integrationId: integration.id,
      status: 'SYNCING'
    });
  } catch (error) {
    console.error('Error initiating sync:', error);
    res.status(500).json({ error: 'Failed to initiate sync' });
  }
});

// Test POS connection
router.post('/test-connection', async (req: any, res) => {
  try {
    const { provider, credentials } = req.body;
    
    if (!provider || !credentials) {
      return res.status(400).json({ error: 'Provider and credentials are required' });
    }

    let testResult = false;
    let errorMessage = '';

    try {
      if (provider === 'square') {
        const squareIntegration = new SquareIntegration();
        testResult = await squareIntegration.testConnection();
      } else {
        return res.status(400).json({ error: 'Unsupported POS provider' });
      }
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Connection test failed';
    }

    if (testResult) {
      res.json({ status: 'connected', provider });
    } else {
      res.status(401).json({ 
        status: 'failed', 
        provider, 
        error: errorMessage || 'Invalid credentials or connection failed' 
      });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Square webhook handler
router.post('/webhook/square', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('x-square-signature');
    const body = req.body;
    
    // Verify webhook signature in production
    // const isValid = verifySquareWebhook(body, signature, process.env.SQUARE_WEBHOOK_SECRET);
    // if (!isValid) {
    //   return res.status(401).json({ error: 'Invalid webhook signature' });
    // }

    // Store webhook event for processing
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        provider: 'square',
        eventType: req.body.type || 'unknown',
        eventId: req.body.event_id,
        payload: req.body
      }
    });

    // Process webhook asynchronously
    processSquareWebhook(webhookEvent.id);

    res.json({ status: 'received', eventId: webhookEvent.id });
  } catch (error) {
    console.error('Error processing Square webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get integration sync status
router.get('/sync-status/:integrationId', async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const clerkUserId = req.auth.userId;
    
    // Get integration and verify access
    const integration = await prisma.posIntegration.findUnique({
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

    const user = await prisma.user.findUnique({
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
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
});

// Async function to process POS sync
async function processPOSSync(integrationId: string, startDate?: Date, endDate?: Date, locationId?: string) {
  try {
    const integration = await prisma.posIntegration.findUnique({
      where: { id: integrationId },
      include: { business: true }
    });

    if (!integration) return;

    if (integration.provider === 'square') {
      const squareIntegration = new SquareIntegration();
      const transactions = await squareIntegration.syncPayments(
        locationId || 'main',
        startDate,
        endDate
      );

      // Process each transaction
      if (Array.isArray(transactions)) {
        for (const transaction of transactions) {
          await processTransactionFromPOS(transaction, integration.businessId, 'square');
        }
      }
    }

    // Update integration status
    await prisma.posIntegration.update({
      where: { id: integrationId },
      data: {
        syncStatus: 'COMPLETED',
        lastSyncAt: new Date(),
        errorMessage: null
      }
    });
  } catch (error) {
    console.error('POS sync error:', error);
    await prisma.posIntegration.update({
      where: { id: integrationId },
      data: {
        syncStatus: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Sync failed'
      }
    });
  }
}

// Process webhook events
async function processSquareWebhook(eventId: string) {
  try {
    const event = await prisma.webhookEvent.findUnique({
      where: { id: eventId }
    });

    if (!event || event.processed) return;

    const payload = event.payload as any;
    
    if (payload.type === 'payment.updated' && payload.data?.object?.payment) {
      const payment = payload.data.object.payment;
      
      // Find the integration based on the payment
      const integrations = await prisma.posIntegration.findMany({
        where: { provider: 'square', isActive: true }
      });

      for (const integration of integrations) {
        await processTransactionFromPOS(payment, integration.businessId, 'square');
      }
    }

    // Mark event as processed
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { processed: true }
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        processed: false,
        processingError: error instanceof Error ? error.message : 'Processing failed',
        attempts: { increment: 1 }
      }
    });
  }
}

// Helper function to process transaction from POS
async function processTransactionFromPOS(posTransaction: any, businessId: string, source: string) {
  try {
    // Check if transaction already exists
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        externalId: posTransaction.id,
        businessId
      }
    });

    if (existingTransaction) {
      console.log(`Transaction ${posTransaction.id} already exists, skipping`);
      return;
    }

    // Extract transaction data (this would be customized per POS provider)
    const amount = parseFloat(posTransaction.amount_money?.amount || 0) / 100;
    const location = posTransaction.location_id || 'Unknown';
    
    if (amount <= 0) return;

    // Calculate tax
    const taxBreakdown = await taxCalculator.calculateTax({
      amount,
      businessId,
      saleLocation: location,
      productCategory: 'GENERAL',
      customerType: 'RETAIL',
      transactionDate: new Date(posTransaction.created_at || Date.now())
    });

    // Create transaction
    await prisma.transaction.create({
      data: {
        businessId,
        externalId: posTransaction.id,
        amount: new Decimal(amount),
        taxAmount: new Decimal(taxBreakdown.totalTax),
        totalAmount: new Decimal(amount + taxBreakdown.totalTax),
        federalTax: new Decimal(taxBreakdown.federalTax),
        stateTax: new Decimal(taxBreakdown.stateTax),
        countyTax: new Decimal(taxBreakdown.countyTax),
        cityTax: new Decimal(taxBreakdown.cityTax),
        specialDistrictTax: new Decimal(taxBreakdown.specialDistrictTax),
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
  } catch (error) {
    console.error(`Error processing ${source} transaction:`, error);
  }
}

export default router;