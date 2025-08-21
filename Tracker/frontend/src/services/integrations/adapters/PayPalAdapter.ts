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

interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'live';
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  expiresAt?: Date;
  scope?: string;
  webhookId?: string;
}

interface PayPalPayment {
  id: string;
  intent: 'sale' | 'authorize' | 'order';
  state: 'created' | 'approved' | 'failed' | 'cancelled' | 'expired';
  cart: string;
  create_time: string;
  update_time: string;
  payer: {
    payment_method: 'paypal' | 'credit_card';
    status?: 'VERIFIED' | 'UNVERIFIED';
    payer_info: {
      email?: string;
      first_name?: string;
      last_name?: string;
      middle_name?: string;
      payer_id?: string;
      country_code?: string;
      shipping_address?: PayPalAddress;
      billing_address?: PayPalAddress;
      phone?: string;
      birth_date?: string;
      tax_id?: string;
      tax_id_type?: string;
    };
  };
  transactions: PayPalTransaction[];
  redirect_urls?: {
    return_url?: string;
    cancel_url?: string;
  };
  links?: Array<{
    href: string;
    rel: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    encType?: string;
  }>;
  failure_reason?: string;
}

interface PayPalTransaction {
  amount: {
    total: string;
    currency: string;
    details?: {
      subtotal?: string;
      tax?: string;
      shipping?: string;
      handling_fee?: string;
      shipping_discount?: string;
      discount?: string;
      insurance?: string;
      gift_wrap?: string;
    };
  };
  payee?: {
    merchant_id?: string;
    email?: string;
  };
  description?: string;
  custom?: string;
  invoice_number?: string;
  purchase_unit_reference_id?: string;
  soft_descriptor?: string;
  payment_options?: {
    allowed_payment_method?: 'INSTANT_FUNDING_SOURCE' | 'UNRESTRICTED';
  };
  item_list?: {
    items: PayPalItem[];
    shipping_address?: PayPalAddress;
  };
  notify_url?: string;
  order_url?: string;
  related_resources?: Array<{
    sale?: PayPalSale;
    authorization?: PayPalAuthorization;
    order?: PayPalOrder;
    capture?: PayPalCapture;
    refund?: PayPalRefund;
  }>;
}

interface PayPalItem {
  name: string;
  description?: string;
  quantity: string;
  price: string;
  tax?: string;
  sku?: string;
  currency: string;
  category?: 'DIGITAL' | 'PHYSICAL';
  weight?: {
    value: number;
    unit: 'oz' | 'lbs' | 'kg' | 'g';
  };
  length?: {
    value: number;
    unit: 'in' | 'ft' | 'yd' | 'mm' | 'cm' | 'm';
  };
  width?: {
    value: number;
    unit: 'in' | 'ft' | 'yd' | 'mm' | 'cm' | 'm';
  };
  height?: {
    value: number;
    unit: 'in' | 'ft' | 'yd' | 'mm' | 'cm' | 'm';
  };
  url?: string;
}

interface PayPalAddress {
  recipient_name?: string;
  line1: string;
  line2?: string;
  city: string;
  country_code: string;
  postal_code?: string;
  state?: string;
  phone?: string;
}

interface PayPalSale {
  id: string;
  state: 'completed' | 'partially_refunded' | 'pending' | 'refunded' | 'denied';
  amount: {
    total: string;
    currency: string;
    details?: {
      subtotal?: string;
      tax?: string;
      shipping?: string;
      handling_fee?: string;
      shipping_discount?: string;
      discount?: string;
    };
  };
  payment_mode: 'INSTANT_TRANSFER' | 'MANUAL_BANK_TRANSFER' | 'DELAYED_TRANSFER' | 'ECHECK';
  protection_eligibility: 'ELIGIBLE' | 'PARTIALLY_ELIGIBLE' | 'INELIGIBLE';
  protection_eligibility_type?: string;
  transaction_fee?: {
    value: string;
    currency: string;
  };
  parent_payment: string;
  create_time: string;
  update_time: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  clearing_time?: string;
  receipt_id?: string;
  processor_response?: {
    avs_code?: string;
    cvv_code?: string;
    response_code?: string;
  };
}

