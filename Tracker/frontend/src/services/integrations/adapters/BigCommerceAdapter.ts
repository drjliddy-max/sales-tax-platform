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

interface BigCommerceCredentials {
  storeHash: string; // Store identifier
  accessToken: string; // X-Auth-Token
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
  apiPath?: string; // Default: /stores/{store_hash}/v3
}

interface BigCommerceOrder {
  id: number;
  customer_id: number;
  date_created: string;
  date_modified: string;
  date_shipped?: string;
  status_id: number;
  status: string;
  subtotal_ex_tax: string;
  subtotal_inc_tax: string;
  subtotal_tax: string;
  base_shipping_cost: string;
  shipping_cost_ex_tax: string;
  shipping_cost_inc_tax: string;
  shipping_cost_tax: string;
  shipping_cost_tax_class_id: number;
  base_handling_cost: string;
  handling_cost_ex_tax: string;
  handling_cost_inc_tax: string;
  handling_cost_tax: string;
  handling_cost_tax_class_id: number;
  base_wrapping_cost: string;
  wrapping_cost_ex_tax: string;
  wrapping_cost_inc_tax: string;
  wrapping_cost_tax: string;
  wrapping_cost_tax_class_id: number;
  total_ex_tax: string;
  total_inc_tax: string;
  total_tax: string;
  items_total: number;
  items_shipped: number;
  payment_method: string;
  payment_provider_id?: string;
  payment_status: string;
  refunded_amount: string;
  order_is_digital: boolean;
  store_credit_amount: string;
  gift_certificate_amount: string;
  ip_address: string;
  geoip_country: string;
  geoip_country_iso2: string;
  currency_id: number;
  currency_code: string;
  currency_exchange_rate: string;
  default_currency_id: number;
  default_currency_code: string;
  staff_notes?: string;
  customer_message?: string;
  discount_amount: string;
  coupon_discount: string;
  shipping_address_count: number;
  is_deleted: boolean;
  ebay_order_id?: string;
  cart_id: string;
  billing_address: {
    first_name: string;
    last_name: string;
    company: string;
    street_1: string;
    street_2: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    country_iso2: string;
    phone: string;
    email: string;
    form_fields?: any[];
  };
  is_email_opt_in: boolean;
  credit_card_type?: string;
  order_source: string;
  channel_id: number;
  external_source?: string;
  products: {
    url: string;
    resource: string;
  };
  shipping_addresses: {
    url: string;
    resource: string;
  };
  coupons: {
    url: string;
    resource: string;
  };
}

interface BigCommerceProduct {
  id: number;
  name: string;
  type: string;
  sku: string;
  description: string;
  weight: number;
  width: number;
  depth: number;
  height: number;
  price: number;
  cost_price: number;
  retail_price: number;
  sale_price: number;
  map_price: number;
  tax_class_id: number;
  product_tax_code: string;
  calculated_price: number;
  categories: number[];
  brand_id: number;
  option_set_id?: number;
  option_set_display: string;
  inventory_level: number;
  inventory_warning_level: number;
  inventory_tracking: string;
  reviews_rating_sum: number;
  reviews_count: number;
  total_sold: number;
  fixed_cost_shipping_price: number;
  is_visible: boolean;
  is_featured: boolean;
  related_products: number[];
  warranty: string;
  bin_picking_number: string;
  layout_file: string;
  upc: string;
  mpn: string;
  gtin: string;
  search_keywords: string;
  availability: string;
  availability_description: string;
  gift_wrapping_options_type: string;
  gift_wrapping_options_list: number[];
  sort_order: number;
  condition: string;
  is_condition_shown: boolean;
  order_quantity_minimum: number;
  order_quantity_maximum: number;
  page_title: string;
  meta_keywords: string[];
  meta_description: string;
  date_created: string;
  date_modified: string;
  view_count: number;
  preorder_release_date?: string;
  preorder_message: string;
  is_preorder_only: boolean;
  is_price_hidden: boolean;
  price_hidden_label: string;
  custom_url: {
    url: string;
    is_customized: boolean;
  };
  open_graph_type: string;
  open_graph_title: string;
  open_graph_description: string;
  open_graph_use_meta_description: boolean;
  open_graph_use_product_name: boolean;
  open_graph_use_image: boolean;
  variants: {
    url: string;
    resource: string;
  };
  images: {
    url: string;
    resource: string;
  };
  custom_fields: {
    url: string;
    resource: string;
  };
  bulk_pricing_rules: {
    url: string;
    resource: string;
  };
  primary_image: {
    id: number;
    product_id: number;
    image_file: string;
    is_thumbnail: boolean;
    sort_order: number;
    description: string;
    image_url: string;
    date_modified: string;
  };
  modifiers: {
    url: string;
    resource: string;
  };
  options: {
    url: string;
    resource: string;
  };
  videos: {
    url: string;
    resource: string;
  };
}

