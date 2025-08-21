import prisma from '@/lib/prisma';
import type { User, Business, Transaction } from '@prisma/client';

export class DataAccessService {
  /**
   * Get businesses accessible to a user based on their role
   */
  static async getAccessibleBusinesses(user: User): Promise<string[]> {
    if (user.role === 'ADMIN') {
      // Admin can access all businesses
      const businesses = await prisma.business.findMany({
        where: { isActive: true },
        select: { id: true }
      });
      return businesses.map(b => b.id);
    } else {
      // Clients can only access their own businesses
      const businesses = await prisma.business.findMany({
        where: { 
          ownerId: user.id,
          isActive: true 
        },
        select: { id: true }
      });
      return businesses.map(b => b.id);
    }
  }

  /**
   * Verify if a user has access to a specific business
   */
  static async canAccessBusiness(user: User, businessId: string): Promise<boolean> {
    if (user.role === 'ADMIN') {
      return true;
    }

    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        ownerId: user.id,
        isActive: true
      }
    });

    return !!business;
  }

  /**
   * Get transactions with proper filtering based on user role
   */
  static async getTransactions(
    user: User,
    filters: {
      businessId?: string;
      startDate?: Date;
      endDate?: Date;
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const { businessId, startDate, endDate, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    // Get accessible business IDs
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

    const whereClause: any = {
      businessId: { in: accessibleBusinessIds }
    };

    // Additional filtering
    if (businessId) {
      // Verify access to specific business
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
      prisma.transaction.findMany({
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
      prisma.transaction.count({ where: whereClause })
    ]);

    return {
      transactions,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get reports with proper filtering
   */
  static async getReports(
    user: User,
    filters: {
      businessId?: string;
      type?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
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

    const whereClause: any = {
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
      prisma.report.findMany({
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
      prisma.report.count({ where: whereClause })
    ]);

    return {
      reports,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Get business metrics with proper access control
   */
  static async getBusinessMetrics(
    user: User,
    businessId?: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ) {
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

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30); // Last 30 days
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (12 * 7)); // Last 12 weeks
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 2); // Last 2 years
        break;
      default: // month
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12); // Last 12 months
    }

    const metrics = await prisma.transaction.aggregate({
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

    // Get trends over time
    const trends = await prisma.transaction.groupBy({
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

  /**
   * Admin-only: Get all client statistics
   */
  static async getClientStatistics(user: User) {
    if (user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }

    const [
      totalClients,
      activeClients,
      totalBusinesses,
      activeBusinesses,
      totalTransactions,
      recentTransactions
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.user.count({ where: { role: 'CLIENT', isActive: true } }),
      prisma.business.count(),
      prisma.business.count({ where: { isActive: true } }),
      prisma.transaction.count(),
      prisma.transaction.count({
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

  /**
   * Security check: Verify user can access specific resource
   */
  static async verifyResourceAccess(
    user: User,
    resourceType: 'business' | 'transaction' | 'report',
    resourceId: string
  ): Promise<boolean> {
    if (user.role === 'ADMIN') {
      return true; // Admin has access to everything
    }

    switch (resourceType) {
      case 'business':
        return await this.canAccessBusiness(user, resourceId);
        
      case 'transaction':
        const transaction = await prisma.transaction.findUnique({
          where: { id: resourceId },
          include: { business: true }
        });
        if (!transaction) return false;
        return await this.canAccessBusiness(user, transaction.businessId);
        
      case 'report':
        const report = await prisma.report.findUnique({
          where: { id: resourceId },
          include: { business: true }
        });
        if (!report) return false;
        return await this.canAccessBusiness(user, report.businessId);
        
      default:
        return false;
    }
  }
}

export default DataAccessService;
