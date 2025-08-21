"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevenueService = void 0;
const RevenueStream_1 = require("../models/RevenueStream");
const ClientTier_1 = require("../models/ClientTier");
const Client_1 = require("../models/Client");
const ClientSubscription_1 = require("../models/ClientSubscription");
const RevenueTransaction_1 = require("../models/RevenueTransaction");
class RevenueService {
    static async initializeSampleData() {
        try {
            const existingStreams = await RevenueStream_1.RevenueStream.countDocuments();
            if (existingStreams > 0) {
                console.log('Revenue data already initialized');
                return;
            }
            const revenueStreams = await RevenueStream_1.RevenueStream.insertMany([
                {
                    name: 'Monthly Subscription',
                    category: 'subscription',
                    description: 'Monthly recurring subscription fees',
                    isRecurring: true,
                    isActive: true
                },
                {
                    name: 'Annual Subscription',
                    category: 'subscription',
                    description: 'Annual recurring subscription fees',
                    isRecurring: true,
                    isActive: true
                },
                {
                    name: 'Setup Fee',
                    category: 'onetime',
                    description: 'One-time setup and onboarding fee',
                    isRecurring: false,
                    isActive: true
                },
                {
                    name: 'Transaction Overage',
                    category: 'transaction',
                    description: 'Charges for exceeding transaction limits',
                    isRecurring: false,
                    isActive: true
                },
                {
                    name: 'Premium Support',
                    category: 'service',
                    description: 'Additional premium support services',
                    isRecurring: false,
                    isActive: true
                }
            ]);
            const clientTiers = await ClientTier_1.ClientTier.insertMany([
                {
                    name: 'Starter',
                    monthlyPrice: 29.00,
                    annualPrice: 290.00,
                    transactionLimit: 500,
                    features: {
                        features: ['Basic reporting', 'Email support', 'Up to 500 transactions']
                    },
                    isActive: true
                },
                {
                    name: 'Professional',
                    monthlyPrice: 79.00,
                    annualPrice: 790.00,
                    transactionLimit: 2500,
                    features: {
                        features: ['Advanced reporting', 'Priority support', 'Up to 2500 transactions', 'API access']
                    },
                    isActive: true
                },
                {
                    name: 'Enterprise',
                    monthlyPrice: 149.00,
                    annualPrice: 1490.00,
                    transactionLimit: 10000,
                    features: {
                        features: ['Custom reporting', 'Dedicated support', 'Up to 10000 transactions', 'API access', 'Custom integrations']
                    },
                    isActive: true
                },
                {
                    name: 'Trial',
                    monthlyPrice: 0.00,
                    annualPrice: 0.00,
                    transactionLimit: 100,
                    features: {
                        features: ['Basic reporting', 'Email support', 'Up to 100 transactions', '30-day trial']
                    },
                    isActive: true
                }
            ]);
            const professionalTier = clientTiers.find(t => t.name === 'Professional');
            const starterTier = clientTiers.find(t => t.name === 'Starter');
            const enterpriseTier = clientTiers.find(t => t.name === 'Enterprise');
            const clients = await Client_1.Client.insertMany([
                {
                    name: 'Demo Restaurant LLC',
                    email: 'demo@restaurant.com',
                    currentTierId: professionalTier?._id,
                    status: 'active',
                    signupDate: new Date('2023-12-15')
                },
                {
                    name: 'Sample Retail Store',
                    email: 'owner@retailstore.com',
                    currentTierId: starterTier?._id,
                    status: 'active',
                    signupDate: new Date('2024-01-10')
                },
                {
                    name: 'Tech Startup Inc',
                    email: 'admin@techstartup.com',
                    currentTierId: enterpriseTier?._id,
                    status: 'active',
                    signupDate: new Date('2023-11-20')
                },
                {
                    name: 'Local Coffee Shop',
                    email: 'manager@coffeeshop.com',
                    currentTierId: professionalTier?._id,
                    status: 'active',
                    signupDate: new Date('2024-01-08')
                }
            ]);
            const subscriptions = [];
            for (const client of clients) {
                const tier = clientTiers.find(t => t._id.equals(client.currentTierId));
                if (tier) {
                    subscriptions.push({
                        clientId: client._id,
                        tierId: tier._id,
                        startDate: client.signupDate,
                        billingCycle: 'monthly',
                        status: 'active',
                        mrr: tier.monthlyPrice,
                        arr: tier.annualPrice
                    });
                }
            }
            const createdSubscriptions = await ClientSubscription_1.ClientSubscription.insertMany(subscriptions);
            const monthlyStream = revenueStreams.find(s => s.name === 'Monthly Subscription');
            const setupStream = revenueStreams.find(s => s.name === 'Setup Fee');
            const overageStream = revenueStreams.find(s => s.name === 'Transaction Overage');
            const revenueTransactions = [];
            for (const subscription of createdSubscriptions) {
                revenueTransactions.push({
                    clientId: subscription.clientId,
                    revenueStreamId: monthlyStream._id,
                    subscriptionId: subscription._id,
                    transactionDate: new Date('2024-01-15'),
                    amount: subscription.mrr,
                    currency: 'USD',
                    taxAmount: 0,
                    netAmount: subscription.mrr,
                    billingPeriodStart: new Date('2024-01-01'),
                    billingPeriodEnd: new Date('2024-01-31'),
                    paymentMethod: 'credit_card',
                    status: 'completed',
                    description: 'Monthly subscription payment'
                });
            }
            const coffeeShop = clients.find(c => c.email === 'manager@coffeeshop.com');
            const restaurant = clients.find(c => c.email === 'demo@restaurant.com');
            if (coffeeShop && setupStream) {
                revenueTransactions.push({
                    clientId: coffeeShop._id,
                    revenueStreamId: setupStream._id,
                    transactionDate: new Date('2024-01-10'),
                    amount: 199.00,
                    currency: 'USD',
                    taxAmount: 0,
                    netAmount: 199.00,
                    paymentMethod: 'credit_card',
                    status: 'completed',
                    description: 'Setup and onboarding fee'
                });
            }
            if (restaurant && overageStream) {
                revenueTransactions.push({
                    clientId: restaurant._id,
                    revenueStreamId: overageStream._id,
                    transactionDate: new Date('2024-01-12'),
                    amount: 89.00,
                    currency: 'USD',
                    taxAmount: 0,
                    netAmount: 89.00,
                    paymentMethod: 'credit_card',
                    status: 'completed',
                    description: 'Additional transaction processing charges'
                });
            }
            await RevenueTransaction_1.RevenueTransaction.insertMany(revenueTransactions);
            console.log('Sample revenue data initialized successfully');
        }
        catch (error) {
            console.error('Error initializing sample revenue data:', error);
            throw error;
        }
    }
    static async getAdminRevenueTransactions() {
        try {
            const transactions = await RevenueTransaction_1.RevenueTransaction.find()
                .populate('clientId', 'name email')
                .populate('revenueStreamId', 'name category')
                .sort({ transactionDate: -1 })
                .limit(50);
            return transactions.map(transaction => ({
                id: transaction._id,
                businessId: 'master_admin',
                date: transaction.transactionDate.toISOString().split('T')[0],
                amount: transaction.amount,
                tax: transaction.taxAmount,
                status: transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1),
                customer: transaction.clientId.name,
                items: [transaction.description || transaction.revenueStreamId.name],
                transactionType: transaction.revenueStreamId.category,
                clientId: transaction.clientId,
                paymentMethod: transaction.paymentMethod
            }));
        }
        catch (error) {
            console.error('Error fetching admin revenue transactions:', error);
            return [];
        }
    }
    static async getRevenueMetrics() {
        try {
            const [mrrResult, clientCount, subscriptionCount] = await Promise.all([
                ClientSubscription_1.ClientSubscription.aggregate([
                    { $match: { status: 'active' } },
                    { $group: { _id: null, totalMRR: { $sum: '$mrr' } } }
                ]),
                Client_1.Client.countDocuments({ status: 'active' }),
                ClientSubscription_1.ClientSubscription.countDocuments({ status: 'active' })
            ]);
            const mrr = mrrResult[0]?.totalMRR || 0;
            const arr = mrr * 12;
            return {
                mrr,
                arr,
                totalClients: clientCount,
                activeSubscriptions: subscriptionCount
            };
        }
        catch (error) {
            console.error('Error calculating revenue metrics:', error);
            return { mrr: 0, arr: 0, totalClients: 0, activeSubscriptions: 0 };
        }
    }
}
exports.RevenueService = RevenueService;
//# sourceMappingURL=RevenueService.js.map