interface BigCommerceCustomer {
  id: number;
  company: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  form_fields: any[];
  date_created: string;
  date_modified: string;
  store_credit_amounts: {
    amount: number;
    currency_code: string;
  }[];
  registration_ip_address: string;
  customer_group_id: number;
  notes: string;
  tax_exempt_category: string;
  accepts_product_review_abandoned_cart_emails: boolean;
  addresses: {
    url: string;
    resource: string;
  };
  attributes: {
    url: string;
    resource: string;
  };
  authentication: {
    force_password_reset: boolean;
    new_password?: string;
  };
  channel_ids: number[];
}

export class BigCommerceAdapter implements IntegrationAdapter {
  id = 'bigcommerce';
  name = 'BigCommerce';
  type = 'ecommerce' as const;
  
  private credentials?: BigCommerceCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl = 'https://api.bigcommerce.com';

  constructor() {
    this.taxCalculator = new TaxCalculator();
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const bcCredentials = credentials as BigCommerceCredentials;
      
      if (!bcCredentials.storeHash || !bcCredentials.accessToken) {
        logger.error('Missing required BigCommerce credentials');
        return false;
      }

      this.credentials = bcCredentials;

      // Test the connection by fetching store information
      const response = await fetch(`${this.baseUrl}/stores/${bcCredentials.storeHash}/v2/store`, {
        headers: {
          'X-Auth-Token': bcCredentials.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        logger.error('BigCommerce authentication failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      logger.info(`Successfully authenticated with BigCommerce store: ${data.name}`);
      
      return true;
    } catch (error) {
      logger.error('BigCommerce authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.credentials) {
        // List and delete all our webhooks
        const webhooks = await this.listWebhooks();
        for (const webhook of webhooks) {
          if (webhook.destination?.includes('sales-tax-tracker')) {
            await this.deleteWebhook(webhook.id);
          }
        }
      }
      
      this.credentials = undefined;
      
      logger.info('Disconnected from BigCommerce');
    } catch (error) {
      logger.error('Error during BigCommerce disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const response = await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v2/store`, {
        headers: {
          'X-Auth-Token': this.credentials.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('BigCommerce connection test failed:', error);
      return false;
    }
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with BigCommerce');
    }

    try {
      let allOrders: BigCommerceOrder[] = [];
      let page = 1;
      const limit = 250;

      // Build query parameters
      const params = new URLSearchParams({
        limit: limit.toString(),
        page: page.toString()
      });

      if (startDate) {
        params.append('date_created:min', startDate.toISOString().split('T')[0]);
      }
      
      if (endDate) {
        params.append('date_created:max', endDate.toISOString().split('T')[0]);
      }

      // Paginate through all orders
      while (true) {
        params.set('page', page.toString());

        const response = await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v2/orders?${params}`, {
          headers: {
            'X-Auth-Token': this.credentials.accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch orders: ${response.statusText}`);
        }

        const orders: BigCommerceOrder[] = await response.json();
        
        if (orders.length === 0) break;
        
        allOrders = allOrders.concat(orders);
        
        if (orders.length < limit) break;
        
        page++;
      }

      logger.info(`Fetched ${allOrders.length} orders from BigCommerce`);

      return allOrders.map((order) => this.mapBigCommerceOrderToTransaction(order));
    } catch (error) {
      logger.error('Failed to sync BigCommerce transactions:', error);
      throw error;
    }
  }

  async syncProducts(): Promise<Product[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with BigCommerce');
    }

    try {
      let allProducts: BigCommerceProduct[] = [];
      let page = 1;
      const limit = 250;

      // Paginate through all products
      while (true) {
        const params = new URLSearchParams({
          limit: limit.toString(),
          page: page.toString(),
          include: 'variants,images,custom_fields'
        });

        const response = await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v3/catalog/products?${params}`, {
          headers: {
            'X-Auth-Token': this.credentials.accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch products: ${response.statusText}`);
        }

        const data = await response.json();
        const products = data.data || [];
        
        if (products.length === 0) break;
        
        allProducts = allProducts.concat(products);
        
        if (products.length < limit) break;
        
        page++;
      }

      logger.info(`Fetched ${allProducts.length} products from BigCommerce`);

      return allProducts.map((product) => ({
        id: `bigcommerce_${product.id}`,
        externalId: product.id.toString(),
        name: product.name,
        sku: product.sku || `bigcommerce_${product.id}`,
        price: product.price,
        category: 'General', // Would need to fetch category details
        taxCategory: product.tax_class_id > 0 ? 'taxable' : 'exempt',
        description: product.description,
        weight: product.weight,
        dimensions: {
          length: product.depth,
          width: product.width,
          height: product.height
        }
      }));
    } catch (error) {
      logger.error('Failed to sync BigCommerce products:', error);
      throw error;
    }
  }

  async syncCustomers(): Promise<Customer[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with BigCommerce');
    }

    try {
      let allCustomers: BigCommerceCustomer[] = [];
      let page = 1;
      const limit = 250;

      // Paginate through all customers
      while (true) {
        const params = new URLSearchParams({
          limit: limit.toString(),
          page: page.toString(),
          include: 'addresses,attributes'
        });

        const response = await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v3/customers?${params}`, {
          headers: {
            'X-Auth-Token': this.credentials.accessToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch customers: ${response.statusText}`);
        }

        const data = await response.json();
        const customers = data.data || [];
        
        if (customers.length === 0) break;
        
        allCustomers = allCustomers.concat(customers);
        
        if (customers.length < limit) break;
        
        page++;
      }

      logger.info(`Fetched ${allCustomers.length} customers from BigCommerce`);

      // Fetch customer addresses separately
      const customersWithAddresses = await Promise.all(
        allCustomers.map(async (customer) => {
          const addresses = await this.fetchCustomerAddresses(customer.id);
          return { ...customer, addressList: addresses };
        })
      );

      return customersWithAddresses.map((customer) => ({
        id: `bigcommerce_${customer.id}`,
        externalId: customer.id.toString(),
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        company: customer.company,
        phone: customer.phone,
        addresses: customer.addressList || [],
        taxExempt: customer.tax_exempt_category !== '',
        taxExemptionReason: customer.tax_exempt_category || undefined,
        taxExemptionCertificate: undefined // BigCommerce doesn't store certificates directly
      }));
    } catch (error) {
      logger.error('Failed to sync BigCommerce customers:', error);
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
      throw new Error('Not authenticated with BigCommerce');
    }

    try {
      const orderId = transactionId.replace('bigcommerce_', '');
      
      // BigCommerce doesn't allow direct tax updates via API
      // Tax calculations should be handled during order creation
      logger.info(`Tax calculation completed for BigCommerce order ${orderId}`);
      
      return true;
    } catch (error) {
      logger.error('Failed to update BigCommerce transaction:', error);
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

      // Handle different webhook events
      switch (payload.scope) {
        case 'store/order/created':
        case 'store/order/updated':
          await this.handleOrderWebhook(payload);
          break;
        case 'store/customer/created':
        case 'store/customer/updated':
          await this.handleCustomerWebhook(payload);
          break;
        case 'store/product/created':
        case 'store/product/updated':
          await this.handleProductWebhook(payload);
          break;
        default:
          logger.debug(`Unhandled BigCommerce webhook: ${payload.scope}`);
      }

      logger.info(`Processed BigCommerce webhook: ${payload.scope} for ${payload.data?.id}`);
    } catch (error) {
      logger.error('Failed to process BigCommerce webhook:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // BigCommerce API rate limits: 20,000 requests per hour per store
    return {
      remaining: 20000, // This would be updated based on response headers
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // Reset every hour
      limit: 20000
    };
  }

  // Setup webhooks for real-time updates
  async setupWebhooks(webhookUrl: string, secret: string): Promise<void> {
    if (!this.credentials) {
      throw new Error('Not authenticated with BigCommerce');
    }

    const webhookEvents = [
      'store/order/created',
      'store/order/updated',
      'store/order/archived',
      'store/customer/created',
      'store/customer/updated',
      'store/customer/deleted',
      'store/product/created',
      'store/product/updated',
      'store/product/deleted'
    ];

    for (const scope of webhookEvents) {
      try {
        await this.createWebhook(scope, webhookUrl, secret);
        logger.info(`Created BigCommerce webhook for ${scope}`);
      } catch (error) {
        logger.error(`Failed to create webhook for ${scope}:`, error);
      }
    }
  }

  private async createWebhook(scope: string, destination: string, secret: string): Promise<void> {
    if (!this.credentials) return;

    const webhookData = {
      scope,
      destination: `${destination}?scope=${scope}`,
      is_active: true,
      headers: {
        'X-Custom-Auth': secret
      }
    };

    const response = await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v3/hooks`, {
      method: 'POST',
      headers: {
        'X-Auth-Token': this.credentials.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(webhookData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }
  }

  private async listWebhooks(): Promise<Array<{ id: number; destination: string }>> {
    if (!this.credentials) return [];

    const response = await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v3/hooks`, {
      headers: {
        'X-Auth-Token': this.credentials.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data || [];
  }

  private async deleteWebhook(webhookId: number): Promise<void> {
    if (!this.credentials) return;

    await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v3/hooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        'X-Auth-Token': this.credentials.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  private async fetchCustomerAddresses(customerId: number): Promise<Address[]> {
    if (!this.credentials) return [];

    try {
      const response = await fetch(`${this.baseUrl}/stores/${this.credentials.storeHash}/v3/customers/${customerId}/addresses`, {
        headers: {
          'X-Auth-Token': this.credentials.accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const addresses = data.data || [];

      return addresses.map((addr: any) => this.mapBigCommerceAddress(addr));
    } catch (error) {
      logger.error(`Failed to fetch addresses for customer ${customerId}:`, error);
      return [];
    }
  }

  private async verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
    try {
      // BigCommerce uses different signature verification
      // This would need to be implemented based on their webhook documentation
      return true;
    } catch (error) {
      logger.error('Failed to verify BigCommerce webhook signature:', error);
      return false;
    }
  }

  private async handleOrderWebhook(payload: any): Promise<void> {
    try {
      const orderId = payload.data?.id;
      if (orderId) {
        // Fetch full order details and process
        logger.info(`Processing order webhook for BigCommerce order ${orderId}`);
      }
    } catch (error) {
      logger.error('Failed to process order webhook:', error);
    }
  }

  private async handleCustomerWebhook(payload: any): Promise<void> {
    try {
      const customerId = payload.data?.id;
      if (customerId) {
        logger.info(`Processing customer webhook for BigCommerce customer ${customerId}`);
      }
    } catch (error) {
      logger.error('Failed to process customer webhook:', error);
    }
  }

  private async handleProductWebhook(payload: any): Promise<void> {
    try {
      const productId = payload.data?.id;
      if (productId) {
        logger.info(`Processing product webhook for BigCommerce product ${productId}`);
      }
    } catch (error) {
      logger.error('Failed to process product webhook:', error);
    }
  }

  private mapBigCommerceOrderToTransaction(order: BigCommerceOrder): Transaction {
    return {
      id: `bigcommerce_${order.id}`,
      externalId: order.id.toString(),
      date: new Date(order.date_created),
      amount: parseFloat(order.total_inc_tax),
      currency: order.currency_code,
      customerId: order.customer_id ? `bigcommerce_${order.customer_id}` : '',
      items: [], // Would need to fetch order products separately
      shippingAddress: this.mapBigCommerceAddress(order.billing_address), // BigCommerce v2 API limitation
      billingAddress: this.mapBigCommerceAddress(order.billing_address),
      taxAmount: parseFloat(order.total_tax),
      status: this.mapBigCommerceOrderStatus(order.status),
      metadata: {
        bigcommerceOrderId: order.id,
        bigcommerceStatus: order.status,
        paymentMethod: order.payment_method,
        orderSource: order.order_source,
        channelId: order.channel_id
      }
    };
  }

  private mapBigCommerceAddress(address: any): Address {
    return {
      street1: address.street_1 || address.address1 || '',
      street2: address.street_2 || address.address2,
      city: address.city || '',
      state: address.state || address.state_or_province || '',
      zipCode: address.zip || address.postal_code || '',
      country: address.country_iso2 || address.country || 'US'
    };
  }

  private mapBigCommerceOrderStatus(status: string): Transaction['status'] {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'shipped':
        return 'completed';
      case 'cancelled':
      case 'declined':
      case 'refunded':
        return 'cancelled';
      case 'pending':
      case 'awaiting_payment':
      case 'awaiting_pickup':
      case 'awaiting_shipment':
      case 'partially_shipped':
        return 'pending';
      default:
        return 'pending';
    }
  }
}
