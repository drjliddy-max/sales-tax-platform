import mongoose from 'mongoose';
import { RevenueAnalyticsService } from './RevenueAnalyticsService';
import { Client } from '../models/Client';
import { ClientSubscription } from '../models/ClientSubscription';
import { ClientTier } from '../models/ClientTier';
import { RevenueTransaction } from '../models/RevenueTransaction';
import { RevenueStream } from '../models/RevenueStream';
import { ClientActivity } from '../models/ClientActivity';
import { ClientHealthScore } from '../models/ClientHealthScore';
import { ChurnEvent } from '../models/ChurnEvent';

export interface CohortData {
  cohort_month: string;
  cohort_size: number;
  initial_mrr: number;
  months: {
    [monthNumber: number]: {
      active_clients: number;
      period_mrr: number;
      retention_rate: number;
      revenue_retention_rate: number;
    };
  };
}

export interface ChurnMetrics {
  churn_by_month: Array<{
    churn_month: Date;
    churned_customers: number;
    mrr_lost: number;
    avg_customer_lifetime: number;
  }>;
  active_by_month: Array<{
    month: Date;
    active_customers: number;
  }>;
  overall_churn_rate: number;
}

export interface HealthScoreResult {
  health_score: number;
  churn_risk_score: number;
  upsell_score: number;
  factors: {
    payment_reliability: number;
    activity_level: number;
    tenure_months: number;
    pricing_fit: number;
    support_tickets: number;
  };
}

export interface ForecastResult {
  historical_data: Array<{
    month: Date;
    monthly_subscription_revenue: number;
    active_clients: number;
  }>;
  forecasts: Array<{
    month: string;
    predicted_mrr: number;
    predicted_arr: number;
    confidence_score: number;
  }>;
  trend: {
    slope: number;
    growth_rate: number;
  };
}

export interface TopClientHealth {
  client_name: string;
  email: string;
  tier_name: string;
  mrr: number;
  health_score: number;
  churn_risk_score: number;
  upsell_score: number;
  score_date: Date;
}

export class EnhancedAnalyticsService extends RevenueAnalyticsService {
  