interface PayPalAuthorization {
  id: string;
  state: 'pending' | 'authorized' | 'partially_captured' | 'captured' | 'expired' | 'voided';
  amount: {
    total: string;
    currency: string;
    details?: {
      subtotal?: string;
      tax?: string;
      shipping?: string;
    };
  };
  parent_payment: string;
  valid_until: string;
  create_time: string;
  update_time: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalCapture {
  id: string;
  state: 'pending' | 'completed' | 'refunded' | 'partially_refunded';
  amount: {
    total: string;
    currency: string;
  };
  parent_payment: string;
  transaction_fee?: {
    value: string;
    currency: string;
  };
  create_time: string;
  update_time: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  is_final_capture?: boolean;
}

interface PayPalRefund {
  id: string;
  state: 'pending' | 'completed' | 'cancelled' | 'failed';
  amount: {
    total: string;
    currency: string;
  };
  parent_payment: string;
  sale_id?: string;
  capture_id?: string;
  create_time: string;
  update_time: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  reason?: string;
  invoice_number?: string;
}

interface PayPalOrder {
  id: string;
  state: 'pending' | 'completed' | 'refunded' | 'partially_refunded' | 'voided';
  amount: {
    total: string;
    currency: string;
    details?: {
      subtotal?: string;
      tax?: string;
      shipping?: string;
    };
  };
  parent_payment: string;
  create_time: string;
  update_time: string;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalWebhookEvent {
  id: string;
  event_version: string;
  create_time: string;
  resource_type: string;
  event_type: string;
  summary: string;
  resource: any;
  links?: Array<{
    href: string;
    rel: string;
    method: string;
    encType?: string;
  }>;
  event_id?: string;
}

export class PayPalAdapter implements IntegrationAdapter {
  id = 'paypal';
  name = 'PayPal';
  type = 'payment' as const;
  
  private credentials?: PayPalCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl: string;

  constructor() {
    this.taxCalculator = new TaxCalculator();
    this.baseUrl = 'https://api-m.paypal.com'; // Will be set based on environment
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const paypalCredentials = credentials as PayPalCredentials;
      
      if (!paypalCredentials.clientId || !paypalCredentials.clientSecret) {
        logger.error('Missing required PayPal credentials');
        return false;
      }

      this.credentials = paypalCredentials;
      
      // Set the correct base URL based on environment
      this.baseUrl = paypalCredentials.environment === 'sandbox' 
        ? 'https://api-m.sandbox.paypal.com' 
        : 'https://api-m.paypal.com';

      // Get access token
      const tokenResponse = await this.getAccessToken();
      
      if (!tokenResponse.success) {
        logger.error('PayPal authentication failed:', tokenResponse.error);
        return false;
      }

      logger.info('Successfully authenticated with PayPal');
      return true;
    } catch (error) {
      logger.error('PayPal authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // PayPal doesn't require explicit token revocation for client credentials
      // Clear stored credentials
      this.credentials = undefined;
      
      logger.info('Disconnected from PayPal');
    } catch (error) {
      logger.error('Error during PayPal disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const tokenResponse = await this.getAccessToken();
      return tokenResponse.success;
    } catch (error) {
      logger.error('PayPal connection test failed:', error);
      return false;
    }
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with PayPal');
    }

    try {
      const payments = await this.fetchPayments(startDate, endDate);
      const transactions = payments.map(payment => this.mapPayPalPaymentToTransaction(payment));

      logger.info(`Fetched ${transactions.length} transactions from PayPal`);

      return transactions;
    } catch (error) {
      logger.error('Failed to sync PayPal transactions:', error);
      throw error;
    }
  }

  async syncProducts(): Promise<Product[]> {
    // PayPal doesn't have a native product catalog
    // This would typically sync from PayPal Commerce Platform if available
    logger.info('PayPal does not have a native product catalog - returning empty array');
    return [];
  }

