import { POSAdapter, POSConfig, POSTransaction, POSWebhookData, ConnectionStatus, TestResult } from '../types/pos';

export interface ToastConfig extends POSConfig {
  restaurantId: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
  webhookUrl?: string;
}

export interface ToastOrder {
  guid: string;
  externalId?: string;
  restaurantGuid: string;
  source: string;
  createdDate: string;
  modifiedDate: string;
  paidDate?: string;
  closedDate?: string;
  deletedDate?: string;
  deleted: boolean;
  businessDate: number;
  revenueCenterGuid: string;
  orderNumber: string;
  table?: {
    guid: string;
    entityType: string;
    name: string;
  };
  serviceArea?: {
    guid: string;
    entityType: string;
    name: string;
  };
  checks: Array<{
    guid: string;
    entityType: string;
    displayNumber: string;
    openedDate: string;
    closedDate?: string;
    deletedDate?: string;
    deleted: boolean;
    selections: Array<{
      guid: string;
      entityType: string;
      externalId?: string;
      item: {
        guid: string;
        name: string;
        price: number;
      };
      quantity: number;
      unitPrice: number;
      basePrice: number;
      price: number;
      tax: number;
      modifiers?: Array<{
        guid: string;
        name: string;
        price: number;
      }>;
      appliedDiscounts?: Array<{
        guid: string;
        name: string;
        amount: number;
      }>;
    }>;
    customer?: {
      guid: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
    };
    payments: Array<{
      guid: string;
      externalId?: string;
      paidDate: string;
      type: string;
      amount: number;
      tipAmount?: number;
      cardEntryMode?: string;
      last4?: string;
      paymentStatus: string;
    }>;
    appliedDiscounts?: Array<{
      guid: string;
      name: string;
      amount: number;
    }>;
    taxAmount: number;
    totalAmount: number;
    paymentStatus: string;
  }>;
  voided: boolean;
  voidDate?: string;
  voidBusinessDate?: number;
  numberOfGuests?: number;
  createdDevice?: {
    id: string;
    name: string;
  };
  approvalStatus: string;
  curbsidePickupInfo?: any;
  deliveryInfo?: any;
  marketingSourceId?: string;
  estimatedFulfillmentDate?: string;
  fulfillmentDate?: string;
}

export interface ToastWebhookPayload {
  eventType: string;
  guid: string;
  entityType: string;
  restaurantGuid: string;
  timestamp: string;
  data?: any;
}

export class ToastAdapter implements POSAdapter {
  private config: ToastConfig;
  private baseUrl: string;

  constructor(config: ToastConfig) {
    this.config = config;
    this.baseUrl = config.environment === 'production' 
      ? 'https://ws-api.toasttab.com' 
      : 'https://ws-sandbox-api.toasttab.com';
  }

