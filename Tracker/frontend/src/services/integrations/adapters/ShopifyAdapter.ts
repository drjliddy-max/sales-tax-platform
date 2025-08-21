import { 
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
import { EnhancedBaseAdapter } from './EnhancedBaseAdapter';

interface ShopifyCredentials {
  shop: string; // mystore.myshopify.com
  accessToken: string;
  webhookSecret?: string;
}

interface ShopifyWebhookPayload {
  id: number;
  email?: string;
  created_at: string;
  updated_at: string;
  number?: number;
  token?: string;
  gateway?: string;
  test?: boolean;
  total_price?: string;
  subtotal_price?: string;
  total_weight?: number;
  total_tax?: string;
  taxes_included?: boolean;
  currency?: string;
  financial_status?: string;
  confirmed?: boolean;
  total_discounts?: string;
  buyer_accepts_marketing?: boolean;
  name?: string;
  referring_site?: string;
  landing_site?: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  total_price_usd?: string;
  checkout_token?: string;
  reference?: string;
  user_id?: number;
  location_id?: number;
  source_identifier?: string;
  source_url?: string;
  processed_at?: string;
  device_id?: number;
  phone?: string;
  customer_url?: string;
  order_number?: number;
  discount_applications?: any[];
  discount_codes?: any[];
  note_attributes?: any[];
  payment_gateway_names?: string[];
  processing_method?: string;
  checkout_id?: number;
  source_name?: string;
  fulfillment_status?: string;
  tax_lines?: Array<{
    title: string;
    price: string;
    rate: number;
  }>;
  tags?: string;
  contact_email?: string;
  order_status_url?: string;
  presentment_currency?: string;
  total_line_items_price_set?: any;
  total_discounts_set?: any;
  total_shipping_price_set?: any;
  subtotal_price_set?: any;
  total_price_set?: any;
  total_tax_set?: any;
  line_items?: Array<{
    id: number;
    variant_id: number;
    title: string;
    quantity: number;
    sku: string;
    variant_title: string;
    vendor: string;
    fulfillment_service: string;
    product_id: number;
    requires_shipping: boolean;
    taxable: boolean;
    gift_card: boolean;
    name: string;
    variant_inventory_management: string;
    properties: any[];
    product_exists: boolean;
    fulfillable_quantity: number;
    grams: number;
    price: string;
    total_discount: string;
    fulfillment_status: string;
    price_set: any;
    total_discount_set: any;
    discount_allocations: any[];
    duties: any[];
    admin_graphql_api_id: string;
    tax_lines: Array<{
      title: string;
      price: string;
      rate: number;
    }>;
  }>;
  billing_address?: {
    first_name: string;
    address1: string;
    phone: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    last_name: string;
    address2: string;
    company: string;
    latitude?: number;
    longitude?: number;
    name: string;
    country_code: string;
    province_code: string;
  };
  shipping_address?: {
    first_name: string;
    address1: string;
    phone: string;
    city: string;
    zip: string;
    province: string;
    country: string;
    last_name: string;
    address2: string;
    company: string;
    latitude?: number;
    longitude?: number;
    name: string;
    country_code: string;
    province_code: string;
  };
  fulfillments?: any[];
  client_details?: {
    browser_ip: string;
    accept_language: string;
    user_agent: string;
    session_hash: string;
    browser_width: number;
    browser_height: number;
  };
  customer?: {
    id: number;
    email: string;
    accepts_marketing: boolean;
    created_at: string;
    updated_at: string;
    first_name: string;
    last_name: string;
    orders_count: number;
    state: string;
    total_spent: string;
    last_order_id: number;
    note: string;
    verified_email: boolean;
    multipass_identifier?: string;
    tax_exempt: boolean;
    phone: string;
    tags: string;
    last_order_name: string;
    currency: string;
    accepts_marketing_updated_at: string;
    marketing_opt_in_level?: string;
    tax_exemptions: string[];
    default_address?: {
      id: number;
      customer_id: number;
      first_name: string;
      last_name: string;
      company: string;
      address1: string;
      address2: string;
      city: string;
      province: string;
      country: string;
      zip: string;
      phone: string;
      name: string;
      province_code: string;
      country_code: string;
      country_name: string;
      default: boolean;
    };
  };
}

export class ShopifyAdapter extends EnhancedBaseAdapter {
  id = 'shopify';
  name = 'Shopify';
  type = 'ecommerce' as const;
  
  private credentials?: ShopifyCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl = '';

  constructor() {
    super();
    this.taxCalculator = new TaxCalculator();
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const shopifyCredentials = credentials as ShopifyCredentials;
      
      if (!shopifyCredentials.shop || !shopifyCredentials.accessToken) {
        logger.error('Missing required Shopify credentials');
        return false;
      }

      this.credentials = shopifyCredentials;
      this.baseUrl = `https://${shopifyCredentials.shop}`;

      // Test the connection by fetching shop info
      const response = await fetch(`${this.baseUrl}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': shopifyCredentials.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        logger.error('Shopify authentication failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      logger.info(`Successfully authenticated with Shopify shop: ${data.shop?.name}`);
      
      return true;
    } catch (error) {
      logger.error('Shopify authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Revoke webhooks and clean up
    try {
      if (this.credentials) {
        // List and delete all our webhooks
        const webhooks = await this.listWebhooks();
        for (const webhook of webhooks) {
          if (webhook.address?.includes('sales-tax-tracker')) {
            await this.deleteWebhook(webhook.id);
          }
        }
      }
      
      this.credentials = undefined;
      this.baseUrl = '';
      
      logger.info('Disconnected from Shopify');
    } catch (error) {
      logger.error('Error during Shopify disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const response = await fetch(`${this.baseUrl}/admin/api/2023-10/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': this.credentials.accessToken,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('Shopify connection test failed:', error);
      return false;
    }
  }

  // Implementation methods for EnhancedBaseAdapter
  protected async doSyncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Shopify');
    }

    const params = new URLSearchParams({
      status: 'any',
      limit: '250'
    });

    if (startDate) {
      params.append('created_at_min', startDate.toISOString());
    }
    
    if (endDate) {
      params.append('created_at_max', endDate.toISOString());
    }

    const response = await fetch(`${this.baseUrl}/admin/api/2023-10/orders.json?${params}`, {
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const data = await response.json();
    const orders = data.orders || [];

    logger.info(`Fetched ${orders.length} orders from Shopify`);

    return orders.map((order: ShopifyWebhookPayload) => this.mapShopifyOrderToTransaction(order));
  }

  protected async doSyncProducts(): Promise<Product[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Shopify');
    }

    const response = await fetch(`${this.baseUrl}/admin/api/2023-10/products.json?limit=250`, {
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch products: ${response.statusText}`);
    }

    const data = await response.json();
    const products = data.products || [];

    logger.info(`Fetched ${products.length} products from Shopify`);

    const mappedProducts: Product[] = [];
    for (const product of products) {
      for (const variant of product.variants || []) {
        mappedProducts.push({
          id: `shopify_${variant.id}`,
          externalId: variant.id.toString(),
          name: `${product.title} - ${variant.title}`,
          sku: variant.sku || `shopify_${variant.id}`,
          price: parseFloat(variant.price || '0'),
          category: product.product_type || 'General',
          taxCategory: variant.taxable ? 'taxable' : 'exempt',
          description: product.body_html,
          weight: variant.weight ? parseFloat(variant.weight) : undefined,
          dimensions: variant.weight ? {
            length: 0,
            width: 0,
            height: 0
          } : undefined
        });
      }
    }

    return mappedProducts;
  }

  protected async doSyncCustomers(): Promise<Customer[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Shopify');
    }

    const response = await fetch(`${this.baseUrl}/admin/api/2023-10/customers.json?limit=250`, {
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch customers: ${response.statusText}`);
    }

    const data = await response.json();
    const customers = data.customers || [];

    logger.info(`Fetched ${customers.length} customers from Shopify`);

    return customers.map((customer: any) => ({
      id: `shopify_${customer.id}`,
      externalId: customer.id.toString(),
      email: customer.email || '',
      firstName: customer.first_name || '',
      lastName: customer.last_name || '',
      company: customer.default_address?.company,
      phone: customer.phone,
      addresses: customer.addresses?.map((addr: any) => this.mapShopifyAddress(addr)) || [],
      taxExempt: customer.tax_exempt || false,
      taxExemptionReason: customer.tax_exemptions?.join(', '),
      taxExemptionCertificate: undefined
    }));
  }

  protected async doCalculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResponse> {
    // Use our internal tax calculator
    const taxRequest = {
      items: request.items,
      address: request.shippingAddress,
      customerTaxExempt: !!request.exemptionCertificate
    };

    return await this.taxCalculator.calculateTax(taxRequest);
  }

  protected async doUpdateTransaction(transactionId: string, taxData: any): Promise<boolean> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Shopify');
    }

    const orderId = transactionId.replace('shopify_', '');
    
    // Update order with calculated tax information
    const updateData = {
      order: {
        id: orderId,
        tax_lines: taxData.breakdown?.map((breakdown: any) => ({
          title: `${breakdown.jurisdiction} Tax`,
          price: breakdown.taxAmount.toString(),
          rate: breakdown.rate
        })) || []
      }
    };

    const response = await fetch(`${this.baseUrl}/admin/api/2023-10/orders/${orderId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update Shopify order ${orderId}: ${response.statusText}`);
    }

    logger.info(`Successfully updated tax data for Shopify order ${orderId}`);
    return true;
  }

  protected async doHandleWebhook(payload: any, signature?: string): Promise<void> {
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

    const webhookData = payload as ShopifyWebhookPayload;
    
    // Handle different webhook events
    if (webhookData.id) {
      // This is likely an order webhook
      await this.processOrderWebhook(webhookData);
    }

    logger.info(`Processed Shopify webhook for order ${webhookData.id}`);
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // Shopify uses a leaky bucket algorithm
    // Default limits: 2 requests per second, 40 requests per app per store
    return {
      remaining: 40, // This would be updated based on response headers
      resetTime: new Date(Date.now() + 1000), // Reset every second
      limit: 40
    };
  }

  // Setup webhooks for real-time updates
  async setupWebhooks(webhookUrl: string, secret: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Shopify');
    }

    const webhookTopics = [
      'orders/create',
      'orders/updated',
      'orders/paid',
      'orders/cancelled',
      'orders/fulfilled',
      'orders/partially_fulfilled',
      'customers/create',
      'customers/update',
      'products/create',
      'products/update'
    ];

    for (const topic of webhookTopics) {
      try {
        await this.createWebhook(topic, webhookUrl, secret);
        logger.info(`Created Shopify webhook for ${topic}`);
      } catch (error) {
        logger.error(`Failed to create webhook for ${topic}:`, error);
      }
    }
  }

  private async createWebhook(topic: string, address: string, secret: string): Promise<void> {
    if (!this.credentials) return;

    const webhookData = {
      webhook: {
        topic,
        address: `${address}?topic=${topic}`,
        format: 'json'
      }
    };

    const response = await fetch(`${this.baseUrl}/admin/api/2023-10/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }
  }

  private async listWebhooks(): Promise<Array<{ id: number; address: string }>> {
    if (!this.credentials) return [];

    const response = await fetch(`${this.baseUrl}/admin/api/2023-10/webhooks.json`, {
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.webhooks || [];
  }

  private async deleteWebhook(webhookId: number): Promise<void> {
    if (!this.credentials) return;

    await fetch(`${this.baseUrl}/admin/api/2023-10/webhooks/${webhookId}.json`, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });
  }

  private async verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
    try {
      const crypto = await import('crypto');
      const computedSignature = crypto.createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');
      
      return computedSignature === signature.replace('sha256=', '');
    } catch (error) {
      logger.error('Failed to verify webhook signature:', error);
      return false;
    }
  }

  private async processOrderWebhook(orderData: ShopifyWebhookPayload): Promise<void> {
    try {
      // Convert to our standard transaction format
      const transaction = this.mapShopifyOrderToTransaction(orderData);
      
      // Calculate taxes if not already calculated
      if (!orderData.total_tax || parseFloat(orderData.total_tax) === 0) {
        if (orderData.line_items && orderData.shipping_address) {
          const taxRequest: TaxCalculationRequest = {
            transactionId: transaction.id,
            customerId: transaction.customerId,
            items: transaction.items,
            shippingAddress: transaction.shippingAddress,
            billingAddress: transaction.billingAddress,
            shippingAmount: 0, // Would extract from order
            discountAmount: orderData.total_discounts ? parseFloat(orderData.total_discounts) : 0
          };

          const taxResponse = await this.calculateTax(taxRequest);
          
          if (taxResponse.totalTax > 0) {
            await this.updateTransaction(transaction.id, {
              totalTax: taxResponse.totalTax,
              breakdown: taxResponse.breakdown,
              calculatedAt: new Date()
            });
          }
        }
      }

      logger.info(`Processed order webhook for Shopify order ${orderData.id}`);
    } catch (error) {
      logger.error('Failed to process order webhook:', error);
    }
  }

  private mapShopifyOrderToTransaction(order: ShopifyWebhookPayload): Transaction {
    return {
      id: `shopify_${order.id}`,
      externalId: order.id?.toString() || '',
      date: new Date(order.created_at),
      amount: parseFloat(order.total_price || '0'),
      currency: order.currency || 'USD',
      customerId: order.customer?.id ? `shopify_${order.customer.id}` : '',
      items: (order.line_items || []).map(item => ({
        id: `shopify_${item.id}`,
        productId: `shopify_${item.product_id}`,
        sku: item.sku || '',
        name: item.name,
        quantity: item.quantity,
        unitPrice: parseFloat(item.price),
        totalPrice: parseFloat(item.price) * item.quantity,
        taxAmount: item.tax_lines?.reduce((sum, tax) => sum + parseFloat(tax.price), 0),
        taxCategory: item.taxable ? 'taxable' : 'exempt'
      })),
      shippingAddress: order.shipping_address ? this.mapShopifyAddress(order.shipping_address) : {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      billingAddress: order.billing_address ? this.mapShopifyAddress(order.billing_address) : {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      taxAmount: parseFloat(order.total_tax || '0'),
      status: this.mapShopifyOrderStatus(order.financial_status, order.fulfillment_status),
      metadata: {
        shopifyOrderNumber: order.order_number,
        shopifyOrderName: order.name,
        gateway: order.gateway,
        test: order.test,
        tags: order.tags
      }
    };
  }

  private mapShopifyAddress(address: any): Address {
    return {
      street1: address.address1 || '',
      street2: address.address2,
      city: address.city || '',
      state: address.province_code || address.province || '',
      zipCode: address.zip || '',
      country: address.country_code || address.country || 'US'
    };
  }

  private mapShopifyOrderStatus(financial_status?: string, fulfillment_status?: string): Transaction['status'] {
    if (financial_status === 'refunded') return 'refunded';
    if (financial_status === 'voided' || financial_status === 'cancelled') return 'cancelled';
    if (financial_status === 'paid') return 'completed';
    if (financial_status === 'pending' || financial_status === 'authorized') return 'pending';
    return 'pending';
  }
}
