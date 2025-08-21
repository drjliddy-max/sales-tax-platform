import { 
  IntegrationAdapter, 
  Transaction, 
  Product, 
  Customer, 
  Address,
  TaxCalculationRequest,
  TaxCalculationResponse,
  RateLimitInfo
} from '../IntegrationManager';
import { logger } from '../../utils/logger';
import { TaxCalculator } from '../../tax-calculation/TaxCalculator';

interface StripeCredentials {
  secretKey: string; // sk_test_... or sk_live_...
  publishableKey?: string; // For frontend operations
  webhookSecret?: string; // For webhook signature verification
  testMode?: boolean;
}

interface StripeCharge {
  id: string;
  object: 'charge';
  amount: number; // Amount in cents
  amount_captured: number;
  amount_refunded: number;
  application?: string;
  application_fee?: string;
  application_fee_amount?: number;
  balance_transaction: string;
  billing_details: {
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    email?: string;
    name?: string;
    phone?: string;
  };
  calculated_statement_descriptor?: string;
  captured: boolean;
  created: number;
  currency: string;
  customer?: string;
  description?: string;
  disputed: boolean;
  failure_code?: string;
  failure_message?: string;
  fraud_details: Record<string, string>;
  invoice?: string;
  livemode: boolean;
  metadata: Record<string, string>;
  outcome?: {
    network_status: string;
    reason?: string;
    risk_level: string;
    risk_score?: number;
    seller_message: string;
    type: string;
  };
  paid: boolean;
  payment_intent?: string;
  payment_method?: string;
  payment_method_details?: any;
  receipt_email?: string;
  receipt_number?: string;
  receipt_url?: string;
  refunded: boolean;
  refunds: {
    object: 'list';
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  review?: string;
  shipping?: {
    address: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    carrier?: string;
    name: string;
    phone?: string;
    tracking_number?: string;
  };
  source_transfer?: string;
  statement_descriptor?: string;
  statement_descriptor_suffix?: string;
  status: 'succeeded' | 'pending' | 'failed';
  transfer_data?: any;
  transfer_group?: string;
}

interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  amount: number;
  amount_capturable: number;
  amount_received: number;
  application?: string;
  application_fee_amount?: number;
  automatic_payment_methods?: any;
  canceled_at?: number;
  cancellation_reason?: string;
  capture_method: 'automatic' | 'manual';
  charges: {
    object: 'list';
    data: StripeCharge[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  client_secret?: string;
  confirmation_method: 'automatic' | 'manual';
  created: number;
  currency: string;
  customer?: string;
  description?: string;
  invoice?: string;
  last_payment_error?: any;
  latest_charge?: string;
  livemode: boolean;
  metadata: Record<string, string>;
  next_action?: any;
  on_behalf_of?: string;
  payment_method?: string;
  payment_method_options?: any;
  payment_method_types: string[];
  processing?: any;
  receipt_email?: string;
  review?: string;
  setup_future_usage?: 'off_session' | 'on_session';
  shipping?: {
    address: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    carrier?: string;
    name: string;
    phone?: string;
    tracking_number?: string;
  };
  source?: string;
  statement_descriptor?: string;
  statement_descriptor_suffix?: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  transfer_data?: any;
  transfer_group?: string;
}

interface StripeCustomer {
  id: string;
  object: 'customer';
  address?: {
    city?: string;
    country?: string;
    line1?: string;
    line2?: string;
    postal_code?: string;
    state?: string;
  };
  balance: number;
  created: number;
  currency?: string;
  default_source?: string;
  delinquent: boolean;
  description?: string;
  discount?: any;
  email?: string;
  invoice_prefix?: string;
  invoice_settings: {
    custom_fields?: any;
    default_payment_method?: string;
    footer?: string;
    rendering_options?: any;
  };
  livemode: boolean;
  metadata: Record<string, string>;
  name?: string;
  next_invoice_sequence: number;
  phone?: string;
  preferred_locales: string[];
  shipping?: {
    address: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postal_code?: string;
      state?: string;
    };
    carrier?: string;
    name: string;
    phone?: string;
    tracking_number?: string;
  };
  sources: {
    object: 'list';
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  subscriptions: {
    object: 'list';
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  tax_exempt: 'none' | 'exempt' | 'reverse';
  tax_ids: {
    object: 'list';
    data: any[];
    has_more: boolean;
    total_count: number;
    url: string;
  };
  tax_info?: any;
  tax_info_verification?: any;
}

interface StripeProduct {
  id: string;
  object: 'product';
  active: boolean;
  attributes: string[];
  caption?: string;
  created: number;
  deactivate_on: string[];
  default_price?: string;
  description?: string;
  images: string[];
  livemode: boolean;
  metadata: Record<string, string>;
  name: string;
  package_dimensions?: {
    height: number;
    length: number;
    weight: number;
    width: number;
  };
  shippable?: boolean;
  statement_descriptor?: string;
  tax_code?: string;
  type: 'good' | 'service';
  unit_label?: string;
  updated: number;
  url?: string;
}

export class StripeAdapter implements IntegrationAdapter {
  id = 'stripe';
  name = 'Stripe';
  type = 'payment' as const;
  
  private credentials?: StripeCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl = 'https://api.stripe.com/v1';

  constructor() {
    this.taxCalculator = new TaxCalculator();
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const stripeCredentials = credentials as StripeCredentials;
      
      if (!stripeCredentials.secretKey || !stripeCredentials.secretKey.startsWith('sk_')) {
        logger.error('Missing or invalid Stripe secret key');
        return false;
      }

      this.credentials = stripeCredentials;

      // Test the connection by fetching account info
      const response = await fetch(`${this.baseUrl}/account`, {
        headers: {
          'Authorization': `Bearer ${stripeCredentials.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (!response.ok) {
        logger.error('Stripe authentication failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      logger.info(`Successfully authenticated with Stripe account: ${data.business_profile?.name || data.id}`);
      
      return true;
    } catch (error) {
      logger.error('Stripe authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Stripe doesn't require explicit disconnection of API keys
      this.credentials = undefined;
      logger.info('Disconnected from Stripe');
    } catch (error) {
      logger.error('Error during Stripe disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('Stripe connection test failed:', error);
      return false;
    }
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Stripe');
    }

    try {
      let allCharges: StripeCharge[] = [];
      let startingAfter: string | undefined;

      // Build query parameters
      const params = new URLSearchParams({
        limit: '100',
        expand: ['data.customer', 'data.payment_intent']
      });

      if (startDate) {
        params.append('created[gte]', Math.floor(startDate.getTime() / 1000).toString());
      }
      
      if (endDate) {
        params.append('created[lte]', Math.floor(endDate.getTime() / 1000).toString());
      }

      // Paginate through all charges
      while (true) {
        if (startingAfter) {
          params.set('starting_after', startingAfter);
        }

        const response = await fetch(`${this.baseUrl}/charges?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch charges: ${response.statusText}`);
        }

        const data = await response.json();
        const charges = data.data || [];
        
        if (charges.length === 0) break;
        
        allCharges = allCharges.concat(charges);
        
        if (!data.has_more) break;
        
        startingAfter = charges[charges.length - 1].id;
      }

      logger.info(`Fetched ${allCharges.length} charges from Stripe`);

      return allCharges.map((charge) => this.mapStripeChargeToTransaction(charge));
    } catch (error) {
      logger.error('Failed to sync Stripe transactions:', error);
      throw error;
    }
  }

  async syncProducts(): Promise<Product[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Stripe');
    }

    try {
      let allProducts: StripeProduct[] = [];
      let startingAfter: string | undefined;

      const params = new URLSearchParams({
        limit: '100'
      });

      // Paginate through all products
      while (true) {
        if (startingAfter) {
          params.set('starting_after', startingAfter);
        }

        const response = await fetch(`${this.baseUrl}/products?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.statusText}`);
        }

        const data = await response.json();
        const products = data.data || [];
        
        if (products.length === 0) break;
        
        allProducts = allProducts.concat(products);
        
        if (!data.has_more) break;
        
        startingAfter = products[products.length - 1].id;
      }

      logger.info(`Fetched ${allProducts.length} products from Stripe`);

      return allProducts.map((product) => ({
        id: `stripe_${product.id}`,
        externalId: product.id,
        name: product.name,
        sku: product.id, // Stripe doesn't have traditional SKUs
        price: 0, // Price comes from associated Price objects
        category: product.type === 'good' ? 'Physical Goods' : 'Services',
        taxCategory: product.tax_code ? 'taxable' : 'standard',
        description: product.description,
        weight: product.package_dimensions?.weight,
        dimensions: product.package_dimensions ? {
          length: product.package_dimensions.length,
          width: product.package_dimensions.width,
          height: product.package_dimensions.height
        } : undefined
      }));
    } catch (error) {
      logger.error('Failed to sync Stripe products:', error);
      throw error;
    }
  }

  async syncCustomers(): Promise<Customer[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Stripe');
    }

    try {
      let allCustomers: StripeCustomer[] = [];
      let startingAfter: string | undefined;

      const params = new URLSearchParams({
        limit: '100'
      });

      // Paginate through all customers
      while (true) {
        if (startingAfter) {
          params.set('starting_after', startingAfter);
        }

        const response = await fetch(`${this.baseUrl}/customers?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch customers: ${response.statusText}`);
        }

        const data = await response.json();
        const customers = data.data || [];
        
        if (customers.length === 0) break;
        
        allCustomers = allCustomers.concat(customers);
        
        if (!data.has_more) break;
        
        startingAfter = customers[customers.length - 1].id;
      }

      logger.info(`Fetched ${allCustomers.length} customers from Stripe`);

      return allCustomers.map((customer) => {
        const addresses: Address[] = [];
        
        if (customer.address) {
          addresses.push(this.mapStripeAddress(customer.address));
        }
        
        if (customer.shipping?.address && 
            JSON.stringify(customer.shipping.address) !== JSON.stringify(customer.address)) {
          addresses.push(this.mapStripeAddress(customer.shipping.address));
        }

        return {
          id: `stripe_${customer.id}`,
          externalId: customer.id,
          email: customer.email || '',
          firstName: customer.name?.split(' ')[0] || '',
          lastName: customer.name?.split(' ').slice(1).join(' ') || '',
          company: customer.description?.includes('Company:') ? 
            customer.description.split('Company:')[1]?.trim() : undefined,
          phone: customer.phone,
          addresses,
          taxExempt: customer.tax_exempt === 'exempt',
          taxExemptionReason: customer.tax_exempt === 'exempt' ? 'Stripe tax exempt' : undefined,
          taxExemptionCertificate: undefined // Stripe doesn't store certificates directly
        };
      });
    } catch (error) {
      logger.error('Failed to sync Stripe customers:', error);
      throw error;
    }
  }

  async calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResponse> {
    // Use our internal tax calculator
    const taxRequest = {
      items: request.items,
      address: request.shippingAddress,
      customerTaxExempt: !!request.exemptionCertificate
    };

    return await this.taxCalculator.calculateTax(taxRequest);
  }

  async updateTransaction(transactionId: string, taxData: any): Promise<boolean> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Stripe');
    }

    try {
      const chargeId = transactionId.replace('stripe_', '');
      
      // Update charge metadata with tax information
      const updateData = new URLSearchParams({
        'metadata[tax_total]': taxData.totalTax.toString(),
        'metadata[tax_calculated_at]': taxData.calculatedAt.toISOString()
      });

      // Add tax breakdown to metadata
      if (taxData.breakdown) {
        taxData.breakdown.forEach((breakdown: any, index: number) => {
          updateData.append(`metadata[tax_breakdown_${index}]`, 
            JSON.stringify({
              jurisdiction: breakdown.jurisdiction,
              rate: breakdown.rate,
              amount: breakdown.taxAmount
            })
          );
        });
      }

      const response = await fetch(`${this.baseUrl}/charges/${chargeId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: updateData
      });

      if (!response.ok) {
        logger.error(`Failed to update Stripe charge ${chargeId}:`, response.statusText);
        return false;
      }

      logger.info(`Successfully updated tax data for Stripe charge ${chargeId}`);
      return true;
    } catch (error) {
      logger.error('Failed to update Stripe transaction:', error);
      return false;
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<void> {
    try {
      // Verify webhook signature
      if (signature && this.credentials?.webhookSecret) {
        const isValid = await this.verifyWebhookSignature(
          JSON.stringify(payload),
          signature,
          this.credentials.webhookSecret
        );
        
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      const event = payload;
      
      // Handle different webhook events
      switch (event.type) {
        case 'charge.succeeded':
          await this.handleChargeSucceeded(event.data.object);
          break;
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;
        case 'customer.created':
        case 'customer.updated':
          await this.handleCustomerUpdated(event.data.object);
          break;
        case 'product.created':
        case 'product.updated':
          await this.handleProductUpdated(event.data.object);
          break;
        default:
          logger.debug(`Unhandled Stripe webhook event: ${event.type}`);
      }

      logger.info(`Processed Stripe webhook event: ${event.type}`);
    } catch (error) {
      logger.error('Failed to process Stripe webhook:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // Stripe has rate limits: 100 requests per second in test mode, more in live mode
    const limit = this.credentials?.testMode ? 100 : 500;
    
    return {
      remaining: limit, // This would be updated based on response headers
      resetTime: new Date(Date.now() + 1000), // Reset every second
      limit
    };
  }

  // Setup webhooks for real-time updates
  async setupWebhooks(webhookUrl: string, secret: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Stripe');
    }

    const webhookEvents = [
      'charge.succeeded',
      'charge.failed',
      'charge.refunded',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'customer.created',
      'customer.updated',
      'customer.deleted',
      'product.created',
      'product.updated',
      'invoice.payment_succeeded',
      'invoice.payment_failed'
    ];

    try {
      const webhookData = new URLSearchParams({
        'url': webhookUrl,
        'enabled_events[]': webhookEvents.join(',')
      });

      const response = await fetch(`${this.baseUrl}/webhook_endpoints`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: webhookData
      });

      if (!response.ok) {
        throw new Error(`Failed to create webhook: ${response.statusText}`);
      }

      const webhook = await response.json();
      logger.info(`Created Stripe webhook endpoint: ${webhook.id}`);
    } catch (error) {
      logger.error('Failed to setup Stripe webhooks:', error);
    }
  }

  private async verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
    try {
      const crypto = await import('crypto');
      
      const timestamp = signature.split(',').find(s => s.startsWith('t='))?.split('=')[1];
      const signatures = signature.split(',').filter(s => s.startsWith('v1='));
      
      if (!timestamp || signatures.length === 0) {
        return false;
      }

      const computedSignature = crypto.createHmac('sha256', secret)
        .update(`${timestamp}.${payload}`)
        .digest('hex');
      
      return signatures.some(sig => sig === `v1=${computedSignature}`);
    } catch (error) {
      logger.error('Failed to verify Stripe webhook signature:', error);
      return false;
    }
  }

  private async handleChargeSucceeded(charge: StripeCharge): Promise<void> {
    try {
      const transaction = this.mapStripeChargeToTransaction(charge);
      
      // Calculate taxes if shipping address is available
      if (charge.shipping?.address || charge.billing_details.address) {
        const shippingAddress = charge.shipping?.address || charge.billing_details.address;
        
        if (shippingAddress && (shippingAddress.line1 || shippingAddress.city)) {
          // For webhook processing, we'd typically emit an event or update a database
          logger.info(`Processing tax calculation for charge ${charge.id}`);
        }
      }

      logger.info(`Processed charge succeeded webhook for ${charge.id}`);
    } catch (error) {
      logger.error('Failed to process charge succeeded webhook:', error);
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: StripePaymentIntent): Promise<void> {
    try {
      // Process payment intent success
      logger.info(`Processed payment intent succeeded webhook for ${paymentIntent.id}`);
    } catch (error) {
      logger.error('Failed to process payment intent succeeded webhook:', error);
    }
  }

  private async handleCustomerUpdated(customer: StripeCustomer): Promise<void> {
    try {
      // Process customer update
      logger.info(`Processed customer update webhook for ${customer.id}`);
    } catch (error) {
      logger.error('Failed to process customer update webhook:', error);
    }
  }

  private async handleProductUpdated(product: StripeProduct): Promise<void> {
    try {
      // Process product update
      logger.info(`Processed product update webhook for ${product.id}`);
    } catch (error) {
      logger.error('Failed to process product update webhook:', error);
    }
  }

  private mapStripeChargeToTransaction(charge: StripeCharge): Transaction {
    const items = [{
      id: `stripe_item_${charge.id}`,
      productId: charge.metadata.product_id || '',
      sku: charge.metadata.sku || charge.id,
      name: charge.description || 'Stripe Charge',
      quantity: parseInt(charge.metadata.quantity || '1'),
      unitPrice: charge.amount / 100, // Convert from cents
      totalPrice: charge.amount / 100,
      taxAmount: 0, // Would extract from metadata if available
      taxCategory: 'standard'
    }];

    return {
      id: `stripe_${charge.id}`,
      externalId: charge.id,
      date: new Date(charge.created * 1000),
      amount: charge.amount / 100, // Convert from cents
      currency: charge.currency.toUpperCase(),
      customerId: charge.customer ? `stripe_${charge.customer}` : '',
      items,
      shippingAddress: charge.shipping?.address ? 
        this.mapStripeAddress(charge.shipping.address) : 
        this.mapStripeAddress(charge.billing_details.address || {}),
      billingAddress: this.mapStripeAddress(charge.billing_details.address || {}),
      taxAmount: parseFloat(charge.metadata.tax_total || '0'),
      status: this.mapStripeChargeStatus(charge.status, charge.paid, charge.refunded),
      metadata: {
        stripeChargeId: charge.id,
        stripePaymentIntent: charge.payment_intent,
        stripeReceiptUrl: charge.receipt_url,
        stripeLiveMode: charge.livemode
      }
    };
  }

  private mapStripeAddress(address: any): Address {
    return {
      street1: address.line1 || '',
      street2: address.line2,
      city: address.city || '',
      state: address.state || '',
      zipCode: address.postal_code || '',
      country: address.country || 'US'
    };
  }

  private mapStripeChargeStatus(status: string, paid: boolean, refunded: boolean): Transaction['status'] {
    if (refunded) return 'refunded';
    if (status === 'failed') return 'cancelled';
    if (status === 'succeeded' && paid) return 'completed';
    return 'pending';
  }
}
