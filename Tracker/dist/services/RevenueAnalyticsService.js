"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueAnalyticsService = void 0;
const ClientTier_1 = require("../models/ClientTier");
const ClientSubscription_1 = require("../models/ClientSubscription");
const RevenueStream_1 = require("../models/RevenueStream");
const RevenueTransaction_1 = require("../models/RevenueTransaction");
class RevenueAnalyticsService {
    static async calculateMRR(startDate, endDate, tierFilter) {
        try {
            const matchConditions = {
                status: 'active'
            };
            if (startDate && endDate) {
                matchConditions.$and = [
                    { startDate: { $lte: endDate } },
                    {
                        $or: [
                            { endDate: null },
                            { endDate: { $gte: startDate } }
                        ]
                    }
                ];
            }
            if (tierFilter) {
                matchConditions.tierId = tierFilter;
            }
            const result = await ClientSubscription_1.ClientSubscription.aggregate([
                { $match: matchConditions },
                {
                    $group: {
                        _id: null,
                        totalMrr: { $sum: '$mrr' },
                        activeSubscriptions: { $sum: 1 }
                    }
                }
            ]);
            return {
                totalMrr: result[0]?.totalMrr || 0,
                activeSubscriptions: result[0]?.activeSubscriptions || 0
            };
        }
        catch (error) {
            console.error('Error calculating MRR:', error);
            return { totalMrr: 0, activeSubscriptions: 0 };
        }
    }
    static async calculateARR(startDate, endDate, tierFilter) {
        try {
            const mrr = await this.calculateMRR(startDate, endDate, tierFilter);
            return {
                totalArr: mrr.totalMrr * 12,
                activeSubscriptions: mrr.activeSubscriptions
            };
        }
        catch (error) {
            console.error('Error calculating ARR:', error);
            return { totalArr: 0, activeSubscriptions: 0 };
        }
    }
    static async getRevenueByStream(startDate, endDate) {
        try {
            const result = await RevenueStream_1.RevenueStream.aggregate([
                {
                    $match: { isActive: true }
                },
                {
                    $lookup: {
                        from: 'revenuetransactions',
                        let: { streamId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$revenueStreamId', '$$streamId'] },
                                            { $gte: ['$transactionDate', startDate] },
                                            { $lte: ['$transactionDate', endDate] },
                                            { $eq: ['$status', 'completed'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'transactions'
                    }
                },
                {
                    $project: {
                        name: 1,
                        category: 1,
                        transactionCount: { $size: '$transactions' },
                        totalRevenue: {
                            $ifNull: [
                                { $sum: '$transactions.amount' },
                                0
                            ]
                        },
                        netRevenue: {
                            $ifNull: [
                                { $sum: '$transactions.netAmount' },
                                0
                            ]
                        }
                    }
                },
                {
                    $sort: { totalRevenue: -1 }
                }
            ]);
            return result;
        }
        catch (error) {
            console.error('Error getting revenue by stream:', error);
            return [];
        }
    }
    static async getRevenueByTier(startDate, endDate) {
        try {
            const result = await ClientTier_1.ClientTier.aggregate([
                {
                    $match: { isActive: true }
                },
                {
                    $lookup: {
                        from: 'clientsubscriptions',
                        localField: '_id',
                        foreignField: 'tierId',
                        as: 'subscriptions'
                    }
                },
                {
                    $lookup: {
                        from: 'revenuetransactions',
                        let: { clientIds: '$subscriptions.clientId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $in: ['$clientId', '$$clientIds'] },
                                            { $gte: ['$transactionDate', startDate] },
                                            { $lte: ['$transactionDate', endDate] },
                                            { $eq: ['$status', 'completed'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'transactions'
                    }
                },
                {
                    $project: {
                        tierName: '$name',
                        uniqueClients: { $size: { $setUnion: ['$transactions.clientId', []] } },
                        transactionCount: { $size: '$transactions' },
                        totalRevenue: {
                            $ifNull: [
                                { $sum: '$transactions.amount' },
                                0
                            ]
                        },
                        avgTransactionAmount: {
                            $cond: {
                                if: { $gt: [{ $size: '$transactions' }, 0] },
                                then: { $avg: '$transactions.amount' },
                                else: 0
                            }
                        }
                    }
                },
                {
                    $sort: { totalRevenue: -1 }
                }
            ]);
            return result;
        }
        catch (error) {
            console.error('Error getting revenue by tier:', error);
            return [];
        }
    }
    static async getRevenueSummary(startDate, endDate) {
        try {
            const result = await RevenueTransaction_1.RevenueTransaction.aggregate([
                {
                    $match: {
                        transactionDate: { $gte: startDate, $lte: endDate },
                        status: 'completed'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalTransactions: { $sum: 1 },
                        totalRevenue: { $sum: '$amount' },
                        netRevenue: { $sum: '$netAmount' },
                        totalTax: { $sum: '$taxAmount' },
                        avgTransactionAmount: { $avg: '$amount' }
                    }
                }
            ]);
            return result[0] || {
                totalTransactions: 0,
                totalRevenue: 0,
                netRevenue: 0,
                totalTax: 0,
                avgTransactionAmount: 0
            };
        }
        catch (error) {
            console.error('Error getting revenue summary:', error);
            return {
                totalTransactions: 0,
                totalRevenue: 0,
                netRevenue: 0,
                totalTax: 0,
                avgTransactionAmount: 0
            };
        }
    }
    static async getRevenueGrowthRate(currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd) {
        try {
            const [currentRevenue, previousRevenue] = await Promise.all([
                this.getRevenueSummary(currentPeriodStart, currentPeriodEnd),
                this.getRevenueSummary(previousPeriodStart, previousPeriodEnd)
            ]);
            const growthRate = previousRevenue.totalRevenue > 0
                ? ((currentRevenue.totalRevenue - previousRevenue.totalRevenue) / previousRevenue.totalRevenue) * 100
                : 0;
            return {
                currentRevenue: currentRevenue.totalRevenue,
                previousRevenue: previousRevenue.totalRevenue,
                growthRate: Math.round(growthRate * 100) / 100,
                growthAmount: currentRevenue.totalRevenue - previousRevenue.totalRevenue
            };
        }
        catch (error) {
            console.error('Error calculating growth rate:', error);
            return {
                currentRevenue: 0,
                previousRevenue: 0,
                growthRate: 0,
                growthAmount: 0
            };
        }
    }
    static async getCustomerLifetimeValueByTier() {
        try {
            const result = await ClientTier_1.ClientTier.aggregate([
                {
                    $lookup: {
                        from: 'clientsubscriptions',
                        localField: '_id',
                        foreignField: 'tierId',
                        as: 'subscriptions'
                    }
                },
                {
                    $lookup: {
                        from: 'revenuetransactions',
                        let: { clientIds: '$subscriptions.clientId' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $in: ['$clientId', '$$clientIds'] },
                                            { $eq: ['$status', 'completed'] }
                                        ]
                                    }
                                }
                            },
                            {
                                $group: {
                                    _id: '$clientId',
                                    totalRevenue: { $sum: '$amount' }
                                }
                            }
                        ],
                        as: 'clientRevenue'
                    }
                },
                {
                    $project: {
                        tierName: '$name',
                        monthlyPrice: 1,
                        avgLifetimeValue: {
                            $cond: {
                                if: { $gt: [{ $size: '$clientRevenue' }, 0] },
                                then: { $avg: '$clientRevenue.totalRevenue' },
                                else: 0
                            }
                        },
                        totalClients: { $size: '$clientRevenue' }
                    }
                },
                {
                    $sort: { avgLifetimeValue: -1 }
                }
            ]);
            return result;
        }
        catch (error) {
            console.error('Error calculating CLV by tier:', error);
            return [];
        }
    }
    static async getChurnAnalysis(startDate, endDate) {
        try {
            const [totalAtStart, cancelled, newSubscriptions] = await Promise.all([
                ClientSubscription_1.ClientSubscription.countDocuments({
                    startDate: { $lt: startDate },
                    $or: [
                        { endDate: null },
                        { endDate: { $gte: startDate } }
                    ],
                    status: { $in: ['active', 'cancelled'] }
                }),
                ClientSubscription_1.ClientSubscription.countDocuments({
                    endDate: { $gte: startDate, $lte: endDate },
                    status: 'cancelled'
                }),
                ClientSubscription_1.ClientSubscription.countDocuments({
                    startDate: { $gte: startDate, $lte: endDate },
                    status: 'active'
                })
            ]);
            const churnRate = totalAtStart > 0 ? (cancelled / totalAtStart) * 100 : 0;
            return {
                subscriptionsAtStart: totalAtStart,
                cancelledSubscriptions: cancelled,
                newSubscriptions: newSubscriptions,
                churnRate: Math.round(churnRate * 100) / 100,
                netGrowth: newSubscriptions - cancelled
            };
        }
        catch (error) {
            console.error('Error calculating churn analysis:', error);
            return {
                subscriptionsAtStart: 0,
                cancelledSubscriptions: 0,
                newSubscriptions: 0,
                churnRate: 0,
                netGrowth: 0
            };
        }
    }
}
exports.RevenueAnalyticsService = RevenueAnalyticsService;
//# sourceMappingURL=RevenueAnalyticsService.js.map