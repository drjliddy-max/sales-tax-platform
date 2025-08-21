import { POSAdapter, POSConfig, POSTransaction, POSWebhookData, ConnectionStatus, TestResult } from '../types/pos';

export interface CloverConfig extends POSConfig {
  merchantId: string;
  appId: string;
  appSecret: string;
  accessToken: string;
  environment: 'sandbox' | 'production';
  webhookUrl?: string;
}

export interface CloverTransaction {
  id: string;
  amount: number;
  currency: string;
  created: number;
  device: {
    id: string;
    name: string;
  };
  employee: {
    id: string;
    name: string;
  };
  lineItems: Array<{
    id: string;
    name: string;
    price: number;
    quantity?: number;
    taxRates: Array<{
      id: string;
      name: string;
      rate: number;
      taxAmount: number;
    }>;
  }>;
  modifications: Array<{
    id: string;
    name: string;
    amount: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    cardTransaction?: {
      type: string;
      last4: string;
      cardholderName: string;
    };
  }>;
  taxAmount: number;
  tipAmount?: number;
  state: 'OPEN' | 'LOCKED' | 'PAID';
  note?: string;
  orderType?: {
    id: string;
    labelKey: string;
  };
}

export interface CloverWebhookPayload {
  appId: string;
  merchantId: string;
  type: string;
  objectId: string;
  ts: number;
  verificationCode: string;
}

export class CloverAdapter implements POSAdapter {
  private config: CloverConfig;
  private baseUrl: string;

  constructor(config: CloverConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production' 
      ? 'https://api.clover.com/v3' 
      : 'https://apisandbox.dev.clover.com/v3';
  }