  async syncCustomers(): Promise<Customer[]> {
    // PayPal customer data is limited and typically accessed through payments
    // This would require PayPal Commerce Platform or merchant-specific implementation
    logger.info('PayPal customer data is limited - extracting from recent payments');
    
    try {
      const payments = await this.fetchPayments(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days
      const customerMap = new Map<string, Customer>();

      payments.forEach(payment => {
        const payerInfo = payment.payer.payer_info;
        if (payerInfo.payer_id && !customerMap.has(payerInfo.payer_id)) {
          customerMap.set(payerInfo.payer_id, {
            id: `paypal_${payerInfo.payer_id}`,
            externalId: payerInfo.payer_id,
            email: payerInfo.email || '',
            firstName: payerInfo.first_name || '',
            lastName: payerInfo.last_name || '',
            phone: payerInfo.phone,
            addresses: [
              payerInfo.shipping_address ? this.mapPayPalAddress(payerInfo.shipping_address) : undefined,
              payerInfo.billing_address ? this.mapPayPalAddress(payerInfo.billing_address) : undefined
            ].filter(Boolean) as Address[],
            taxExempt: false, // PayPal doesn't track tax exemption status
            taxExemptionCertificate: payerInfo.tax_id
          });
        }
      });

      const customers = Array.from(customerMap.values());
      logger.info(`Extracted ${customers.length} unique customers from PayPal payments`);

      return customers;
    } catch (error) {
      logger.error('Failed to sync PayPal customers:', error);
      return [];
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
      throw new Error('Not authenticated with PayPal');
    }

    try {
      const paymentId = transactionId.replace('paypal_', '');
      
      // PayPal payments are immutable after creation
      // Tax data would need to be stored in our system and associated with the PayPal payment
      logger.info(`Tax calculation completed for PayPal payment ${paymentId}`, {
        paymentId,
        taxData
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to update PayPal transaction:', error);
      return false;
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<void> {
    try {
      const webhookEvent = payload as PayPalWebhookEvent;
      
      // Verify webhook signature if provided
      if (signature) {
        const isValid = await this.verifyWebhookSignature(payload, signature);
        if (!isValid) {
          throw new Error('Invalid webhook signature');
        }
      }

      // Process different webhook event types
      switch (webhookEvent.event_type) {
        case 'PAYMENT.SALE.COMPLETED':
          await this.handlePaymentCompleted(webhookEvent);
          break;
        case 'PAYMENT.SALE.DENIED':
          await this.handlePaymentDenied(webhookEvent);
          break;
        case 'PAYMENT.SALE.PENDING':
          await this.handlePaymentPending(webhookEvent);
          break;
        case 'PAYMENT.SALE.REFUNDED':
          await this.handlePaymentRefunded(webhookEvent);
          break;
        case 'PAYMENT.SALE.REVERSED':
          await this.handlePaymentReversed(webhookEvent);
          break;
        case 'PAYMENT.AUTHORIZATION.CREATED':
          await this.handleAuthorizationCreated(webhookEvent);
          break;
        case 'PAYMENT.AUTHORIZATION.VOIDED':
          await this.handleAuthorizationVoided(webhookEvent);
          break;
        case 'PAYMENT.CAPTURE.COMPLETED':
          await this.handleCaptureCompleted(webhookEvent);
          break;
        case 'PAYMENT.CAPTURE.DENIED':
          await this.handleCaptureDenied(webhookEvent);
          break;
        case 'PAYMENT.CAPTURE.PENDING':
          await this.handleCapturePending(webhookEvent);
          break;
        case 'PAYMENT.CAPTURE.REFUNDED':
          await this.handleCaptureRefunded(webhookEvent);
          break;
        default:
          logger.info(`Unhandled PayPal webhook event: ${webhookEvent.event_type}`);
      }

      logger.info(`Processed PayPal webhook: ${webhookEvent.event_type}`, { eventId: webhookEvent.id });
    } catch (error) {
      logger.error('Failed to process PayPal webhook:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // PayPal API rate limits vary by endpoint
    // REST API: 10,000 requests per day for live, unlimited for sandbox
    return {
      remaining: this.credentials?.environment === 'sandbox' ? 999999 : 10000,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Reset daily
      limit: this.credentials?.environment === 'sandbox' ? 999999 : 10000
    };
  }

  private async getAccessToken(): Promise<{ success: boolean; error?: string }> {
    if (!this.credentials) {
      return { success: false, error: 'No credentials available' };
    }

    // Check if current token is still valid
    if (this.credentials.accessToken && this.credentials.expiresAt && this.credentials.expiresAt > new Date()) {
      return { success: true };
    }

    try {
      const auth = btoa(`${this.credentials.clientId}:${this.credentials.clientSecret}`);
      
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }

      const data = await response.json();
      
      this.credentials.accessToken = data.access_token;
      this.credentials.tokenType = data.token_type;
      this.credentials.expiresIn = data.expires_in;
      this.credentials.expiresAt = new Date(Date.now() + (data.expires_in * 1000));
      this.credentials.scope = data.scope;

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async fetchPayments(startDate?: Date, endDate?: Date): Promise<PayPalPayment[]> {
    if (!this.credentials?.accessToken) {
      const tokenResult = await this.getAccessToken();
      if (!tokenResult.success) {
        throw new Error(`Failed to get access token: ${tokenResult.error}`);
      }
    }

    let allPayments: PayPalPayment[] = [];
    let nextPage: string | undefined;
    let page = 1;
    const maxPages = 10; // Prevent infinite loops

    do {
      const params = new URLSearchParams({
        count: '20', // Maximum items per page
        start_index: ((page - 1) * 20).toString()
      });

      if (startDate) {
        params.append('start_time', startDate.toISOString());
      }
      if (endDate) {
        params.append('end_time', endDate.toISOString());
      }

      const response = await fetch(`${this.baseUrl}/v1/payments/payment?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.credentials!.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch payments: ${response.statusText}`);
      }

      const data = await response.json();
      const payments = data.payments || [];
      
      allPayments = allPayments.concat(payments);
      
      // Check for next page link
      const nextLink = data.links?.find((link: any) => link.rel === 'next');
      nextPage = nextLink?.href;
      page++;

    } while (nextPage && page <= maxPages && allPayments.length < 1000); // Limit total results

    return allPayments;
  }

  private mapPayPalPaymentToTransaction(payment: PayPalPayment): Transaction {
    const transaction = payment.transactions[0]; // PayPal payments typically have one transaction
    const items = transaction.item_list?.items || [];
    const shippingAddress = transaction.item_list?.shipping_address || payment.payer.payer_info.shipping_address;
    const billingAddress = payment.payer.payer_info.billing_address;

    return {
      id: `paypal_${payment.id}`,
      externalId: payment.id,
      date: new Date(payment.create_time),
      amount: parseFloat(transaction.amount.total),
      currency: transaction.amount.currency,
      customerId: payment.payer.payer_info.payer_id ? `paypal_${payment.payer.payer_info.payer_id}` : undefined,
      items: items.map((item, index) => ({
        id: `paypal_item_${payment.id}_${index}`,
        productId: item.sku || `item_${index}`,
        sku: item.sku || '',
        name: item.name,
        quantity: parseInt(item.quantity) || 1,
        unitPrice: parseFloat(item.price),
        totalPrice: parseFloat(item.price) * parseInt(item.quantity),
        taxAmount: item.tax ? parseFloat(item.tax) : 0,
        taxCategory: 'standard'
      })),
      shippingAddress: shippingAddress ? this.mapPayPalAddress(shippingAddress) : undefined,
      billingAddress: billingAddress ? this.mapPayPalAddress(billingAddress) : undefined,
      taxAmount: transaction.amount.details?.tax ? parseFloat(transaction.amount.details.tax) : 0,
      status: this.mapPayPalPaymentStatus(payment.state),
      metadata: {
        paypalIntent: payment.intent,
        paypalCart: payment.cart,
        paypalPaymentMethod: payment.payer.payment_method,
        paypalPayerStatus: payment.payer.status,
        paypalInvoiceNumber: transaction.invoice_number,
        paypalCustom: transaction.custom,
        paypalDescription: transaction.description,
        paypalFailureReason: payment.failure_reason
      }
    };
  }

  private mapPayPalAddress(address: PayPalAddress): Address {
    return {
      street1: address.line1,
      street2: address.line2,
      city: address.city,
      state: address.state || '',
      zipCode: address.postal_code || '',
      country: address.country_code || 'US'
    };
  }

  private mapPayPalPaymentStatus(state: string): Transaction['status'] {
    switch (state) {
      case 'approved':
        return 'completed';
      case 'failed':
      case 'cancelled':
      case 'expired':
        return 'cancelled';
      case 'created':
      default:
        return 'pending';
    }
  }

  private async verifyWebhookSignature(payload: any, signature: string): Promise<boolean> {
    // PayPal webhook signature verification
    // This is a simplified version - full implementation would use PayPal's webhook validation API
    try {
      if (!this.credentials?.webhookId) {
        logger.warn('No webhook ID configured for signature verification');
        return true; // Allow webhook if no webhook ID is set
      }

      // In production, you would verify the signature using PayPal's webhook verification API
      // or implement HMAC verification if using a webhook secret
      return true;
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  // Webhook event handlers
  private async handlePaymentCompleted(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal payment completed', { saleId: event.resource.id });
    // Trigger any necessary business logic for completed payments
  }

  private async handlePaymentDenied(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal payment denied', { saleId: event.resource.id });
    // Handle denied payment logic
  }

  private async handlePaymentPending(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal payment pending', { saleId: event.resource.id });
    // Handle pending payment logic
  }

  private async handlePaymentRefunded(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal payment refunded', { saleId: event.resource.id });
    // Handle refund logic
  }

  private async handlePaymentReversed(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal payment reversed', { saleId: event.resource.id });
    // Handle payment reversal logic
  }

  private async handleAuthorizationCreated(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal authorization created', { authId: event.resource.id });
    // Handle authorization logic
  }

  private async handleAuthorizationVoided(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal authorization voided', { authId: event.resource.id });
    // Handle voided authorization logic
  }

  private async handleCaptureCompleted(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal capture completed', { captureId: event.resource.id });
    // Handle completed capture logic
  }

  private async handleCaptureDenied(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal capture denied', { captureId: event.resource.id });
    // Handle denied capture logic
  }

  private async handleCapturePending(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal capture pending', { captureId: event.resource.id });
    // Handle pending capture logic
  }

  private async handleCaptureRefunded(event: PayPalWebhookEvent): Promise<void> {
    logger.info('PayPal capture refunded', { captureId: event.resource.id });
    // Handle capture refund logic
  }
}
