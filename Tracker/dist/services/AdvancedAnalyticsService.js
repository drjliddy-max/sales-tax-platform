"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedAnalyticsService = void 0;
const ClientActivity_1 = require("../models/ClientActivity");
const ClientCohort_1 = require("../models/ClientCohort");
const RevenueForecast_1 = require("../models/RevenueForecast");
const ClientHealthScore_1 = require("../models/ClientHealthScore");
const ChurnEvent_1 = require("../models/ChurnEvent");
const Client_1 = require("../models/Client");
const ClientSubscription_1 = require("../models/ClientSubscription");
class AdvancedAnalyticsService {
    static async logActivity(clientId, activityType, activityData = {}) {
        try {
            await ClientActivity_1.ClientActivity.create({
                clientId,
                activityType,
                activityData,
                activityDate: new Date()
            });
        }
        catch (error) {
            console.error('Error logging client activity:', error);
            throw error;
        }
    }
    static async calculateClientHealthScore(clientId) {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const activities = await ClientActivity_1.ClientActivity.find({
                clientId,
                activityDate: { $gte: thirtyDaysAgo }
            });
            const subscription = await ClientSubscription_1.ClientSubscription.findOne({
                clientId,
                status: 'active'
            }).populate('tierId');
            if (!subscription) {
                return 0;
            }
            const loginCount = activities.filter(a => a.activityType === 'login').length;
            const transactionCount = activities.filter(a => a.activityType === 'transaction').length;
            const supportTickets = activities.filter(a => a.activityType === 'support_ticket').length;
            const featureUsage = activities.filter(a => a.activityType === 'feature_usage').length;
            let healthScore = 0;
            healthScore += Math.min(25, loginCount * 2);
            healthScore += Math.min(30, transactionCount);
            healthScore += Math.min(25, featureUsage * 3);
            healthScore -= supportTickets * 5;
            if (subscription.status === 'active') {
                healthScore += 20;
            }
            healthScore = Math.max(0, Math.min(100, healthScore));
            const churnRiskScore = Math.max(0, (100 - healthScore) / 100);
            const upsellScore = Math.min(1, (healthScore - 70) / 30);
            await ClientHealthScore_1.ClientHealthScore.create({
                clientId,
                scoreDate: new Date(),
                healthScore,
                churnRiskScore,
                upsellScore: Math.max(0, upsellScore),
                factors: {
                    loginCount,
                    transactionCount,
                    supportTickets,
                    featureUsage,
                    subscriptionStatus: subscription.status
                }
            });
            return healthScore;
        }
        catch (error) {
            console.error('Error calculating health score:', error);
            throw error;
        }
    }
    static async getHealthScoreDistribution() {
        try {
            const latestScores = await ClientHealthScore_1.ClientHealthScore.aggregate([
                {
                    $sort: { clientId: 1, scoreDate: -1 }
                },
                {
                    $group: {
                        _id: '$clientId',
                        latestScore: { $first: '$healthScore' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        healthy: {
                            $sum: {
                                $cond: [{ $gte: ['$latestScore', 80] }, 1, 0]
                            }
                        },
                        warning: {
                            $sum: {
                                $cond: [
                                    { $and: [{ $gte: ['$latestScore', 60] }, { $lt: ['$latestScore', 80] }] },
                                    1,
                                    0
                                ]
                            }
                        },
                        critical: {
                            $sum: {
                                $cond: [{ $lt: ['$latestScore', 60] }, 1, 0]
                            }
                        }
                    }
                }
            ]);
            return latestScores[0] || { healthy: 0, warning: 0, critical: 0 };
        }
        catch (error) {
            console.error('Error getting health score distribution:', error);
            return { healthy: 0, warning: 0, critical: 0 };
        }
    }
    static async getCohortAnalysis() {
        try {
            const cohorts = await ClientCohort_1.ClientCohort.aggregate([
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'clientId',
                        foreignField: '_id',
                        as: 'client'
                    }
                },
                {
                    $unwind: '$client'
                },
                {
                    $group: {
                        _id: '$cohortMonth',
                        cohortSize: { $sum: 1 },
                        clients: { $push: '$client' }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);
            return cohorts.map(cohort => ({
                cohortMonth: cohort._id.toISOString().split('T')[0],
                cohortSize: cohort.cohortSize,
                retentionRates: [],
                currentRetention: 0.85
            }));
        }
        catch (error) {
            console.error('Error performing cohort analysis:', error);
            return [];
        }
    }
    static async getChurnAnalysis(startDate, endDate) {
        try {
            const churnEvents = await ChurnEvent_1.ChurnEvent.find({
                churnDate: { $gte: startDate, $lte: endDate }
            });
            const totalChurned = churnEvents.length;
            const avgDaysToChurn = totalChurned > 0
                ? churnEvents.reduce((sum, event) => sum + event.daysAsCustomer, 0) / totalChurned
                : 0;
            const mrrLost = churnEvents.reduce((sum, event) => sum + event.mrrLost, 0);
            const reasonCounts = {};
            churnEvents.forEach(event => {
                if (event.churnReason) {
                    reasonCounts[event.churnReason] = (reasonCounts[event.churnReason] || 0) + 1;
                }
            });
            const topChurnReasons = Object.entries(reasonCounts)
                .map(([reason, count]) => ({ reason, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            const totalCustomersAtStart = await Client_1.Client.countDocuments({
                signupDate: { $lt: startDate }
            });
            const churnRate = totalCustomersAtStart > 0 ? (totalChurned / totalCustomersAtStart) * 100 : 0;
            return {
                totalChurned,
                churnRate,
                avgDaysToChurn: Math.round(avgDaysToChurn),
                topChurnReasons,
                mrrLost
            };
        }
        catch (error) {
            console.error('Error performing churn analysis:', error);
            return {
                totalChurned: 0,
                churnRate: 0,
                avgDaysToChurn: 0,
                topChurnReasons: [],
                mrrLost: 0
            };
        }
    }
    static async createForecast(forecastType, predictedMrr, predictedArr, confidenceScore, modelVersion = '1.0') {
        try {
            const forecastDate = new Date();
            await RevenueForecast_1.RevenueForecast.create({
                forecastDate,
                forecastType,
                predictedMrr,
                predictedArr,
                confidenceScore,
                modelVersion
            });
        }
        catch (error) {
            console.error('Error creating forecast:', error);
            throw error;
        }
    }
    static async getForecastAccuracy() {
        try {
            const forecasts = await RevenueForecast_1.RevenueForecast.find({
                actualMrr: { $exists: true },
                actualArr: { $exists: true }
            });
            const accuracyByType = {};
            forecasts.forEach(forecast => {
                if (!accuracyByType[forecast.forecastType]) {
                    accuracyByType[forecast.forecastType] = { total: 0, accurate: 0, totalError: 0 };
                }
                const mrrError = Math.abs((forecast.predictedMrr - (forecast.actualMrr || 0)) / (forecast.actualMrr || 1));
                const isAccurate = mrrError < 0.1;
                accuracyByType[forecast.forecastType].total++;
                if (isAccurate) {
                    accuracyByType[forecast.forecastType].accurate++;
                }
                accuracyByType[forecast.forecastType].totalError += mrrError;
            });
            return Object.entries(accuracyByType).map(([forecastType, data]) => ({
                forecastType,
                accuracy: data.total > 0 ? (data.accurate / data.total) * 100 : 0,
                avgError: data.total > 0 ? (data.totalError / data.total) * 100 : 0
            }));
        }
        catch (error) {
            console.error('Error calculating forecast accuracy:', error);
            return [];
        }
    }
    static async initializeSampleData() {
        try {
            const existingActivities = await ClientActivity_1.ClientActivity.countDocuments();
            if (existingActivities > 0) {
                console.log('Advanced analytics data already initialized');
                return;
            }
            const clients = await Client_1.Client.find();
            for (const client of clients) {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                for (let i = 0; i < 15; i++) {
                    const randomDate = new Date(thirtyDaysAgo.getTime() + Math.random() * (Date.now() - thirtyDaysAgo.getTime()));
                    const activityTypes = ['login', 'transaction', 'feature_usage'];
                    const randomType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
                    await ClientActivity_1.ClientActivity.create({
                        clientId: client._id,
                        activityType: randomType,
                        activityData: { source: 'sample_data' },
                        activityDate: randomDate
                    });
                }
                await ClientCohort_1.ClientCohort.create({
                    clientId: client._id,
                    cohortMonth: new Date(client.signupDate.getFullYear(), client.signupDate.getMonth(), 1),
                    cohortSize: clients.length
                });
                await this.calculateClientHealthScore(client._id);
            }
            await this.createForecast('monthly', 350, 4200, 0.85);
            await this.createForecast('quarterly', 400, 4800, 0.80);
            console.log('Advanced analytics sample data initialized successfully');
        }
        catch (error) {
            console.error('Error initializing advanced analytics data:', error);
            throw error;
        }
    }
}
exports.AdvancedAnalyticsService = AdvancedAnalyticsService;
//# sourceMappingURL=AdvancedAnalyticsService.js.map