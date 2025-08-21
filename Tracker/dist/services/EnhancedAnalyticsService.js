"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedAnalyticsService = void 0;
const RevenueAnalyticsService_1 = require("./RevenueAnalyticsService");
const Client_1 = require("../models/Client");
const ClientSubscription_1 = require("../models/ClientSubscription");
const RevenueTransaction_1 = require("../models/RevenueTransaction");
const ClientActivity_1 = require("../models/ClientActivity");
const ClientHealthScore_1 = require("../models/ClientHealthScore");
const ChurnEvent_1 = require("../models/ChurnEvent");
class EnhancedAnalyticsService extends RevenueAnalyticsService_1.RevenueAnalyticsService {
    static async getCohortAnalysis(months = 12) {
        try {
            const monthsAgo = new Date();
            monthsAgo.setMonth(monthsAgo.getMonth() - months);
            const cohortData = await Client_1.Client.aggregate([
                {
                    $match: {
                        signupDate: { $gte: monthsAgo }
                    }
                },
                {
                    $addFields: {
                        cohortMonth: {
                            $dateFromParts: {
                                year: { $year: '$signupDate' },
                                month: { $month: '$signupDate' },
                                day: 1
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'clientsubscriptions',
                        localField: '_id',
                        foreignField: 'clientId',
                        as: 'subscriptions'
                    }
                },
                {
                    $lookup: {
                        from: 'revenuetransactions',
                        let: { clientId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$clientId', '$$clientId'] },
                                            { $eq: ['$status', 'completed'] }
                                        ]
                                    }
                                }
                            },
                            {
                                $lookup: {
                                    from: 'revenuestreams',
                                    localField: 'revenueStreamId',
                                    foreignField: '_id',
                                    as: 'stream'
                                }
                            },
                            {
                                $match: {
                                    'stream.category': 'subscription'
                                }
                            },
                            {
                                $addFields: {
                                    revenueMonth: {
                                        $dateFromParts: {
                                            year: { $year: '$transactionDate' },
                                            month: { $month: '$transactionDate' },
                                            day: 1
                                        }
                                    }
                                }
                            }
                        ],
                        as: 'revenueTransactions'
                    }
                },
                {
                    $group: {
                        _id: '$cohortMonth',
                        cohortSize: { $sum: 1 },
                        clients: { $push: '$$ROOT' }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            return this.formatCohortData(cohortData);
        }
        catch (error) {
            console.error('Error performing cohort analysis:', error);
            return [];
        }
    }
    static formatCohortData(cohortData) {
        const result = [];
        cohortData.forEach(cohort => {
            const cohortMonth = cohort._id.toISOString().slice(0, 7);
            const cohortInfo = {
                cohort_month: cohortMonth,
                cohort_size: cohort.cohortSize,
                initial_mrr: 0,
                months: {}
            };
            let initialMrr = 0;
            const monthlyData = {};
            cohort.clients.forEach((client) => {
                client.subscriptions.forEach((sub) => {
                    if (sub.status === 'active') {
                        initialMrr += sub.mrr || 0;
                    }
                });
                client.revenueTransactions.forEach((transaction) => {
                    const monthDiff = this.getMonthDifference(cohort._id, transaction.revenueMonth);
                    if (!monthlyData[monthDiff]) {
                        monthlyData[monthDiff] = {
                            active_clients: new Set(),
                            period_mrr: 0
                        };
                    }
                    monthlyData[monthDiff].active_clients.add(client._id.toString());
                    monthlyData[monthDiff].period_mrr += transaction.amount;
                });
            });
            cohortInfo.initial_mrr = initialMrr;
            Object.keys(monthlyData).forEach(monthNum => {
                const num = parseInt(monthNum);
                const data = monthlyData[num];
                cohortInfo.months[num] = {
                    active_clients: data.active_clients.size,
                    period_mrr: data.period_mrr,
                    retention_rate: (data.active_clients.size / cohort.cohortSize) * 100,
                    revenue_retention_rate: initialMrr > 0 ? (data.period_mrr / initialMrr) * 100 : 0
                };
            });
            result.push(cohortInfo);
        });
        return result;
    }
    static getMonthDifference(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    }
    static async calculateChurnMetrics(startDate, endDate) {
        try {
            const churnEvents = await ChurnEvent_1.ChurnEvent.aggregate([
                {
                    $match: {
                        churnDate: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateFromParts: {
                                year: { $year: '$churnDate' },
                                month: { $month: '$churnDate' },
                                day: 1
                            }
                        },
                        churned_customers: { $sum: 1 },
                        mrr_lost: { $sum: '$mrrLost' },
                        avg_customer_lifetime: { $avg: '$daysAsCustomer' }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            const activeCustomers = await ClientSubscription_1.ClientSubscription.aggregate([
                {
                    $match: {
                        status: 'active',
                        startDate: { $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateFromParts: {
                                year: { $year: '$startDate' },
                                month: { $month: '$startDate' },
                                day: 1
                            }
                        },
                        active_customers: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            const churnByMonth = churnEvents.map(item => ({
                churn_month: item._id,
                churned_customers: item.churned_customers,
                mrr_lost: item.mrr_lost,
                avg_customer_lifetime: item.avg_customer_lifetime
            }));
            const activeByMonth = activeCustomers.map(item => ({
                month: item._id,
                active_customers: item.active_customers
            }));
            const overallChurnRate = this.calculateOverallChurnRate(churnByMonth, activeByMonth);
            return {
                churn_by_month: churnByMonth,
                active_by_month: activeByMonth,
                overall_churn_rate: overallChurnRate
            };
        }
        catch (error) {
            console.error('Error calculating churn metrics:', error);
            return {
                churn_by_month: [],
                active_by_month: [],
                overall_churn_rate: 0
            };
        }
    }
    static calculateOverallChurnRate(churnData, activeData) {
        const totalChurned = churnData.reduce((sum, row) => sum + row.churned_customers, 0);
        const avgActive = activeData.reduce((sum, row) => sum + row.active_customers, 0) / (activeData.length || 1);
        return avgActive > 0 ? (totalChurned / avgActive) * 100 : 0;
    }
    static async calculateClientHealthScore(clientId) {
        try {
            const client = await Client_1.Client.findById(clientId).populate({
                path: 'currentTierId',
                model: 'ClientTier'
            });
            if (!client) {
                throw new Error('Client not found');
            }
            const subscription = await ClientSubscription_1.ClientSubscription.findOne({
                clientId: clientId,
                status: 'active'
            }).populate('tierId');
            if (!subscription) {
                throw new Error('No active subscription found');
            }
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const activities = await ClientActivity_1.ClientActivity.aggregate([
                {
                    $match: {
                        clientId: clientId,
                        activityDate: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: '$activityType',
                        activity_count: { $sum: 1 },
                        last_activity: { $max: '$activityDate' }
                    }
                }
            ]);
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const paymentHistory = await RevenueTransaction_1.RevenueTransaction.aggregate([
                {
                    $match: {
                        clientId: clientId,
                        transactionDate: { $gte: ninetyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total_payments: { $sum: 1 },
                        failed_payments: {
                            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                        },
                        avg_payment: { $avg: '$amount' },
                        last_payment: { $max: '$transactionDate' }
                    }
                }
            ]);
            const payments = paymentHistory[0] || {
                total_payments: 0,
                failed_payments: 0,
                avg_payment: 0,
                last_payment: null
            };
            return this.computeHealthScore(client, subscription, activities, payments);
        }
        catch (error) {
            console.error('Error calculating client health score:', error);
            throw error;
        }
    }
    static computeHealthScore(client, subscription, activities, payments) {
        let score = 50;
        const factors = {};
        const paymentReliability = payments.total_payments > 0
            ? (payments.total_payments - payments.failed_payments) / payments.total_payments
            : 0;
        const paymentScore = paymentReliability * 30;
        score += paymentScore;
        factors.payment_reliability = paymentReliability;
        const loginActivity = activities.find(a => a._id === 'login');
        const recentLogins = loginActivity ? loginActivity.activity_count : 0;
        const activityScore = Math.min(recentLogins / 10, 1) * 25;
        score += activityScore;
        factors.activity_level = recentLogins;
        const daysAsCustomer = Math.floor((Date.now() - client.signupDate.getTime()) / (1000 * 60 * 60 * 24));
        const tenureMonths = daysAsCustomer / 30;
        const tenureScore = Math.min(tenureMonths / 12, 1) * 15;
        score += tenureScore;
        factors.tenure_months = tenureMonths;
        const tierPrice = subscription.tierId.monthlyPrice || 0;
        const pricingFit = tierPrice > 0 ? subscription.mrr / tierPrice : 1;
        const pricingScore = Math.min(pricingFit, 1) * 10;
        score += pricingScore;
        factors.pricing_fit = pricingFit;
        const supportActivity = activities.find(a => a._id === 'support_ticket');
        const supportTickets = supportActivity ? supportActivity.activity_count : 0;
        const supportPenalty = Math.min(supportTickets * 2, 20);
        score -= supportPenalty;
        factors.support_tickets = supportTickets;
        const churnRisk = Math.max(0, (100 - score) / 100);
        const upsellScore = this.calculateUpsellPotential(activities, payments);
        return {
            health_score: Math.max(0, Math.min(100, Math.round(score))),
            churn_risk_score: Math.round(churnRisk * 100) / 100,
            upsell_score: upsellScore,
            factors
        };
    }
    static calculateUpsellPotential(activities, payments) {
        let upsellScore = 0.1;
        const loginActivity = activities.find(a => a._id === 'login');
        if (loginActivity && loginActivity.activity_count > 15) {
            upsellScore += 0.3;
        }
        const usageActivity = activities.find(a => a._id === 'feature_usage');
        if (usageActivity && usageActivity.activity_count > 50) {
            upsellScore += 0.4;
        }
        if (payments.total_payments > 6 && payments.failed_payments === 0) {
            upsellScore += 0.2;
        }
        return Math.min(1, upsellScore);
    }
    static async generateRevenueForecast(months = 6) {
        try {
            const twentyFourMonthsAgo = new Date();
            twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
            const historicalData = await RevenueTransaction_1.RevenueTransaction.aggregate([
                {
                    $match: {
                        transactionDate: { $gte: twentyFourMonthsAgo },
                        status: 'completed'
                    }
                },
                {
                    $lookup: {
                        from: 'revenuestreams',
                        localField: 'revenueStreamId',
                        foreignField: '_id',
                        as: 'stream'
                    }
                },
                {
                    $match: {
                        'stream.category': 'subscription'
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateFromParts: {
                                year: { $year: '$transactionDate' },
                                month: { $month: '$transactionDate' },
                                day: 1
                            }
                        },
                        monthly_subscription_revenue: { $sum: '$amount' },
                        active_clients: { $addToSet: '$clientId' }
                    }
                },
                {
                    $addFields: {
                        active_clients: { $size: '$active_clients' }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            if (historicalData.length < 6) {
                throw new Error('Insufficient historical data for forecasting');
            }
            const formattedHistoricalData = historicalData.map(item => ({
                month: item._id,
                monthly_subscription_revenue: item.monthly_subscription_revenue,
                active_clients: item.active_clients
            }));
            return this.computeForecast(formattedHistoricalData, months);
        }
        catch (error) {
            console.error('Error generating revenue forecast:', error);
            throw error;
        }
    }
    static computeForecast(historicalData, months) {
        const n = historicalData.length;
        const x = historicalData.map((_, i) => i);
        const y = historicalData.map(d => d.monthly_subscription_revenue);
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        const forecasts = [];
        const lastMonth = new Date(historicalData[n - 1].month);
        for (let i = 1; i <= months; i++) {
            const forecastMonth = new Date(lastMonth);
            forecastMonth.setMonth(forecastMonth.getMonth() + i);
            const forecastValue = intercept + slope * (n + i - 1);
            const confidence = Math.max(0.5, 1 - (i * 0.1));
            forecasts.push({
                month: forecastMonth.toISOString().slice(0, 7),
                predicted_mrr: Math.max(0, forecastValue),
                predicted_arr: Math.max(0, forecastValue * 12),
                confidence_score: confidence
            });
        }
        return {
            historical_data: historicalData,
            forecasts: forecasts,
            trend: {
                slope: slope,
                growth_rate: slope > 0 ? (slope / (sumY / n)) * 100 : 0
            }
        };
    }
    static async getTopClientsHealthScores(limit = 10) {
        try {
            const result = await ClientHealthScore_1.ClientHealthScore.aggregate([
                {
                    $sort: { clientId: 1, scoreDate: -1 }
                },
                {
                    $group: {
                        _id: '$clientId',
                        latestHealthScore: { $first: '$$ROOT' }
                    }
                },
                {
                    $lookup: {
                        from: 'clients',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'client'
                    }
                },
                {
                    $lookup: {
                        from: 'clientsubscriptions',
                        let: { clientId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$clientId', '$$clientId'] },
                                            { $eq: ['$status', 'active'] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: 'subscription'
                    }
                },
                {
                    $lookup: {
                        from: 'clienttiers',
                        localField: 'subscription.tierId',
                        foreignField: '_id',
                        as: 'tier'
                    }
                },
                {
                    $match: {
                        client: { $ne: [] },
                        subscription: { $ne: [] }
                    }
                },
                {
                    $project: {
                        client_name: { $arrayElemAt: ['$client.name', 0] },
                        email: { $arrayElemAt: ['$client.email', 0] },
                        tier_name: { $arrayElemAt: ['$tier.name', 0] },
                        mrr: { $arrayElemAt: ['$subscription.mrr', 0] },
                        health_score: '$latestHealthScore.healthScore',
                        churn_risk_score: '$latestHealthScore.churnRiskScore',
                        upsell_score: '$latestHealthScore.upsellScore',
                        score_date: '$latestHealthScore.scoreDate'
                    }
                },
                {
                    $sort: { health_score: -1 }
                },
                {
                    $limit: limit
                }
            ]);
            return result;
        }
        catch (error) {
            console.error('Error getting top clients health scores:', error);
            return [];
        }
    }
    static async getAdvancedDashboardData(startDate, endDate) {
        try {
            const [cohortAnalysis, churnMetrics, topClientsHealth, revenueForecast] = await Promise.all([
                this.getCohortAnalysis(12),
                this.calculateChurnMetrics(startDate, endDate),
                this.getTopClientsHealthScores(10),
                this.generateRevenueForecast(6)
            ]);
            return {
                cohort_analysis: cohortAnalysis,
                churn_metrics: churnMetrics,
                top_clients_health: topClientsHealth,
                revenue_forecast: revenueForecast,
                generated_at: new Date().toISOString()
            };
        }
        catch (error) {
            console.error('Error getting advanced dashboard data:', error);
            throw error;
        }
    }
}
exports.EnhancedAnalyticsService = EnhancedAnalyticsService;
//# sourceMappingURL=EnhancedAnalyticsService.js.map