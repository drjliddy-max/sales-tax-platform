import axios from 'axios';
import { config } from '@/config';
import { Transaction } from '@/models';
import { TaxCalculator } from '@/services/tax-calculation';

export interface SquarePayment {
  id: string;
  amount_money: {
    amount: number;
    currency: string;
  };
  status: string;
  source_type: string;
  location_id: string;
  created_at: string;
  updated_at: string;
  receipt_number?: string;
  receipt_url?: string;
}

export class SquareIntegration {
  private baseUrl: string;
  private accessToken: string;
  private taxCalculator: TaxCalculator;

  constructor() {
    this.baseUrl = config.integrations.square.environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    this.accessToken = config.integrations.square.accessToken!;
    this.taxCalculator = new TaxCalculator();
  }

  async syncPayments(locationId: string, startDate?: Date, endDate?: Date): Promise<void> {
    const url = `${this.baseUrl}/v2/payments`;
    const params: any = {
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
      const response = await axios.get(url, {
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
    } catch (error) {
      console.error('Error syncing Square payments:', error);
      throw error;
    }
  }

  private async processPayment(payment: SquarePayment): Promise<void> {
    // Check if transaction already exists
    const existingTransaction = await Transaction.findOne({
      source: 'square',
      sourceTransactionId: payment.id
    });

    if (existingTransaction) {
      return; // Skip if already processed
    }

    // Get order details if available
    const orderDetails = await this.getOrderDetails(payment.id);
    
    // Create transaction record
    const transaction = new Transaction({
      transactionId: `square_${payment.id}`,
      source: 'square',
      sourceTransactionId: payment.id,
      businessId: 'default', // This would come from business configuration
      locationId: payment.location_id,
      timestamp: new Date(payment.created_at),
      subtotal: payment.amount_money.amount / 100, // Square uses cents
      totalTax: 0, // Will be calculated
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

  private async getOrderDetails(paymentId: string): Promise<any> {
    // This would fetch order details from Square API
    // Simplified for now
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

  private mapSquareStatus(squareStatus: string): string {
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

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/v2/locations`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.status === 200;
    } catch (error) {
      console.error('Square connection test failed:', error);
      return false;
    }
  }
}