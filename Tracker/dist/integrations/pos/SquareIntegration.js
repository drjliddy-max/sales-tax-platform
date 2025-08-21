"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareIntegration = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("@/config");
const models_1 = require("@/models");
const tax_calculation_1 = require("@/services/tax-calculation");
class SquareIntegration {
    constructor() {
        this.baseUrl = config_1.config.integrations.square.environment === 'production'
            ? 'https://connect.squareup.com'
            : 'https://connect.squareupsandbox.com';
        this.accessToken = config_1.config.integrations.square.accessToken;
        this.taxCalculator = new tax_calculation_1.TaxCalculator();
    }
    async syncPayments(locationId, startDate, endDate) {
        const url = `${this.baseUrl}/v2/payments`;
        const params = {
            location_id: locationId,
            sort_order: 'DESC'
        };
        if (startDate) {
            params.begin_time = startDate.toISOString();
        }
        if (endDate) {
            params.end_time = endDate.toISOString();
        }
        try {
            const response = await axios_1.default.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                params
            });
            const payments = response.data.payments || [];
            for (const payment of payments) {
                await this.processPayment(payment);
            }
        }
        catch (error) {
            console.error('Error syncing Square payments:', error);
            throw error;
        }
    }
    async processPayment(payment) {
        const existingTransaction = await models_1.Transaction.findOne({
            source: 'square',
            sourceTransactionId: payment.id
        });
        if (existingTransaction) {
            return;
        }
        const orderDetails = await this.getOrderDetails(payment.id);
        const transaction = new models_1.Transaction({
            transactionId: `square_${payment.id}`,
            source: 'square',
            sourceTransactionId: payment.id,
            businessId: 'default',
            locationId: payment.location_id,
            timestamp: new Date(payment.created_at),
            subtotal: payment.amount_money.amount / 100,
            totalTax: 0,
            grandTotal: payment.amount_money.amount / 100,
            currency: payment.amount_money.currency,
            items: orderDetails?.items || [],
            taxBreakdown: [],
            address: orderDetails?.address || {
                street: '',
                city: '',
                state: '',
                zipCode: '',
                country: 'US'
            },
            status: this.mapSquareStatus(payment.status),
            metadata: {
                receiptNumber: payment.receipt_number,
                receiptUrl: payment.receipt_url,
                originalPayment: payment
            }
        });
        await transaction.save();
    }
    async getOrderDetails(paymentId) {
        return {
            items: [],
            address: {
                street: '',
                city: '',
                state: '',
                zipCode: '',
                country: 'US'
            }
        };
    }
    mapSquareStatus(squareStatus) {
        switch (squareStatus.toUpperCase()) {
            case 'COMPLETED':
                return 'completed';
            case 'PENDING':
                return 'pending';
            case 'FAILED':
                return 'failed';
            case 'CANCELED':
                return 'failed';
            default:
                return 'pending';
        }
    }
    async testConnection() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/v2/locations`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.status === 200;
        }
        catch (error) {
            console.error('Square connection test failed:', error);
            return false;
        }
    }
}
exports.SquareIntegration = SquareIntegration;
//# sourceMappingURL=SquareIntegration.js.map