"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const joi_1 = __importDefault(require("joi"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const PrismaTaxCalculator_1 = require("@/services/tax-calculation/PrismaTaxCalculator");
const library_1 = require("@prisma/client/runtime/library");
const router = express_1.default.Router();
const taxCalculator = new PrismaTaxCalculator_1.PrismaTaxCalculator();
const createTransactionSchema = joi_1.default.object({
    businessId: joi_1.default.string().required(),
    amount: joi_1.default.number().positive().required(),
    description: joi_1.default.string().optional(),
    productCategory: joi_1.default.string().optional(),
    customerType: joi_1.default.string().valid('RETAIL', 'WHOLESALE', 'EXEMPT').default('RETAIL'),
    isExempt: joi_1.default.boolean().default(false),
    exemptionReason: joi_1.default.string().when('isExempt', {
        is: true,
        then: joi_1.default.required(),
        otherwise: joi_1.default.optional()
    }),
    saleLocation: joi_1.default.string().required(),
    customerLocation: joi_1.default.string().optional(),
    paymentMethod: joi_1.default.string().optional(),
    posSource: joi_1.default.string().optional(),
    externalId: joi_1.default.string().optional(),
    transactionDate: joi_1.default.date().default(() => new Date())
});
const queryTransactionsSchema = joi_1.default.object({
    businessId: joi_1.default.string().optional(),
    startDate: joi_1.default.date().optional(),
    endDate: joi_1.default.date().optional(),
    status: joi_1.default.string().valid('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED').optional(),
    customerType: joi_1.default.string().valid('RETAIL', 'WHOLESALE', 'EXEMPT').optional(),
    limit: joi_1.default.number().integer().min(1).max(100).default(50),
    offset: joi_1.default.number().integer().min(0).default(0)
});
router.get('/', async (req, res) => {
    try {
        const { error, value } = queryTransactionsSchema.validate(req.query);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
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
        const where = {
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
            if (value.startDate)
                where.transactionDate.gte = value.startDate;
            if (value.endDate)
                where.transactionDate.lte = value.endDate;
        }
        if (value.status) {
            where.status = value.status;
        }
        if (value.customerType) {
            where.customerType = value.customerType;
        }
        const [transactions, total] = await Promise.all([
            prisma_1.default.transaction.findMany({
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
            prisma_1.default.transaction.count({ where })
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
    }
    catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const clerkUserId = req.auth.userId;
        const user = await prisma_1.default.user.findUnique({
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
        const transaction = await prisma_1.default.transaction.findUnique({
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
    }
    catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { error, value } = createTransactionSchema.validate(req.body);
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
        const transaction = await prisma_1.default.transaction.create({
            data: {
                businessId: value.businessId,
                userId: user.id,
                amount: new library_1.Decimal(value.amount),
                taxAmount: new library_1.Decimal(taxBreakdown.totalTax),
                totalAmount: new library_1.Decimal(value.amount + taxBreakdown.totalTax),
                federalTax: new library_1.Decimal(taxBreakdown.federalTax),
                stateTax: new library_1.Decimal(taxBreakdown.stateTax),
                countyTax: new library_1.Decimal(taxBreakdown.countyTax),
                cityTax: new library_1.Decimal(taxBreakdown.cityTax),
                specialDistrictTax: new library_1.Decimal(taxBreakdown.specialDistrictTax),
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
        await prisma_1.default.auditLog.create({
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
    }
    catch (error) {
        console.error('Error creating transaction:', error);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});
router.post('/:id/refund', async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const clerkUserId = req.auth.userId;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Refund amount must be positive' });
        }
        const user = await prisma_1.default.user.findUnique({
            where: { clerkUserId },
            select: { id: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const originalTransaction = await prisma_1.default.transaction.findUnique({
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
        if (originalTransaction.business.ownerId !== user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        const originalAmount = parseFloat(originalTransaction.amount.toString());
        if (amount > originalAmount) {
            return res.status(400).json({ error: 'Refund amount cannot exceed original amount' });
        }
        const refundTaxBreakdown = await taxCalculator.calculateTax({
            amount: amount,
            businessId: originalTransaction.businessId,
            saleLocation: originalTransaction.saleLocation,
            customerLocation: originalTransaction.customerLocation || undefined,
            productCategory: originalTransaction.productCategory || undefined,
            customerType: originalTransaction.customerType,
            exemptionReason: originalTransaction.exemptionReason || undefined,
            transactionDate: originalTransaction.transactionDate
        });
        const refundTransaction = await prisma_1.default.transaction.create({
            data: {
                businessId: originalTransaction.businessId,
                userId: user.id,
                amount: new library_1.Decimal(-amount),
                taxAmount: new library_1.Decimal(-refundTaxBreakdown.totalTax),
                totalAmount: new library_1.Decimal(-(amount + refundTaxBreakdown.totalTax)),
                federalTax: new library_1.Decimal(-refundTaxBreakdown.federalTax),
                stateTax: new library_1.Decimal(-refundTaxBreakdown.stateTax),
                countyTax: new library_1.Decimal(-refundTaxBreakdown.countyTax),
                cityTax: new library_1.Decimal(-refundTaxBreakdown.cityTax),
                specialDistrictTax: new library_1.Decimal(-refundTaxBreakdown.specialDistrictTax),
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
        await prisma_1.default.auditLog.create({
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
    }
    catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ error: 'Failed to process refund' });
    }
});
router.post('/calculate-tax', async (req, res) => {
    try {
        const { error, value } = createTransactionSchema.validate(req.body);
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
    }
    catch (error) {
        console.error('Error calculating tax:', error);
        res.status(500).json({ error: 'Failed to calculate tax' });
    }
});
router.get('/stats/:businessId', async (req, res) => {
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
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const [monthlyStats, yearlyStats, totalStats] = await Promise.all([
            prisma_1.default.transaction.aggregate({
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
            prisma_1.default.transaction.aggregate({
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
            prisma_1.default.transaction.aggregate({
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
    }
    catch (error) {
        console.error('Error fetching transaction stats:', error);
        res.status(500).json({ error: 'Failed to fetch transaction statistics' });
    }
});
exports.default = router;
//# sourceMappingURL=transactions.js.map