import mongoose from 'mongoose';
import { ClientActivity } from '../models/ClientActivity';
import { ClientCohort } from '../models/ClientCohort';
import { RevenueForecast } from '../models/RevenueForecast';
import { ClientHealthScore } from '../models/ClientHealthScore';
import { ChurnEvent } from '../models/ChurnEvent';
import { Client } from '../models/Client';
import { ClientSubscription } from '../models/ClientSubscription';

export interface CohortAnalysis {
  cohortMonth: string;
  cohortSize: number;
  retentionRates: number[];
  currentRetention: number;
}

export interface HealthScoreDistribution {
  healthy: number; // 80-100
  warning: number; // 60-79
  critical: number; // 0-59
}

export interface ChurnAnalysis {
  totalChurned: number;
  churnRate: number;
  avgDaysToChurn: number;
  topChurnReasons: Array<{ reason: string; count: number }>;
  mrrLost: number;
}

export interface ForecastAccuracy {
  forecastType: string;
  accuracy: number;
  avgError: number;
}

export class AdvancedAnalyticsService {
  
  /**
   * Track client activity for health scoring
   */
  static async logActivity(
    clientId: mongoose.Types.ObjectId,
    activityType: 'login' | 'transaction' | 'support_ticket' | 'feature_usage',
    activityData: Record<string, any> = {}
  ): Promise<void> {
    try {
      await ClientActivity.create({
        clientId,
        activityType,
        activityData,
        activityDate: new Date()
      });
    } catch (error) {
      console.error('Error logging client activity:', error);
      throw error;
    }
  }

  /**
   * Calculate and update client health scores
   */
  static async calculateClientHealthScore(clientId: mongoose.Types.ObjectId): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get recent activities
      const activities = await ClientActivity.find({
        clientId,
        activityDate: { $gte: thirtyDaysAgo }
      });

      // Get client subscription info
      const subscription = await ClientSubscription.findOne({
        clientId,
        status: 'active'
      }).populate('tierId');

      if (!subscription) {
        return 0; // No active subscription = 0 health score
      }

      // Calculate health factors
      const loginCount = activities.filter(a => a.activityType === 'login').length;
      const transactionCount = activities.filter(a => a.activityType === 'transaction').length;
      const supportTickets = activities.filter(a => a.activityType === 'support_ticket').length;
      const featureUsage = activities.filter(a => a.activityType === 'feature_usage').length;

      // Health scoring algorithm
      let healthScore = 0;

      // Login frequency (25 points max)
      healthScore += Math.min(25, loginCount * 2);

      // Transaction activity (30 points max)
      healthScore += Math.min(30, transactionCount);

      // Feature engagement (25 points max)
      healthScore += Math.min(25, featureUsage * 3);

      // Support burden (negative points)
      healthScore -= supportTickets * 5;

      // Subscription status bonus (20 points)
      if (subscription.status === 'active') {
        healthScore += 20;
      }

      // Ensure score is between 0-100
      healthScore = Math.max(0, Math.min(100, healthScore));

      // Calculate risk scores
      const churnRiskScore = Math.max(0, (100 - healthScore) / 100);
      const upsellScore = Math.min(1, (healthScore - 70) / 30);

      // Save health score
      await ClientHealthScore.create({
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
    } catch (error) {
      console.error('Error calculating health score:', error);
      throw error;
    }
  }

