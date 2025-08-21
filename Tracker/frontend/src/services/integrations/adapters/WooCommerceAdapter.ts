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

interface WooCommerceCredentials {
  url: string; // https://yourstore.com
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string;
}

interface WooCommerceOrder {
  id: number;
  parent_id: number;
  status: string;
  currency: string;
  version: string;
  prices_include_tax: boolean;
  date_created: string;
  date_modified: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  customer_id: number;
  order_key: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  customer_ip_address: string;
  customer_user_agent: string;
  created_via: string;
  customer_note: string;
  date_completed: string | null;
  date_paid: string | null;
  cart_hash: string;
  number: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: any;
  }>;
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    taxes: Array<{
      id: number;
      total: string;
      subtotal: string;
    }>;
    meta_data: Array<{
      id: number;
      key: string;
      value: string;
    }>;
    sku: string;
    price: number;
    image: {
      id: number;
      src: string;
    };
    parent_name: string | null;
  }>;
  tax_lines: Array<{
    id: number;
    rate_code: string;
    rate_id: number;
    label: string;
    compound: boolean;
    tax_total: string;
    shipping_tax_total: string;
    rate_percent: number;
    meta_data: any[];
  }>;
  shipping_lines: Array<{
    id: number;
    method_title: string;
    method_id: string;
    instance_id: string;
    total: string;
    total_tax: string;
    taxes: Array<{
      id: number;
      total: string;
    }>;
    meta_data: any[];
  }>;
  fee_lines: any[];
  coupon_lines: any[];
  refunds: any[];
  set_paid: boolean;
}

interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_to: string | null;
  price_html: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: any[];
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: string;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  low_stock_amount: number | null;
  sold_individually: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  parent_id: number;
  purchase_note: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  tags: any[];
  images: Array<{
    id: number;
    date_created: string;
    date_modified: string;
    src: string;
    name: string;
    alt: string;
  }>;
  attributes: any[];
  default_attributes: any[];
  variations: any[];
  grouped_products: any[];
  menu_order: number;
  price_html_raw: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: any;
  }>;
  stock_quantity_raw: number | null;
}

interface WooCommerceCustomer {
  id: number;
  date_created: string;
  date_modified: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  username: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  is_paying_customer: boolean;
  avatar_url: string;
  meta_data: Array<{
    id: number;
    key: string;
    value: any;
  }>;
}

export class WooCommerceAdapter implements IntegrationAdapter {
  id = 'woocommerce';
  name = 'WooCommerce';
  type = 'ecommerce' as const;
  
  private credentials?: WooCommerceCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl = '';