  /**
   * Cohort Analysis - Track revenue retention by signup month
   */
  static async getCohortAnalysis(months: number = 12): Promise<CohortData[]> {
    try {
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - months);

      // Get cohort data using MongoDB aggregation
      const cohortData = await Client.aggregate([
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
    } catch (error) {
      console.error('Error performing cohort analysis:', error);
      return [];
    }
  }

  private static formatCohortData(cohortData: any[]): CohortData[] {
    const result: CohortData[] = [];
    
    cohortData.forEach(cohort => {
      const cohortMonth = cohort._id.toISOString().slice(0, 7);
      const cohortInfo: CohortData = {
        cohort_month: cohortMonth,
        cohort_size: cohort.cohortSize,
        initial_mrr: 0,
        months: {}
      };

      // Calculate initial MRR and monthly data
      let initialMrr = 0;
      const monthlyData: { [key: number]: any } = {};

      cohort.clients.forEach((client: any) => {
        client.subscriptions.forEach((sub: any) => {
          if (sub.status === 'active') {
            initialMrr += sub.mrr || 0;
          }
        });

        client.revenueTransactions.forEach((transaction: any) => {
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

      // Convert monthly data to proper format
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

  private static getMonthDifference(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  }

  /**
   * Calculate churn rate and predict future churn
   */
  static async calculateChurnMetrics(startDate: Date, endDate: Date): Promise<ChurnMetrics> {
    try {
      // Get churn events
      const churnEvents = await ChurnEvent.aggregate([
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

      // Get active customers by month
      const activeCustomers = await ClientSubscription.aggregate([
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
    } catch (error) {
      console.error('Error calculating churn metrics:', error);
      return {
        churn_by_month: [],
        active_by_month: [],
        overall_churn_rate: 0
      };
    }
  }

  private static calculateOverallChurnRate(churnData: any[], activeData: any[]): number {
    const totalChurned = churnData.reduce((sum, row) => sum + row.churned_customers, 0);
    const avgActive = activeData.reduce((sum, row) => sum + row.active_customers, 0) / (activeData.length || 1);
    return avgActive > 0 ? (totalChurned / avgActive) * 100 : 0;
  }

  /**
   * Client Health Scoring Algorithm
   */
  static async calculateClientHealthScore(clientId: mongoose.Types.ObjectId): Promise<HealthScoreResult> {
    try {
      // Get client with subscription data
      const client = await Client.findById(clientId).populate({
        path: 'currentTierId',
        model: 'ClientTier'
      });

      if (!client) {
        throw new Error('Client not found');
      }

      const subscription = await ClientSubscription.findOne({
        clientId: clientId,
        status: 'active'
      }).populate('tierId');

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Get recent activities (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const activities = await ClientActivity.aggregate([
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

      // Get payment history (last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const paymentHistory = await RevenueTransaction.aggregate([
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
    } catch (error) {
      console.error('Error calculating client health score:', error);
      throw error;
    }
  }

  private static computeHealthScore(
    client: any,
    subscription: any,
    activities: any[],
    payments: any
  ): HealthScoreResult {
    let score = 50; // Base score
    const factors: any = {};

    // Factor 1: Payment reliability (30% weight)
    const paymentReliability = payments.total_payments > 0 
      ? (payments.total_payments - payments.failed_payments) / payments.total_payments 
      : 0;
    const paymentScore = paymentReliability * 30;
    score += paymentScore;
    factors.payment_reliability = paymentReliability;

    // Factor 2: Activity level (25% weight)
    const loginActivity = activities.find(a => a._id === 'login');
    const recentLogins = loginActivity ? loginActivity.activity_count : 0;
    const activityScore = Math.min(recentLogins / 10, 1) * 25;
    score += activityScore;
    factors.activity_level = recentLogins;

    // Factor 3: Tenure (15% weight)
    const daysAsCustomer = Math.floor((Date.now() - client.signupDate.getTime()) / (1000 * 60 * 60 * 24));
    const tenureMonths = daysAsCustomer / 30;
    const tenureScore = Math.min(tenureMonths / 12, 1) * 15;
    score += tenureScore;
    factors.tenure_months = tenureMonths;

    // Factor 4: MRR vs Tier Price (10% weight)
    const tierPrice = (subscription.tierId as any).monthlyPrice || 0;
    const pricingFit = tierPrice > 0 ? subscription.mrr / tierPrice : 1;
    const pricingScore = Math.min(pricingFit, 1) * 10;
    score += pricingScore;
    factors.pricing_fit = pricingFit;

    // Factor 5: Support ticket frequency (negative factor)
    const supportActivity = activities.find(a => a._id === 'support_ticket');
    const supportTickets = supportActivity ? supportActivity.activity_count : 0;
    const supportPenalty = Math.min(supportTickets * 2, 20);
    score -= supportPenalty;
    factors.support_tickets = supportTickets;

    // Calculate churn risk (inverse of health score)
    const churnRisk = Math.max(0, (100 - score) / 100);
    
    // Calculate upsell potential
    const upsellScore = this.calculateUpsellPotential(activities, payments);

    return {
      health_score: Math.max(0, Math.min(100, Math.round(score))),
      churn_risk_score: Math.round(churnRisk * 100) / 100,
      upsell_score: upsellScore,
      factors
    };
  }

  private static calculateUpsellPotential(activities: any[], payments: any): number {
    let upsellScore = 0.1; // Base upsell potential

    // High activity suggests engagement
    const loginActivity = activities.find(a => a._id === 'login');
    if (loginActivity && loginActivity.activity_count > 15) {
      upsellScore += 0.3;
    }

    // High usage suggests need for more features
    const usageActivity = activities.find(a => a._id === 'feature_usage');
    if (usageActivity && usageActivity.activity_count > 50) {
      upsellScore += 0.4;
    }

    // Consistent payments suggest financial stability
    if (payments.total_payments > 6 && payments.failed_payments === 0) {
      upsellScore += 0.2;
    }

    return Math.min(1, upsellScore);
  }

  /**
   * Revenue Forecasting using linear regression
   */
  static async generateRevenueForecast(months: number = 6): Promise<ForecastResult> {
    try {
      // Get historical MRR data for the last 24 months
      const twentyFourMonthsAgo = new Date();
      twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

      const historicalData = await RevenueTransaction.aggregate([
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
    } catch (error) {
      console.error('Error generating revenue forecast:', error);
      throw error;
    }
  }

  private static computeForecast(historicalData: any[], months: number): ForecastResult {
    // Simple linear regression for MRR growth
    const n = historicalData.length;
    const x = historicalData.map((_, i) => i);
    const y = historicalData.map(d => d.monthly_subscription_revenue);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate forecasts
    const forecasts = [];
    const lastMonth = new Date(historicalData[n - 1].month);
    
    for (let i = 1; i <= months; i++) {
      const forecastMonth = new Date(lastMonth);
      forecastMonth.setMonth(forecastMonth.getMonth() + i);
      
      const forecastValue = intercept + slope * (n + i - 1);
      const confidence = Math.max(0.5, 1 - (i * 0.1)); // Confidence decreases over time

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

  /**
   * Get top clients health scores
   */
  static async getTopClientsHealthScores(limit: number = 10): Promise<TopClientHealth[]> {
    try {
      const result = await ClientHealthScore.aggregate([
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
    } catch (error) {
      console.error('Error getting top clients health scores:', error);
      return [];
    }
  }

  /**
   * Advanced Revenue Analytics Dashboard Data
   */
  static async getAdvancedDashboardData(startDate: Date, endDate: Date) {
    try {
      const [
        cohortAnalysis,
        churnMetrics,
        topClientsHealth,
        revenueForecast
      ] = await Promise.all([
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
    } catch (error) {
      console.error('Error getting advanced dashboard data:', error);
      throw error;
    }
  }
}