  async connect(): Promise<ConnectionStatus> {
    try {
      // Test connection by fetching merchant info
      const response = await this.makeRequest(`/merchants/${this.config.merchantId}`);
      
      if (response.id) {
        return {
          connected: true,
          lastSync: new Date(),
          error: null
        };
      }
      
      return {
        connected: false,
        lastSync: null,
        error: 'Invalid merchant configuration'
      };
    } catch (error) {
      return {
        connected: false,
        lastSync: null,
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }

  async disconnect(): Promise<void> {
    // Clover doesn't require explicit disconnection
    // Could revoke tokens here if needed
  }

  async testConnection(): Promise<TestResult> {
    const steps = [
      {
        name: 'API Authentication',
        status: 'pending' as const,
        message: 'Testing API credentials...'
      },
      {
        name: 'Merchant Access',
        status: 'pending' as const,
        message: 'Verifying merchant permissions...'
      },
      {
        name: 'Webhook Setup',
        status: 'pending' as const,
        message: 'Checking webhook configuration...'
      }
    ];

    try {
      // Test 1: API Authentication
      const merchantResponse = await this.makeRequest(`/merchants/${this.config.merchantId}`);
      steps[0].status = 'success';
      steps[0].message = 'API credentials validated';

      // Test 2: Merchant Access
      if (merchantResponse.id === this.config.merchantId) {
        steps[1].status = 'success';
        steps[1].message = 'Merchant access confirmed';
      } else {
        steps[1].status = 'error';
        steps[1].message = 'Merchant ID mismatch';
      }

      // Test 3: Webhook Setup
      if (this.config.webhookUrl) {
        try {
          const webhooks = await this.getWebhooks();
          const taxWebhook = webhooks.find((w: any) => 
            w.url === this.config.webhookUrl && w.eventTypes.includes('CREATE_ORDER')
          );
          
          if (taxWebhook) {
            steps[2].status = 'success';
            steps[2].message = 'Webhook configured correctly';
          } else {
            steps[2].status = 'warning';
            steps[2].message = 'Webhook not found - will create automatically';
          }
        } catch {
          steps[2].status = 'warning';
          steps[2].message = 'Could not verify webhook setup';
        }
      } else {
        steps[2].status = 'warning';
        steps[2].message = 'No webhook URL configured';
      }

      return {
        success: steps.every(step => step.status !== 'error'),
        steps,
        message: steps.every(step => step.status === 'success') 
          ? 'All tests passed successfully'
          : 'Connection established with some warnings'
      };
    } catch (error) {
      return {
        success: false,
        steps: steps.map(step => ({
          ...step,
          status: step.status === 'pending' ? 'error' as const : step.status,
          message: step.status === 'pending' ? 'Test failed' : step.message
        })),
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  async fetchTransactions(startDate?: Date, endDate?: Date): Promise<POSTransaction[]> {
    try {
      const params = new URLSearchParams();
      if (startDate) {
        params.append('filter', `modifiedTime>=${startDate.getTime()}`);
      }
      if (endDate) {
        params.append('filter', `modifiedTime<=${endDate.getTime()}`);
      }
      params.append('expand', 'lineItems,payments,taxRemoved');
      params.append('limit', '1000');

      const response = await this.makeRequest(
        `/merchants/${this.config.merchantId}/orders?${params.toString()}`
      );

      const orders = response.elements || [];
      return orders
        .filter((order: CloverTransaction) => order.state === 'PAID')
        .map((order: CloverTransaction) => this.transformTransaction(order));
    } catch (error) {
      console.error('Error fetching Clover transactions:', error);
      throw error;
    }
  }

  async setupWebhooks(): Promise<void> {
    if (!this.config.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    try {
      // Check if webhook already exists
      const existingWebhooks = await this.getWebhooks();
      const taxWebhook = existingWebhooks.find((w: any) => 
        w.url === this.config.webhookUrl
      );

      if (taxWebhook) {
        // Update existing webhook
        await this.makeRequest(
          `/merchants/${this.config.merchantId}/webhooks/${taxWebhook.id}`,
          'PUT',
          {
            url: this.config.webhookUrl,
            eventTypes: ['CREATE_ORDER', 'UPDATE_ORDER', 'DELETE_ORDER'],
            enabled: true
          }
        );
      } else {
        // Create new webhook
        await this.makeRequest(
          `/merchants/${this.config.merchantId}/webhooks`,
          'POST',
          {
            url: this.config.webhookUrl,
            eventTypes: ['CREATE_ORDER', 'UPDATE_ORDER', 'DELETE_ORDER'],
            enabled: true
          }
        );
      }
    } catch (error) {
      console.error('Error setting up Clover webhooks:', error);
      throw error;
    }
  }

  async handleWebhook(payload: CloverWebhookPayload): Promise<POSWebhookData | null> {
    try {
      // Verify webhook authenticity
      if (!this.verifyWebhook(payload)) {
        throw new Error('Invalid webhook signature');
      }

      // Only process order-related webhooks
      if (!payload.type.includes('ORDER')) {
        return null;
      }

      // Fetch the full order data
      const order = await this.makeRequest(
        `/merchants/${this.config.merchantId}/orders/${payload.objectId}?expand=lineItems,payments,taxRemoved`
      );

      if (!order || order.state !== 'PAID') {
        return null;
      }

      const transaction = this.transformTransaction(order);

      return {
        type: payload.type.includes('CREATE') ? 'transaction_created' : 'transaction_updated',
        transactionId: transaction.id,
        transaction,
        timestamp: new Date(payload.ts),
        metadata: {
          merchantId: payload.merchantId,
          webhookType: payload.type
        }
      };
    } catch (error) {
      console.error('Error handling Clover webhook:', error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Clover API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  private async getWebhooks() {
    return this.makeRequest(`/merchants/${this.config.merchantId}/webhooks`);
  }

  private transformTransaction(order: CloverTransaction): POSTransaction {
    const totalAmount = order.amount / 100; // Clover uses cents
    const taxAmount = order.taxAmount / 100;
    const tipAmount = (order.tipAmount || 0) / 100;

    return {
      id: order.id,
      externalId: order.id,
      amount: totalAmount,
      tax: taxAmount,
      tip: tipAmount,
      timestamp: new Date(order.created),
      posSystem: 'clover',
      location: order.device?.name || 'Unknown Location',
      employee: order.employee?.name || 'Unknown Employee',
      items: order.lineItems?.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price / 100,
        quantity: item.quantity || 1,
        taxAmount: item.taxRates?.reduce((sum, tax) => sum + tax.taxAmount, 0) / 100 || 0
      })) || [],
      paymentMethod: this.determinePaymentMethod(order.payments),
      status: order.state === 'PAID' ? 'completed' : 'pending',
      metadata: {
        orderId: order.id,
        deviceId: order.device?.id,
        employeeId: order.employee?.id,
        orderType: order.orderType?.labelKey,
        modifications: order.modifications,
        note: order.note
      }
    };
  }

  private determinePaymentMethod(payments: CloverTransaction['payments']): string {
    if (!payments || payments.length === 0) {
      return 'unknown';
    }

    const payment = payments[0];
    if (payment.cardTransaction) {
      return 'card';
    }

    return 'other';
  }

  private verifyWebhook(payload: CloverWebhookPayload): boolean {
    // In a real implementation, verify the webhook signature
    // using the app secret and verification code
    return payload.appId === this.config.appId;
  }

  getConfig(): CloverConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<CloverConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.baseUrl = this.config.environment === 'production' 
      ? 'https://api.clover.com/v3' 
      : 'https://apisandbox.dev.clover.com/v3';
  }

  async getTransactionById(id: string): Promise<POSTransaction | null> {
    try {
      const order = await this.makeRequest(
        `/merchants/${this.config.merchantId}/orders/${id}?expand=lineItems,payments,taxRemoved`
      );
      
      if (!order) {
        return null;
      }

      return this.transformTransaction(order);
    } catch (error) {
      console.error('Error fetching Clover transaction:', error);
      return null;
    }
  }

  async syncTransactions(lastSyncDate?: Date): Promise<{ count: number; errors: string[] }> {
    const errors: string[] = [];
    let count = 0;

    try {
      const transactions = await this.fetchTransactions(lastSyncDate);
      count = transactions.length;

      // In a real implementation, save transactions to database
      console.log(`Synced ${count} Clover transactions`);

      return { count, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      return { count, errors };
    }
  }
}
