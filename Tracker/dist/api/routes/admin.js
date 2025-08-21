"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = __importDefault(require("@/lib/prisma"));
const auth_1 = require("@/middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.protectAdminRoute);
router.get('/dashboard/overview', async (req, res) => {
    try {
        const activeClientsCount = await prisma_1.default.user.count({
            where: {
                role: 'CLIENT',
                isActive: true
            }
        });
        const activeBusinessesCount = await prisma_1.default.business.count({
            where: { isActive: true }
        });
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentTransactions = await prisma_1.default.transaction.aggregate({
            where: {
                createdAt: { gte: thirtyDaysAgo },
                status: 'COMPLETED'
            },
            _count: { id: true },
            _sum: {
                totalAmount: true,
                taxAmount: true
            }
        });
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const newClientsThisMonth = await prisma_1.default.user.count({
            where: {
                role: 'CLIENT',
                createdAt: { gte: startOfMonth }
            }
        });
        const systemHealth = {
            databaseStatus: 'healthy',
            lastUpdated: new Date(),
            totalUsers: await prisma_1.default.user.count(),
            totalTransactions: await prisma_1.default.transaction.count()
        };
        res.json({
            activeClients: activeClientsCount,
            activeBusinesses: activeBusinessesCount,
            newClientsThisMonth,
            recentActivity: {
                transactionCount: recentTransactions._count.id,
                totalRevenue: recentTransactions._sum.totalAmount || 0,
                totalTaxCollected: recentTransactions._sum.taxAmount || 0
            },
            systemHealth
        });
    }
    catch (error) {
        console.error('Error fetching admin overview:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard overview' });
    }
});
router.get('/clients', async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const whereClause = { role: 'CLIENT' };
        if (status !== 'all') {
            whereClause.isActive = status === 'active';
        }
        if (search) {
            whereClause.OR = [
                { email: { contains: String(search), mode: 'insensitive' } },
                { firstName: { contains: String(search), mode: 'insensitive' } },
                { lastName: { contains: String(search), mode: 'insensitive' } }
            ];
        }
        const [clients, totalCount] = await Promise.all([
            prisma_1.default.user.findMany({
                where: whereClause,
                include: {
                    businesses: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            name: true,
                            industry: true,
                            createdAt: true,
                            _count: {
                                select: { transactions: true }
                            }
                        }
                    },
                    _count: {
                        select: { transactions: true }
                    }
                },
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma_1.default.user.count({ where: whereClause })
        ]);
        res.json({
            clients,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});
router.get('/clients/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        const client = await prisma_1.default.user.findUnique({
            where: { id: clientId },
            include: {
                businesses: {
                    include: {
                        _count: {
                            select: {
                                transactions: true,
                                reports: true,
                                posIntegrations: true
                            }
                        }
                    }
                },
                transactions: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: { business: true }
                },
                auditLogs: {
                    take: 20,
                    orderBy: { timestamp: 'desc' }
                }
            }
        });
        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const metrics = await prisma_1.default.transaction.aggregate({
            where: {
                userId: clientId,
                createdAt: { gte: thirtyDaysAgo }
            },
            _count: { id: true },
            _sum: {
                totalAmount: true,
                taxAmount: true
            }
        });
        res.json({
            client,
            metrics: {
                transactionsLast30Days: metrics._count.id,
                revenueLast30Days: metrics._sum.totalAmount || 0,
                taxCollectedLast30Days: metrics._sum.taxAmount || 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching client details:', error);
        res.status(500).json({ error: 'Failed to fetch client details' });
    }
});
router.patch('/clients/:clientId/status', async (req, res) => {
    try {
        const { clientId } = req.params;
        const { isActive, reason } = req.body;
        const updatedClient = await prisma_1.default.user.update({
            where: { id: clientId },
            data: { isActive }
        });
        await prisma_1.default.auditLog.create({
            data: {
                action: isActive ? 'ACTIVATE_CLIENT' : 'DEACTIVATE_CLIENT',
                entityType: 'USER',
                entityId: clientId,
                metadata: { reason, adminUserId: req.user.id },
                userId: req.user.id
            }
        });
        res.json({ client: updatedClient, message: 'Client status updated successfully' });
    }
    catch (error) {
        console.error('Error updating client status:', error);
        res.status(500).json({ error: 'Failed to update client status' });
    }
});
router.get('/revenue/overview', async (req, res) => {
    try {
        const { period = '30days' } = req.query;
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
        const revenueData = await prisma_1.default.transaction.groupBy({
            by: ['transactionDate'],
            where: {
                transactionDate: { gte: dateFilter },
                status: 'COMPLETED'
            },
            _sum: {
                totalAmount: true,
                taxAmount: true
            },
            orderBy: { transactionDate: 'asc' }
        });
        const industryRevenue = await prisma_1.default.transaction.groupBy({
            by: ['businessId'],
            where: {
                transactionDate: { gte: dateFilter },
                status: 'COMPLETED'
            },
            _sum: { totalAmount: true },
            orderBy: { _sum: { totalAmount: 'desc' } }
        });
        const businesses = await prisma_1.default.business.findMany({
            where: {
                id: { in: industryRevenue.map(r => r.businessId) }
            },
            select: { id: true, name: true, industry: true }
        });
        const industryBreakdown = industryRevenue.map(item => {
            const business = businesses.find(b => b.id === item.businessId);
            return {
                businessId: item.businessId,
                businessName: business?.name,
                industry: business?.industry,
                revenue: item._sum.totalAmount
            };
        });
        const totalMetrics = await prisma_1.default.transaction.aggregate({
            where: {
                transactionDate: { gte: dateFilter },
                status: 'COMPLETED'
            },
            _count: { id: true },
            _sum: {
                totalAmount: true,
                taxAmount: true
            }
        });
        res.json({
            period,
            revenueOverTime: revenueData,
            industryBreakdown,
            totalMetrics: {
                transactionCount: totalMetrics._count.id,
                totalRevenue: totalMetrics._sum.totalAmount || 0,
                totalTaxCollected: totalMetrics._sum.taxAmount || 0
            }
        });
    }
    catch (error) {
        console.error('Error fetching revenue analytics:', error);
        res.status(500).json({ error: 'Failed to fetch revenue analytics' });
    }
});
router.get('/system/stats', async (req, res) => {
    try {
        const stats = {
            users: {
                total: await prisma_1.default.user.count(),
                active: await prisma_1.default.user.count({ where: { isActive: true } }),
                admins: await prisma_1.default.user.count({ where: { role: 'ADMIN' } }),
                clients: await prisma_1.default.user.count({ where: { role: 'CLIENT' } })
            },
            businesses: {
                total: await prisma_1.default.business.count(),
                active: await prisma_1.default.business.count({ where: { isActive: true } })
            },
            transactions: {
                total: await prisma_1.default.transaction.count(),
                thisMonth: await prisma_1.default.transaction.count({
                    where: {
                        createdAt: {
                            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                        }
                    }
                })
            },
            integrations: {
                total: await prisma_1.default.posIntegration.count(),
                active: await prisma_1.default.posIntegration.count({ where: { isActive: true } })
            }
        };
        res.json(stats);
    }
    catch (error) {
        console.error('Error fetching system stats:', error);
        res.status(500).json({ error: 'Failed to fetch system statistics' });
    }
});
router.get('/audit/logs', async (req, res) => {
    try {
        const { page = 1, limit = 50, entityType, action } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const whereClause = {};
        if (entityType) {
            whereClause.entityType = entityType;
        }
        if (action) {
            whereClause.action = action;
        }
        const [logs, totalCount] = await Promise.all([
            prisma_1.default.auditLog.findMany({
                where: whereClause,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            role: true
                        }
                    }
                },
                skip,
                take: Number(limit),
                orderBy: { timestamp: 'desc' }
            }),
            prisma_1.default.auditLog.count({ where: whereClause })
        ]);
        res.json({
            logs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / Number(limit))
            }
        });
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map