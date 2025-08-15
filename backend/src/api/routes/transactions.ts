import express from 'express';
import Joi from 'joi';
import prisma from '@/lib/prisma';
import { PrismaTaxCalculator } from '@/services/tax-calculation/PrismaTaxCalculator';
import { Decimal } from '@prisma/client/runtime/library';

const router = express.Router();
const taxCalculator = new PrismaTaxCalculator();

// Validation schemas
const createTransactionSchema = Joi.object({
  businessId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().optional(),
  productCategory: Joi.string().optional(),
  customerType: Joi.string().valid('RETAIL', 'WHOLESALE', 'EXEMPT').default('RETAIL'),
  isExempt: Joi.boolean().default(false),
  exemptionReason: Joi.string().when('isExempt', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  saleLocation: Joi.string().required(),
  customerLocation: Joi.string().optional(),
  paymentMethod: Joi.string().optional(),
  posSource: Joi.string().optional(),
  externalId: Joi.string().optional(),
  transactionDate: Joi.date().default(() => new Date())
});

const queryTransactionsSchema = Joi.object({
  businessId: Joi.string().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  status: Joi.string().valid('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED').optional(),
  customerType: Joi.string().valid('RETAIL', 'WHOLESALE', 'EXEMPT').optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});

// Get transactions with filtering and pagination
router.get('/', async (req: any, res) => {
  try {
    const { error, value } = queryTransactionsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    // Get user businesses
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        id: true,
        businesses: {
          where: { isActive: true },
          select: { id: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const businessIds = user.businesses.map(b => b.id);
    
    // Build where clause
    const where: any = {
      businessId: { in: businessIds }
    };

    if (value.businessId) {
      if (!businessIds.includes(value.businessId)) {
        return res.status(403).json({ error: 'Access denied to this business' });
      }
      where.businessId = value.businessId;
    }

    if (value.startDate || value.endDate) {
      where.transactionDate = {};
      if (value.startDate) where.transactionDate.gte = value.startDate;
      if (value.endDate) where.transactionDate.lte = value.endDate;
    }

    if (value.status) {
      where.status = value.status;
    }

    if (value.customerType) {
      where.customerType = value.customerType;
    }

    // Get transactions with count
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          business: {
            select: { name: true, state: true }
          }
        },
        orderBy: { transactionDate: 'desc' },
        take: value.limit,
        skip: value.offset
      }),
      prisma.transaction.count({ where })
    ]);

    res.json({
      data: transactions,
      pagination: {
        total,
        limit: value.limit,
        offset: value.offset,
        hasMore: value.offset + value.limit < total
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get single transaction
router.get('/:id', async (req: any, res) => {
  try {
    const clerkUserId = req.auth.userId;
    
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: {
        businesses: {
          where: { isActive: true },
          select: { id: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const businessIds = user.businesses.map(b => b.id);

    const transaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: {
        business: {
          select: { name: true, state: true }
        },
        refunds: true,
        originalTransaction: true
      }
    });

    if (!transaction || !businessIds.includes(transaction.businessId)) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Create a new transaction
router.post('/', async (req: any, res) => {
  try {
    const { error, value } = createTransactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const clerkUserId = req.auth.userId;
    
    // Get user and verify business ownership
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

    // Calculate tax
    const taxBreakdown = await taxCalculator.calculateTax({
      amount: value.amount,
      businessId: value.businessId,
      saleLocation: value.saleLocation,
      customerLocation: value.customerLocation,
      productCategory: value.productCategory,
      customerType: value.customerType,
      exemptionReason: value.exemptionReason,
      transactionDate: value.transactionDate
    });

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        businessId: value.businessId,
        userId: user.id,
        amount: new Decimal(value.amount),
        taxAmount: new Decimal(taxBreakdown.totalTax),
        totalAmount: new Decimal(value.amount + taxBreakdown.totalTax),
        federalTax: new Decimal(taxBreakdown.federalTax),
        stateTax: new Decimal(taxBreakdown.stateTax),
        countyTax: new Decimal(taxBreakdown.countyTax),
        cityTax: new Decimal(taxBreakdown.cityTax),
        specialDistrictTax: new Decimal(taxBreakdown.specialDistrictTax),
        description: value.description,
        productCategory: value.productCategory,
        customerType: value.customerType,
        isExempt: value.isExempt,
        exemptionReason: value.exemptionReason,
        saleLocation: value.saleLocation,
        customerLocation: value.customerLocation,
        paymentMethod: value.paymentMethod,
        posSource: value.posSource,
        externalId: value.externalId,
        transactionDate: value.transactionDate,
        status: 'COMPLETED'
      },
      include: {
        business: {
          select: { name: true, state: true }
        }
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entityType: 'TRANSACTION',
        entityId: transaction.id,
        newValues: transaction,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(201).json({
      ...transaction,
      taxBreakdown
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Process a refund
router.post('/:id/refund', async (req: any, res) => {
  try {
    const { amount, reason } = req.body;
    const clerkUserId = req.auth.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Refund amount must be positive' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get original transaction
    const originalTransaction = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: {
        business: {
          select: { ownerId: true, name: true }
        }
      }
    });

    if (!originalTransaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Verify ownership
    if (originalTransaction.business.ownerId !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if refund amount is valid
    const originalAmount = parseFloat(originalTransaction.amount.toString());
    if (amount > originalAmount) {
      return res.status(400).json({ error: 'Refund amount cannot exceed original amount' });
    }

    // Calculate tax on refund amount
    const refundTaxBreakdown = await taxCalculator.calculateTax({
      amount: amount,
      businessId: originalTransaction.businessId,
      saleLocation: originalTransaction.saleLocation,
      customerLocation: originalTransaction.customerLocation || undefined,
      productCategory: originalTransaction.productCategory || undefined,
      customerType: originalTransaction.customerType as any,
      exemptionReason: originalTransaction.exemptionReason || undefined,
      transactionDate: originalTransaction.transactionDate
    });

    // Create refund transaction
    const refundTransaction = await prisma.transaction.create({
      data: {
        businessId: originalTransaction.businessId,
        userId: user.id,
        amount: new Decimal(-amount),
        taxAmount: new Decimal(-refundTaxBreakdown.totalTax),
        totalAmount: new Decimal(-(amount + refundTaxBreakdown.totalTax)),
        federalTax: new Decimal(-refundTaxBreakdown.federalTax),
        stateTax: new Decimal(-refundTaxBreakdown.stateTax),
        countyTax: new Decimal(-refundTaxBreakdown.countyTax),
        cityTax: new Decimal(-refundTaxBreakdown.cityTax),
        specialDistrictTax: new Decimal(-refundTaxBreakdown.specialDistrictTax),
        description: `Refund: ${reason || 'No reason provided'}`,
        productCategory: originalTransaction.productCategory,
        customerType: originalTransaction.customerType,
        isExempt: originalTransaction.isExempt,
        exemptionReason: originalTransaction.exemptionReason || undefined,
        saleLocation: originalTransaction.saleLocation,
        customerLocation: originalTransaction.customerLocation || undefined,
        paymentMethod: originalTransaction.paymentMethod,
        posSource: originalTransaction.posSource,
        originalTransactionId: originalTransaction.id,
        transactionDate: new Date(),
        status: 'COMPLETED'
      },
      include: {
        business: {
          select: { name: true, state: true }
        }
      }
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        action: 'REFUND',
        entityType: 'TRANSACTION',
        entityId: refundTransaction.id,
        newValues: refundTransaction,
        metadata: { originalTransactionId: originalTransaction.id, reason },
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    res.status(201).json(refundTransaction);
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

// Calculate tax preview (without creating transaction)
router.post('/calculate-tax', async (req: any, res) => {
  try {
    const { error, value } = createTransactionSchema.validate(req.body);
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

    // Calculate tax
    const taxBreakdown = await taxCalculator.calculateTax({
      amount: value.amount,
      businessId: value.businessId,
      saleLocation: value.saleLocation,
      customerLocation: value.customerLocation,
      productCategory: value.productCategory,
      customerType: value.customerType,
      exemptionReason: value.exemptionReason,
      transactionDate: value.transactionDate
    });

    res.json({
      amount: value.amount,
      taxBreakdown,
      totalAmount: value.amount + taxBreakdown.totalTax
    });
  } catch (error) {
    console.error('Error calculating tax:', error);
    res.status(500).json({ error: 'Failed to calculate tax' });
  }
});

// Get transaction statistics
router.get('/stats/:businessId', async (req: any, res) => {
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

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [monthlyStats, yearlyStats, totalStats] = await Promise.all([
      // Monthly stats
      prisma.transaction.aggregate({
        where: {
          businessId,
          transactionDate: { gte: startOfMonth },
          status: 'COMPLETED'
        },
        _sum: {
          amount: true,
          taxAmount: true,
          totalAmount: true
        },
        _count: true
      }),
      // Yearly stats
      prisma.transaction.aggregate({
        where: {
          businessId,
          transactionDate: { gte: startOfYear },
          status: 'COMPLETED'
        },
        _sum: {
          amount: true,
          taxAmount: true,
          totalAmount: true
        },
        _count: true
      }),
      // All-time stats
      prisma.transaction.aggregate({
        where: {
          businessId,
          status: 'COMPLETED'
        },
        _sum: {
          amount: true,
          taxAmount: true,
          totalAmount: true
        },
        _count: true
      })
    ]);

    res.json({
      monthly: {
        transactions: monthlyStats._count,
        revenue: parseFloat(monthlyStats._sum.amount?.toString() || '0'),
        taxCollected: parseFloat(monthlyStats._sum.taxAmount?.toString() || '0'),
        total: parseFloat(monthlyStats._sum.totalAmount?.toString() || '0')
      },
      yearly: {
        transactions: yearlyStats._count,
        revenue: parseFloat(yearlyStats._sum.amount?.toString() || '0'),
        taxCollected: parseFloat(yearlyStats._sum.taxAmount?.toString() || '0'),
        total: parseFloat(yearlyStats._sum.totalAmount?.toString() || '0')
      },
      allTime: {
        transactions: totalStats._count,
        revenue: parseFloat(totalStats._sum.amount?.toString() || '0'),
        taxCollected: parseFloat(totalStats._sum.taxAmount?.toString() || '0'),
        total: parseFloat(totalStats._sum.totalAmount?.toString() || '0')
      }
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({ error: 'Failed to fetch transaction statistics' });
  }
});

export default router;