  async connect(): Promise<ConnectionStatus> {
    try {
      // Test connection by fetching restaurant info
      const response = await this.makeRequest('/config/v1/restaurants');
      
      if (response && response.length > 0) {
        return {
          connected: true,
          lastSync: new Date(),
          error: null
        };
      }
      
      return {
        connected: false,
        lastSync: null,
        error: 'No restaurants found'
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
    // Toast doesn't require explicit disconnection
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
        name: 'Restaurant Access',
        status: 'pending' as const,
        message: 'Verifying restaurant permissions...'
      },
      {
        name: 'Orders API',
        status: 'pending' as const,
        message: 'Testing orders API access...'
      },
      {
        name: 'Webhook Setup',
        status: 'pending' as const,
        message: 'Checking webhook configuration...'
      }
    ];

    try {
      // Test 1: API Authentication
      const restaurants = await this.makeRequest('/config/v1/restaurants');
      steps[0].status = 'success';
      steps[0].message = 'API credentials validated';

      // Test 2: Restaurant Access
      const restaurant = restaurants.find((r: any) => r.guid === this.config.restaurantId);
      if (restaurant) {
        steps[1].status = 'success';
        steps[1].message = `Connected to restaurant: ${restaurant.name}`;
      } else {
        steps[1].status = 'error';
        steps[1].message = 'Restaurant not found or access denied';
      }

      // Test 3: Orders API
      try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
        
        await this.makeRequest(
          `/orders/v2/orders?businessDate=${this.formatDate(startDate)}&endDate=${this.formatDate(endDate)}&pageSize=1`
        );
        
        steps[2].status = 'success';
        steps[2].message = 'Orders API access confirmed';
      } catch {
        steps[2].status = 'warning';
        steps[2].message = 'Orders API access limited - check permissions';
      }

      // Test 4: Webhook Setup
      if (this.config.webhookUrl) {
        steps[3].status = 'warning';
        steps[3].message = 'Webhook configuration needs manual setup in Toast Dashboard';
      } else {
        steps[3].status = 'warning';
        steps[3].message = 'No webhook URL configured';
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
      const end = endDate || new Date();
      const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days default

      let allOrders: ToastOrder[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const params = new URLSearchParams({
          businessDate: this.formatDate(start),
          endDate: this.formatDate(end),
          pageSize: pageSize.toString(),
          page: page.toString()
        });

        const response = await this.makeRequest(`/orders/v2/orders?${params.toString()}`);
        const orders = response || [];

        allOrders = allOrders.concat(orders);
        hasMore = orders.length === pageSize;
        page++;
      }

      return allOrders
        .filter(order => !order.deleted && !order.voided && order.checks.some(check => check.paymentStatus === 'CLOSED'))
        .map(order => this.transformTransaction(order));
    } catch (error) {
      console.error('Error fetching Toast transactions:', error);
      throw error;
    }
  }

  async setupWebhooks(): Promise<void> {
    throw new Error('Toast webhooks must be configured manually in the Toast Dashboard. Please visit https://dash.toasttab.com and set up webhooks for order events.');
  }

