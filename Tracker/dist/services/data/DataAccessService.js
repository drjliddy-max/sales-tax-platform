"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataAccessService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
class DataAccessService {
    static async getAccessibleBusinesses(user) {
        if (user.role === 'ADMIN') {
            const businesses = await prisma_1.default.business.findMany({
                where: { isActive: true },
                select: { id: true }
            });
            return businesses.map(b => b.id);
        }
        else {
            const businesses = await prisma_1.default.business.findMany({
                where: {
                    ownerId: user.id,
                    isActive: true
                },
                select: { id: true }
            });
            return businesses.map(b => b.id);
        }
    }
    static async canAccessBusiness(user, businessId) {
        if (user.role === 'ADMIN') {
            return true;
        }
        const business = await prisma_1.default.business.findFirst({
            where: {
                id: businessId,
                ownerId: user.id,
                isActive: true
            }
        });
        return !!business;
    }
    static async getTransactions(user, filters = {}) {
        const { businessId, startDate, endDate, status, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;
        const accessibleBusinessIds = await this.getAccessibleBusinesses(user);
        if (accessibleBusinessIds.length === 0) {
            return {
                transactions: [],
                total: 0,
                page,
                limit,
                pages: 0
            };
        }
        const whereClause = {
            businessId: { in: accessibleBusinessIds }
        };
        if (businessId) {
            if (!accessibleBusinessIds.includes(businessId)) {
                throw new Error('Access denied to this business');
            }
            whereClause.businessId = businessId;
        }
        if (startDate && endDate) {
            whereClause.transactionDate = {
                gte: startDate,
                lte: endDate
            };
        }
        if (status && status !== 'all') {
            whereClause.status = status.toUpperCase();
        }
        const [transactions, total] = await Promise.all([
            prisma_1.default.transaction.findMany({
                where: whereClause,
                include: {
                    business: {
                        select: { id: true, name: true, industry: true }
                    }
                },
                skip,
                take: limit,
                orderBy: { transactionDate: 'desc' }
            }),
            prisma_1.default.transaction.count({ where: whereClause })
        ]);
        return {
            transactions,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }
    static async getReports(user, filters = {}) {
        const { businessId, type, page = 1, limit = 20 } = filters;
        const skip = (page - 1) * limit;
        const accessibleBusinessIds = await this.getAccessibleBusinesses(user);
        if (accessibleBusinessIds.length === 0) {
            return {
                reports: [],
                total: 0,
                page,
                limit,
                pages: 0
            };
        }
        const whereClause = {
            businessId: { in: accessibleBusinessIds }
        };
        if (businessId) {
            if (!accessibleBusinessIds.includes(businessId)) {
                throw new Error('Access denied to this business');
            }
            whereClause.businessId = businessId;
        }
        if (type) {
            whereClause.type = type;
        }
        const [reports, total] = await Promise.all([
            prisma_1.default.report.findMany({
                where: whereClause,
                include: {
                    business: {
                        select: { id: true, name: true }
                    }
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma_1.default.report.count({ where: whereClause })
        ]);
        return {
            reports,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }
    static async getBusinessMetrics(user, businessId, period = 'month') {
        const accessibleBusinessIds = await this.getAccessibleBusinesses(user);
        if (accessibleBusinessIds.length === 0) {
            return {
                totalTransactions: 0,
                totalRevenue: 0,
                totalTax: 0,
                trends: []
            };
        }
        let targetBusinessIds = accessibleBusinessIds;
        if (businessId) {
            if (!accessibleBusinessIds.includes(businessId)) {
                throw new Error('Access denied to this business');
            }
            targetBusinessIds = [businessId];
        }
        const now = new Date();
        let startDate;
        switch (period) {
            case 'day':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                break;
            case 'week':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - (12 * 7));
                break;
            case 'year':
                startDate = new Date(now);
                startDate.setFullYear(startDate.getFullYear() - 2);
                break;
            default:
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - 12);
        }
        const metrics = await prisma_1.default.transaction.aggregate({
            where: {
                businessId: { in: targetBusinessIds },
                transactionDate: { gte: startDate },
                status: 'COMPLETED'
            },
            _count: { id: true },
            _sum: {
                totalAmount: true,
                taxAmount: true
            }
        });
        const trends = await prisma_1.default.transaction.groupBy({
            by: ['transactionDate'],
            where: {
                businessId: { in: targetBusinessIds },
                transactionDate: { gte: startDate },
                status: 'COMPLETED'
            },
            _sum: {
                totalAmount: true,
                taxAmount: true
            },
            _count: { id: true },
            orderBy: { transactionDate: 'asc' }
        });
        return {
            totalTransactions: metrics._count.id,
            totalRevenue: metrics._sum.totalAmount || 0,
            totalTax: metrics._sum.taxAmount || 0,
            trends: trends.map(trend => ({
                date: trend.transactionDate,
                transactions: trend._count.id,
                revenue: trend._sum.totalAmount || 0,
                tax: trend._sum.taxAmount || 0
            }))
        };
    }
    static async getClientStatistics(user) {
        if (user.role !== 'ADMIN') {
            throw new Error('Admin access required');
        }
        const [totalClients, activeClients, totalBusinesses, activeBusinesses, totalTransactions, recentTransactions] = await Promise.all([
            prisma_1.default.user.count({ where: { role: 'CLIENT' } }),
            prisma_1.default.user.count({ where: { role: 'CLIENT', isActive: true } }),
            prisma_1.default.business.count(),
            prisma_1.default.business.count({ where: { isActive: true } }),
            prisma_1.default.transaction.count(),
            prisma_1.default.transaction.count({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setDate(new Date().getDate() - 30))
                    }
                }
            })
        ]);
        return {
            clients: {
                total: totalClients,
                active: activeClients
            },
            businesses: {
                total: totalBusinesses,
                active: activeBusinesses
            },
            transactions: {
                total: totalTransactions,
                last30Days: recentTransactions
            }
        };
    }
    static async verifyResourceAccess(user, resourceType, resourceId) {
        if (user.role === 'ADMIN') {
            return true;
        }
        switch (resourceType) {
            case 'business':
                return await this.canAccessBusiness(user, resourceId);
            case 'transaction':
                const transaction = await prisma_1.default.transaction.findUnique({
                    where: { id: resourceId },
                    include: { business: true }
                });
                if (!transaction)
                    return false;
                return await this.canAccessBusiness(user, transaction.businessId);
            case 'report':
                const report = await prisma_1.default.report.findUnique({
                    where: { id: resourceId },
                    include: { business: true }
                });
                if (!report)
                    return false;
                return await this.canAccessBusiness(user, report.businessId);
            default:
                return false;
        }
    }
}
exports.DataAccessService = DataAccessService;
exports.default = DataAccessService;
//# sourceMappingURL=DataAccessService.js.map