  constructor() {
    this.taxCalculator = new TaxCalculator();
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const wooCredentials = credentials as WooCommerceCredentials;
      
      if (!wooCredentials.url || !wooCredentials.consumerKey || !wooCredentials.consumerSecret) {
        logger.error('Missing required WooCommerce credentials');
        return false;
      }

      this.credentials = wooCredentials;
      this.baseUrl = wooCredentials.url.replace(/\/$/, '');

      // Test the connection by fetching system status
      const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/system_status`, {
        headers: {
          'Authorization': `Basic ${btoa(`${wooCredentials.consumerKey}:${wooCredentials.consumerSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        logger.error('WooCommerce authentication failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      logger.info(`Successfully authenticated with WooCommerce store: ${data.settings?.title?.value}`);
      
      return true;
    } catch (error) {
      logger.error('WooCommerce authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.credentials) {
        // List and delete all our webhooks
        const webhooks = await this.listWebhooks();
        for (const webhook of webhooks) {
          if (webhook.delivery_url?.includes('sales-tax-tracker')) {
            await this.deleteWebhook(webhook.id);
          }
        }
      }
      
      this.credentials = undefined;
      this.baseUrl = '';
      
      logger.info('Disconnected from WooCommerce');
    } catch (error) {
      logger.error('Error during WooCommerce disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/system_status`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('WooCommerce connection test failed:', error);
      return false;
    }
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with WooCommerce');
    }

    try {
      const params = new URLSearchParams({
        per_page: '100',
        status: 'any'
      });

      if (startDate) {
        params.append('after', startDate.toISOString());
      }
      
      if (endDate) {
        params.append('before', endDate.toISOString());
      }

      const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/orders?${params}`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const orders: WooCommerceOrder[] = await response.json();

      logger.info(`Fetched ${orders.length} orders from WooCommerce`);

      return orders.map((order) => this.mapWooCommerceOrderToTransaction(order));
    } catch (error) {
      logger.error('Failed to sync WooCommerce transactions:', error);
      throw error;
    }
  }

  async syncProducts(): Promise<Product[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with WooCommerce');
    }

    try {
      const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/products?per_page=100`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }

      const products: WooCommerceProduct[] = await response.json();

      logger.info(`Fetched ${products.length} products from WooCommerce`);

      return products.map((product) => ({
        id: `woocommerce_${product.id}`,
        externalId: product.id.toString(),
        name: product.name,
        sku: product.sku || `woocommerce_${product.id}`,
        price: parseFloat(product.price || '0'),
        category: product.categories[0]?.name || 'General',
        taxCategory: product.tax_status === 'taxable' ? 'taxable' : 'exempt',
        description: product.description,
        weight: product.weight ? parseFloat(product.weight) : undefined,
        dimensions: {
          length: parseFloat(product.dimensions.length || '0'),
          width: parseFloat(product.dimensions.width || '0'),
          height: parseFloat(product.dimensions.height || '0')
        }
      }));
    } catch (error) {
      logger.error('Failed to sync WooCommerce products:', error);
      throw error;
    }
  }

  async syncCustomers(): Promise<Customer[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with WooCommerce');
    }

    try {
      const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/customers?per_page=100`, {
        headers: {
          'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.statusText}`);
      }

      const customers: WooCommerceCustomer[] = await response.json();

      logger.info(`Fetched ${customers.length} customers from WooCommerce`);

      return customers.map((customer) => ({
        id: `woocommerce_${customer.id}`,
        externalId: customer.id.toString(),
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        company: customer.billing.company,
        phone: customer.billing.phone,
        addresses: [
          this.mapWooCommerceAddress(customer.billing),
          this.mapWooCommerceAddress(customer.shipping)
        ].filter(addr => addr.street1), // Only include addresses with street1
        taxExempt: false, // WooCommerce doesn't have built-in tax exemption
        taxExemptionReason: undefined,
        taxExemptionCertificate: undefined
      }));
    } catch (error) {
      logger.error('Failed to sync WooCommerce customers:', error);
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
      throw new Error('Not authenticated with WooCommerce');
    }

    try {
      const orderId = transactionId.replace('woocommerce_', '');
      
      // Update order with calculated tax information
      const updateData = {
        tax_lines: taxData.breakdown?.map((breakdown: any) => ({
          rate_code: breakdown.jurisdiction.toUpperCase(),
          label: `${breakdown.jurisdiction} Tax`,
          tax_total: breakdown.taxAmount.toString(),
          rate_percent: (breakdown.rate * 100).toString()
        })) || []
      };

      const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        logger.error(`Failed to update WooCommerce order ${orderId}:`, response.statusText);
        return false;
      }

      logger.info(`Successfully updated tax data for WooCommerce order ${orderId}`);
      return true;
    } catch (error) {
      logger.error('Failed to update WooCommerce transaction:', error);
      return false;
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<void> {
    try {
      // Verify webhook signature if provided
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

      const webhookData = payload as WooCommerceOrder;
      
      // Handle different webhook events based on the action
      if (webhookData.id) {
        await this.processOrderWebhook(webhookData);
      }

      logger.info(`Processed WooCommerce webhook for order ${webhookData.id}`);
    } catch (error) {
      logger.error('Failed to process WooCommerce webhook:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // WooCommerce REST API doesn't have strict rate limits by default
    // But we should implement reasonable limits to avoid overwhelming the server
    return {
      remaining: 100,
      resetTime: new Date(Date.now() + 60000), // Reset every minute
      limit: 100
    };
  }

  // Setup webhooks for real-time updates
  async setupWebhooks(webhookUrl: string, secret: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not authenticated with WooCommerce');
    }

    const webhookTopics = [
      'order.created',
      'order.updated',
      'order.deleted',
      'customer.created',
      'customer.updated',
      'product.created',
      'product.updated'
    ];

    for (const topic of webhookTopics) {
      try {
        await this.createWebhook(topic, webhookUrl, secret);
        logger.info(`Created WooCommerce webhook for ${topic}`);
      } catch (error) {
        logger.error(`Failed to create webhook for ${topic}:`, error);
      }
    }
  }

  private async createWebhook(topic: string, deliveryUrl: string, secret: string): Promise<void> {
    if (!this.credentials) return;

    const webhookData = {
      name: `Sales Tax Tracker - ${topic}`,
      topic,
      delivery_url: `${deliveryUrl}?topic=${topic}`,
      secret
    };

    const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }
  }

  private async listWebhooks(): Promise<Array<{ id: number; delivery_url: string }>> {
    if (!this.credentials) return [];

    const response = await fetch(`${this.baseUrl}/wp-json/wc/v3/webhooks`, {
      headers: {
        'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const webhooks = await response.json();
    return webhooks || [];
  }

  private async deleteWebhook(webhookId: number): Promise<void> {
    if (!this.credentials) return;

    await fetch(`${this.baseUrl}/wp-json/wc/v3/webhooks/${webhookId}?force=true`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(`${this.credentials.consumerKey}:${this.credentials.consumerSecret}`)}`,
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
      
      return computedSignature === signature;
    } catch (error) {
      logger.error('Failed to verify webhook signature:', error);
      return false;
    }
  }

  private async processOrderWebhook(orderData: WooCommerceOrder): Promise<void> {
    try {
      // Convert to our standard transaction format
      const transaction = this.mapWooCommerceOrderToTransaction(orderData);
      
      // Calculate taxes if not already calculated or if total_tax is 0
      if (!orderData.total_tax || parseFloat(orderData.total_tax) === 0) {
        if (orderData.line_items.length > 0 && (orderData.shipping.address_1 || orderData.billing.address_1)) {
          const shippingAddress = orderData.shipping.address_1 ? 
            this.mapWooCommerceAddress(orderData.shipping) : 
            this.mapWooCommerceAddress(orderData.billing);

          const taxRequest: TaxCalculationRequest = {
            transactionId: transaction.id,
            customerId: transaction.customerId,
            items: transaction.items,
            shippingAddress,
            billingAddress: this.mapWooCommerceAddress(orderData.billing),
            shippingAmount: parseFloat(orderData.shipping_total || '0'),
            discountAmount: parseFloat(orderData.discount_total || '0')
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

      logger.info(`Processed order webhook for WooCommerce order ${orderData.id}`);
    } catch (error) {
      logger.error('Failed to process order webhook:', error);
    }
  }

  private mapWooCommerceOrderToTransaction(order: WooCommerceOrder): Transaction {
    return {
      id: `woocommerce_${order.id}`,
      externalId: order.id.toString(),
      date: new Date(order.date_created),
      amount: parseFloat(order.total),
      currency: order.currency,
      customerId: order.customer_id ? `woocommerce_${order.customer_id}` : '',
      items: order.line_items.map(item => ({
        id: `woocommerce_${item.id}`,
        productId: `woocommerce_${item.product_id}`,
        sku: item.sku || `woocommerce_${item.product_id}`,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: parseFloat(item.total),
        taxAmount: parseFloat(item.total_tax || '0'),
        taxCategory: item.tax_class === '' ? 'standard' : item.tax_class
      })),
      shippingAddress: this.mapWooCommerceAddress(order.shipping),
      billingAddress: this.mapWooCommerceAddress(order.billing),
      taxAmount: parseFloat(order.total_tax),
      status: this.mapWooCommerceOrderStatus(order.status),
      metadata: {
        woocommerceOrderKey: order.order_key,
        paymentMethod: order.payment_method,
        transactionId: order.transaction_id,
        customerNote: order.customer_note
      }
    };
  }

  private mapWooCommerceAddress(address: any): Address {
    return {
      street1: address.address_1 || '',
      street2: address.address_2,
      city: address.city || '',
      state: address.state || '',
      zipCode: address.postcode || '',
      country: address.country || 'US'
    };
  }

  private mapWooCommerceOrderStatus(status: string): Transaction['status'] {
    switch (status) {
      case 'completed':
      case 'processing':
        return 'completed';
      case 'cancelled':
      case 'failed':
        return 'cancelled';
      case 'refunded':
        return 'refunded';
      case 'pending':
      case 'on-hold':
      default:
        return 'pending';
    }
  }
}