  async handleWebhook(payload: ToastWebhookPayload): Promise<POSWebhookData | null> {
    try {
      // Verify webhook authenticity
      if (!this.verifyWebhook(payload)) {
        throw new Error('Invalid webhook signature');
      }

      // Only process order-related webhooks
      if (payload.entityType !== 'ORDER') {
        return null;
      }

      // Fetch the full order data
      const order = await this.makeRequest(`/orders/v2/orders/${payload.guid}`);

      if (!order || order.deleted || order.voided) {
        return null;
      }

      // Only process orders with paid checks
      const hasPaidChecks = order.checks.some((check: any) => check.paymentStatus === 'CLOSED');
      if (!hasPaidChecks) {
        return null;
      }

      const transaction = this.transformTransaction(order);

      return {
        type: payload.eventType.includes('CREATED') ? 'transaction_created' : 'transaction_updated',
        transactionId: transaction.id,
        transaction,
        timestamp: new Date(payload.timestamp),
        metadata: {
          restaurantGuid: payload.restaurantGuid,
          webhookType: payload.eventType
        }
      };
    } catch (error) {
      console.error('Error handling Toast webhook:', error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Toast-Restaurant-External-ID': this.config.restaurantId
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (response.status === 401) {
      // Try to refresh token
      await this.refreshAccessToken();
      
      // Retry with new token
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
      const retryResponse = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });

      if (!retryResponse.ok) {
        const errorText = await retryResponse.text();
        throw new Error(`Toast API error (${retryResponse.status}): ${errorText}`);
      }

      return retryResponse.json();
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Toast API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  private async refreshAccessToken(): Promise<void> {
    const tokenUrl = this.config.environment === 'production'
      ? 'https://ws-api.toasttab.com/authentication/v1/authentication/login'
      : 'https://ws-sandbox-api.toasttab.com/authentication/v1/authentication/login';

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        userAccessToken: this.config.refreshToken
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Toast access token');
    }

    const tokenData = await response.json();
    this.config.accessToken = tokenData.token.accessToken;
    this.config.refreshToken = tokenData.token.refreshToken;
  }

  private transformTransaction(order: ToastOrder): POSTransaction {
    // Toast orders can have multiple checks, we'll aggregate them
    const totalAmount = order.checks.reduce((sum, check) => sum + check.totalAmount, 0);
    const totalTax = order.checks.reduce((sum, check) => sum + check.taxAmount, 0);
    const totalTip = order.checks.reduce((sum, check) => 
      sum + check.payments.reduce((tipSum, payment) => tipSum + (payment.tipAmount || 0), 0), 0
    );

    // Get all items from all checks
    const allItems = order.checks.flatMap(check => 
      check.selections.map(selection => ({
        id: selection.guid,
        name: selection.item.name,
        price: selection.price,
        quantity: selection.quantity,
        taxAmount: selection.tax
      }))
    );

    // Get primary payment method
    const firstPayment = order.checks[0]?.payments[0];
    const paymentMethod = firstPayment ? this.determinePaymentMethod(firstPayment) : 'unknown';

    // Determine status
    const allChecksClosed = order.checks.every(check => check.paymentStatus === 'CLOSED');
    const status = allChecksClosed ? 'completed' : 'pending';

    return {
      id: order.guid,
      externalId: order.externalId || order.guid,
      amount: totalAmount,
      tax: totalTax,
      tip: totalTip,
      timestamp: new Date(order.paidDate || order.closedDate || order.createdDate),
      posSystem: 'toast',
      location: order.serviceArea?.name || 'Main Dining',
      employee: 'Toast System', // Toast doesn't always provide employee info
      items: allItems,
      paymentMethod,
      status,
      metadata: {
        orderNumber: order.orderNumber,
        businessDate: order.businessDate,
        source: order.source,
        numberOfGuests: order.numberOfGuests,
        table: order.table?.name,
        serviceArea: order.serviceArea?.name,
        revenueCenterGuid: order.revenueCenterGuid,
        customer: order.checks[0]?.customer
      }
    };
  }

  private determinePaymentMethod(payment: ToastOrder['checks'][0]['payments'][0]): string {
    switch (payment.type?.toLowerCase()) {
      case 'credit':
      case 'creditcard':
      case 'debit':
        return 'card';
      case 'cash':
        return 'cash';
      case 'giftcard':
        return 'gift_card';
      case 'other':
      default:
        return 'other';
    }
  }

  private verifyWebhook(payload: ToastWebhookPayload): boolean {
    // In a real implementation, verify the webhook signature
    // using the webhook secret
    return payload.restaurantGuid === this.config.restaurantId;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  getConfig(): ToastConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ToastConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.baseUrl = this.config.environment === 'production' 
      ? 'https://ws-api.toasttab.com' 
      : 'https://ws-sandbox-api.toasttab.com';
  }

  async getTransactionById(id: string): Promise<POSTransaction | null> {
    try {
      const order = await this.makeRequest(`/orders/v2/orders/${id}`);
      
      if (!order || order.deleted || order.voided) {
        return null;
      }

      return this.transformTransaction(order);
    } catch (error) {
      console.error('Error fetching Toast transaction:', error);
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
      console.log(`Synced ${count} Toast transactions`);

      return { count, errors };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      return { count, errors };
    }
  }

  async getRevenueCenters(): Promise<Array<{ guid: string; name: string }>> {
    try {
      const revenueCenters = await this.makeRequest('/config/v1/revenueCenters');
      return revenueCenters.map((rc: any) => ({
        guid: rc.guid,
        name: rc.name
      }));
    } catch (error) {
      console.error('Error fetching revenue centers:', error);
      return [];
    }
  }

  async getMenuItems(): Promise<Array<{ guid: string; name: string; price: number }>> {
    try {
      const menus = await this.makeRequest('/config/v1/menus');
      const items: Array<{ guid: string; name: string; price: number }> = [];

      for (const menu of menus) {
        if (menu.menuGroups) {
          for (const group of menu.menuGroups) {
            if (group.menuItems) {
              for (const item of group.menuItems) {
                items.push({
                  guid: item.guid,
                  name: item.name,
                  price: item.price || 0
                });
              }
            }
          }
        }
      }

      return items;
    } catch (error) {
      console.error('Error fetching menu items:', error);
      return [];
    }
  }
}