  /**
   * Get health score distribution across all clients
   */
  static async getHealthScoreDistribution(): Promise<HealthScoreDistribution> {
    try {
      const latestScores = await ClientHealthScore.aggregate([
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
    } catch (error) {
      console.error('Error getting health score distribution:', error);
      return { healthy: 0, warning: 0, critical: 0 };
    }
  }

  /**
   * Perform cohort analysis
   */
  static async getCohortAnalysis(): Promise<CohortAnalysis[]> {
    try {
      const cohorts = await ClientCohort.aggregate([
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
        retentionRates: [], // Would need to calculate based on active subscriptions over time
        currentRetention: 0.85 // Placeholder - would calculate actual retention
      }));
    } catch (error) {
      console.error('Error performing cohort analysis:', error);
      return [];
    }
  }

  /**
   * Get churn analysis
   */
  static async getChurnAnalysis(startDate: Date, endDate: Date): Promise<ChurnAnalysis> {
    try {
      const churnEvents = await ChurnEvent.find({
        churnDate: { $gte: startDate, $lte: endDate }
      });

      const totalChurned = churnEvents.length;
      const avgDaysToChurn = totalChurned > 0 
        ? churnEvents.reduce((sum, event) => sum + event.daysAsCustomer, 0) / totalChurned
        : 0;

      const mrrLost = churnEvents.reduce((sum, event) => sum + event.mrrLost, 0);

      // Calculate churn reasons
      const reasonCounts: { [key: string]: number } = {};
      churnEvents.forEach(event => {
        if (event.churnReason) {
          reasonCounts[event.churnReason] = (reasonCounts[event.churnReason] || 0) + 1;
        }
      });

      const topChurnReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Calculate churn rate (would need total customer base at start of period)
      const totalCustomersAtStart = await Client.countDocuments({
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
    } catch (error) {
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

  /**
   * Create revenue forecast
   */
  static async createForecast(
    forecastType: 'monthly' | 'quarterly' | 'annual',
    predictedMrr: number,
    predictedArr: number,
    confidenceScore: number,
    modelVersion: string = '1.0'
  ): Promise<void> {
    try {
      const forecastDate = new Date();
      
      await RevenueForecast.create({
        forecastDate,
        forecastType,
        predictedMrr,
        predictedArr,
        confidenceScore,
        modelVersion
      });
    } catch (error) {
      console.error('Error creating forecast:', error);
      throw error;
    }
  }

  /**
   * Get forecast accuracy
   */
  static async getForecastAccuracy(): Promise<ForecastAccuracy[]> {
    try {
      const forecasts = await RevenueForecast.find({
        actualMrr: { $exists: true },
        actualArr: { $exists: true }
      });

      const accuracyByType: { [key: string]: { total: number; accurate: number; totalError: number } } = {};

      forecasts.forEach(forecast => {
        if (!accuracyByType[forecast.forecastType]) {
          accuracyByType[forecast.forecastType] = { total: 0, accurate: 0, totalError: 0 };
        }

        const mrrError = Math.abs((forecast.predictedMrr - (forecast.actualMrr || 0)) / (forecast.actualMrr || 1));
        const isAccurate = mrrError < 0.1; // Within 10%

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
    } catch (error) {
      console.error('Error calculating forecast accuracy:', error);
      return [];
    }
  }

  /**
   * Initialize sample advanced analytics data
   */
  static async initializeSampleData(): Promise<void> {
    try {
      // Check if data already exists
      const existingActivities = await ClientActivity.countDocuments();
      if (existingActivities > 0) {
        console.log('Advanced analytics data already initialized');
        return;
      }

      // Get existing clients
      const clients = await Client.find();
      
      // Create sample activities for each client
      for (const client of clients) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Generate random activities over the past 30 days
        for (let i = 0; i < 15; i++) {
          const randomDate = new Date(thirtyDaysAgo.getTime() + Math.random() * (Date.now() - thirtyDaysAgo.getTime()));
          const activityTypes: Array<'login' | 'transaction' | 'support_ticket' | 'feature_usage'> = ['login', 'transaction', 'feature_usage'];
          const randomType = activityTypes[Math.floor(Math.random() * activityTypes.length)];

          await ClientActivity.create({
            clientId: client._id,
            activityType: randomType,
            activityData: { source: 'sample_data' },
            activityDate: randomDate
          });
        }

        // Create cohort entry
        await ClientCohort.create({
          clientId: client._id,
          cohortMonth: new Date(client.signupDate.getFullYear(), client.signupDate.getMonth(), 1),
          cohortSize: clients.length
        });

        // Calculate initial health score
        await this.calculateClientHealthScore(client._id);
      }

      // Create sample forecasts
      await this.createForecast('monthly', 350, 4200, 0.85);
      await this.createForecast('quarterly', 400, 4800, 0.80);

      console.log('Advanced analytics sample data initialized successfully');
    } catch (error) {
      console.error('Error initializing advanced analytics data:', error);
      throw error;
    }
  }
}