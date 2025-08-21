"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_1 = require("@/middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.protectClientRoute);
router.get('/dashboard/overview', async (req, res) => {
    try {
        const userId = req.user.id;
        const businesses = await prisma_1.default.business.findMany({
            where: {
                ownerId: userId,
                isActive: true
            },
            include: {
                _count: {
                    select: {
                        transactions: true,
                        reports: true,
                        posIntegrations: true
                    }
                }
            }
        });
        if (businesses.length === 0) {
            return res.json({
                businesses: [],
                metrics: {
                    totalTransactions: 0,
                    totalRevenue: 0,
                    totalTaxCollected: 0,
                    monthlyTrend: []
                },
                recentActivity: [],
                upcomingDeadlines: []
            });
        }
        const businessIds = businesses.map(b => b.id);
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const currentMonthMetrics = await prisma_1.default.transaction.aggregate({
            where: {
                businessId: { in: businessIds },
                transactionDate: { gte: startOfMonth },
                status: 'COMPLETED'
            },
            _count: { id: true },
            _sum: {
                totalAmount: true,
                taxAmount: true
            }
        });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dailyTransactions = await prisma_1.default.transaction.groupBy({
            by: ['transactionDate'],
            where: {
                businessId: { in: businessIds },
                transactionDate: { gte: thirtyDaysAgo },
                status: 'COMPLETED'
            },
            _sum: {
                totalAmount: true,
                taxAmount: true
            },
            _count: { id: true },
            orderBy: { transactionDate: 'asc' }
        });
        const recentTransactions = await prisma_1.default.transaction.findMany({
            where: {
                businessId: { in: businessIds }
            },
            include: {
                business: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        const upcomingDeadlines = [
            {
                type: 'Sales Tax Filing',
                dueDate: new Date(new Date().setDate(new Date().getDate() + 15)),
                jurisdiction: 'State',
                status: 'pending'
            }
        ];
        res.json({
            businesses,
            metrics: {
                totalTransactions: currentMonthMetrics._count.id,
                totalRevenue: currentMonthMetrics._sum.totalAmount || 0,
                totalTaxCollected: currentMonthMetrics._sum.taxAmount || 0,
                monthlyTrend: dailyTransactions
            },
            recentActivity: recentTransactions,
            upcomingDeadlines
        });
    }
    catch (error) {
        console.error('Error fetching client dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});
router.get('/businesses', async (req, res) => {
    try {
        const userId = req.user.id;
        const businesses = await prisma_1.default.business.findMany({
            where: {
                ownerId: userId,
                isActive: true
            },
            include: {
                _count: {
                    select: {
                        transactions: true,
                        reports: true,
                        posIntegrations: true,
                        taxRates: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const businessesWithMetrics = await Promise.all(businesses.map(async (business) => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const metrics = await prisma_1.default.transaction.aggregate({
                where: {
                    businessId: business.id,
                    transactionDate: { gte: thirtyDaysAgo },
                    status: 'COMPLETED'
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    taxAmount: true
                }
            });
            return {
                ...business,
                metrics: {
                    transactionsLast30Days: metrics._count.id,
                    revenueLast30Days: metrics._sum.totalAmount || 0,
                    taxCollectedLast30Days: metrics._sum.taxAmount || 0
                }
            };
        }));
        res.json({ businesses: businessesWithMetrics });
    }
    catch (error) {
        console.error('Error fetching businesses:', error);
        res.status(500).json({ error: 'Failed to fetch businesses' });
    }
});
router.get('/businesses/:businessId', async (req, res) => {
    try {
        const { businessId } = req.params;
        const userId = req.user.id;
        const business = await prisma_1.default.business.findFirst({
            where: {
                id: businessId,
                ownerId: userId,
                isActive: true
            },
            include: {
                posIntegrations: {
                    where: { isActive: true }
                },
                taxRates: {
                    where: { isActive: true },
                    orderBy: { effectiveDate: 'desc' }
                },
                _count: {
                    select: {
                        transactions: true,
                        reports: true
                    }
                }
            }
        });
        if (!business) {
            return res.status(404).json({ error: 'Business not found or access denied' });
        }
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        const [monthlyMetrics, yearlyMetrics] = await Promise.all([
            prisma_1.default.transaction.aggregate({
                where: {
                    businessId,
                    transactionDate: { gte: currentMonth },
                    status: 'COMPLETED'
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    taxAmount: true
                }
            }),
            prisma_1.default.transaction.aggregate({
                where: {
                    businessId,
                    transactionDate: {
                        gte: new Date(new Date().getFullYear(), 0, 1)
                    },
                    status: 'COMPLETED'
                },
                _count: { id: true },
                _sum: {
                    totalAmount: true,
                    taxAmount: true
                }
            })
        ]);
        res.json({
            business,
            metrics: {
                thisMonth: {
                    transactionCount: monthlyMetrics._count.id,
                    revenue: monthlyMetrics._sum.totalAmount || 0,
                    taxCollected: monthlyMetrics._sum.taxAmount || 0
                },
                thisYear: {
                    transactionCount: yearlyMetrics._count.id,
                    revenue: yearlyMetrics._sum.totalAmount || 0,
                    taxCollected: yearlyMetrics._sum.taxAmount || 0
                }
            }
        });
    }
    catch (error) {
        console.error('Error fetching business details:', error);
        res.status(500).json({ error: 'Failed to fetch business details' });
    }
});
router.get('/transactions', async (req, res) => {
    try {
        const userId = req.user.id;
        const { businessId, page = 1, limit = 20, status = 'all', startDate, endDate, search = '' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const userBusinesses = await prisma_1.default.business.findMany({
            where: { ownerId: userId, isActive: true },
            select: { id: true }
        });
        const userBusinessIds = userBusinesses.map(b => b.id);
        if (userBusinessIds.length === 0) {
            return res.json({
                transactions: [],
                pagination: { page: 1, limit: Number(limit), total: 0, pages: 0 }
            });
        }
        const whereClause = {
            businessId: { in: userBusinessIds }
        };
        if (businessId && userBusinessIds.includes(String(businessId))) {
            whereClause.businessId = String(businessId);
        }
        if (status !== 'all') {
            whereClause.status = String(status).toUpperCase();
        }
        if (startDate && endDate) {
            whereClause.transactionDate = {
                gte: new Date(String(startDate)),
                lte: new Date(String(endDate))
            };
        }
        if (search) {
            whereClause.OR = [
                { description: { contains: String(search), mode: 'insensitive' } },
                { externalId: { contains: String(search), mode: 'insensitive' } }
            ];
        }
        const [transactions, totalCount] = await Promise.all([
            prisma_1.default.transaction.findMany({
                where: whereClause,
                include: {
                    business: {
                        select: { id: true, name: true }
                    }
                },
                skip,
                take: Number(limit),
                orderBy: { transactionDate: 'desc' }
            }),
            prisma_1.default.transaction.count({ where: whereClause })
        ]);
        res.json({
            transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});
router.get('/compliance/overview', async (req, res) => {
    try {
        const userId = req.user.id;
        const { businessId } = req.query;
        let businessIds;
        if (businessId) {
            const business = await prisma_1.default.business.findFirst({
                where: { id: String(businessId), ownerId: userId, isActive: true }
            });
            if (!business) {
                return res.status(404).json({ error: 'Business not found or access denied' });
            }
            businessIds = [String(businessId)];
        }
        else {
            const businesses = await prisma_1.default.business.findMany({
                where: { ownerId: userId, isActive: true },
                select: { id: true }
            });
            businessIds = businesses.map(b => b.id);
        }
        if (businessIds.length === 0) {
            return res.json({
                complianceScore: 100,
                taxLiability: { current: 0, overdue: 0 },
                filingStatus: [],
                upcomingDeadlines: []
            });
        }
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);
        const currentMonthTax = await prisma_1.default.transaction.aggregate({
            where: {
                businessId: { in: businessIds },
                transactionDate: { gte: currentMonth },
                status: 'COMPLETED'
            },
            _sum: { taxAmount: true }
        });
        const complianceScore = 95;
        const filingStatus = [
            {
                period: 'Q3 2024',
                type: 'Sales Tax',
                status: 'filed',
                dueDate: new Date('2024-10-31'),
                amount: 1250.00
            },
            {
                period: 'October 2024',
                type: 'Sales Tax',
                status: 'pending',
                dueDate: new Date('2024-11-30'),
                amount: currentMonthTax._sum.taxAmount || 0
            }
        ];
        const upcomingDeadlines = [
            {
                type: 'Sales Tax Filing',
                dueDate: new Date(new Date().setDate(new Date().getDate() + 15)),
                jurisdiction: 'State',
                estimatedAmount: currentMonthTax._sum.taxAmount || 0
            }
        ];
        res.json({
            complianceScore,
            taxLiability: {
                current: currentMonthTax._sum.taxAmount || 0,
                overdue: 0
            },
            filingStatus,
            upcomingDeadlines
        });
    }
    catch (error) {
        console.error('Error fetching compliance overview:', error);
        res.status(500).json({ error: 'Failed to fetch compliance overview' });
    }
});
router.get('/analytics/insights', async (req, res) => {
    try {
        const userId = req.user.id;
        const { businessId, period = '30days' } = req.query;
        let businessIds;
        if (businessId) {
            const business = await prisma_1.default.business.findFirst({
                where: { id: String(businessId), ownerId: userId, isActive: true }
            });
            if (!business) {
                return res.status(404).json({ error: 'Business not found or access denied' });
            }
            businessIds = [String(businessId)];
        }
        else {
            const businesses = await prisma_1.default.business.findMany({
                where: { ownerId: userId, isActive: true },
                select: { id: true }
            });
            businessIds = businesses.map(b => b.id);
        }
        let dateFilter;
        switch (period) {
            case '7days':
                dateFilter = new Date();
                dateFilter.setDate(dateFilter.getDate() - 7);
                break;
            case '90days':
                dateFilter = new Date();
                dateFilter.setDate(dateFilter.getDate() - 90);
                break;
            case '1year':
                dateFilter = new Date();
                dateFilter.setFullYear(dateFilter.getFullYear() - 1);
                break;
            default:
                dateFilter = new Date();
                dateFilter.setDate(dateFilter.getDate() - 30);
        }
        const salesTrends = await prisma_1.default.transaction.groupBy({
            by: ['transactionDate'],
            where: {
                businessId: { in: businessIds },
                transactionDate: { gte: dateFilter },
                status: 'COMPLETED'
            },
            _sum: { totalAmount: true },
            _count: { id: true },
            orderBy: { transactionDate: 'asc' }
        });
        const categoryPerformance = await prisma_1.default.transaction.groupBy({
            by: ['productCategory'],
            where: {
                businessId: { in: businessIds },
                transactionDate: { gte: dateFilter },
                status: 'COMPLETED'
            },
            _sum: { totalAmount: true },
            _count: { id: true },
            orderBy: { _sum: { totalAmount: 'desc' } }
        });
        const locationPerformance = await prisma_1.default.transaction.groupBy({
            by: ['saleLocation'],
            where: {
                businessId: { in: businessIds },
                transactionDate: { gte: dateFilter },
                status: 'COMPLETED'
            },
            _sum: { totalAmount: true },
            _count: { id: true },
            orderBy: { _sum: { totalAmount: 'desc' } }
        });
        res.json({
            period,
            salesTrends,
            categoryPerformance: categoryPerformance.filter(c => c.productCategory),
            locationPerformance,
            summary: {
                totalSales: salesTrends.reduce((sum, day) => sum + Number(day._sum.totalAmount || 0), 0),
                totalTransactions: salesTrends.reduce((sum, day) => sum + day._count.id, 0),
                averageTransactionValue: salesTrends.length > 0
                    ? salesTrends.reduce((sum, day) => sum + Number(day._sum.totalAmount || 0), 0) /
                        salesTrends.reduce((sum, day) => sum + day._count.id, 0)
                    : 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching analytics insights:', error);
        res.status(500).json({ error: 'Failed to fetch analytics insights' });
    }
});
router.get('/reports', async (req, res) => {
    try {
        const userId = req.user.id;
        const { businessId, page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const userBusinesses = await prisma_1.default.business.findMany({
            where: { ownerId: userId, isActive: true },
            select: { id: true }
        });
        const userBusinessIds = userBusinesses.map(b => b.id);
        if (userBusinessIds.length === 0) {
            return res.json({
                reports: [],
                pagination: { page: 1, limit: Number(limit), total: 0, pages: 0 }
            });
        }
        const whereClause = {
            businessId: { in: userBusinessIds }
        };
        if (businessId && userBusinessIds.includes(String(businessId))) {
            whereClause.businessId = String(businessId);
        }
        const [reports, totalCount] = await Promise.all([
            prisma_1.default.report.findMany({
                where: whereClause,
                include: {
                    business: {
                        select: { id: true, name: true }
                    }
                },
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma_1.default.report.count({ where: whereClause })
        ]);
        res.json({
            reports,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});
exports.default = router;
//# sourceMappingURL=client.js.map