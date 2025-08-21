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

interface SquareCredentials {
  accessToken: string;
  refreshToken?: string;
  applicationId: string;
  locationId: string; // Primary location ID
  environment: 'sandbox' | 'production';
  expiresAt?: Date;
  scope?: string;
}

interface SquarePayment {
  id: string;
  created_at: string;
  updated_at: string;
  amount_money: {
    amount: number;
    currency: string;
  };
  tip_money?: {
    amount: number;
    currency: string;
  };
  total_money: {
    amount: number;
    currency: string;
  };
  app_fee_money?: {
    amount: number;
    currency: string;
  };
  approved_money?: {
    amount: number;
    currency: string;
  };
  processing_fee?: Array<{
    effective_at?: string;
    type?: string;
    amount_money?: {
      amount: number;
      currency: string;
    };
  }>;
  refunded_money?: {
    amount: number;
    currency: string;
  };
  status: 'APPROVED' | 'PENDING' | 'COMPLETED' | 'CANCELED' | 'FAILED';
  delay_duration?: string;
  delay_action?: string;
  delayed_until?: string;
  source_type: 'CARD' | 'CASH' | 'EXTERNAL' | 'SQUARE_ACCOUNT' | 'SQUARE_CAPITAL' | 'BANK_ACCOUNT' | 'WALLET' | 'BUY_NOW_PAY_LATER';
  card_details?: {
    status: string;
    card: {
      card_brand?: string;
      last_4?: string;
      exp_month?: number;
      exp_year?: number;
      fingerprint?: string;
      card_type?: string;
      prepaid_type?: string;
      bin?: string;
    };
    entry_method?: string;
    cvv_status?: string;
    avs_status?: string;
    auth_result_code?: string;
    application_identifier?: string;
    application_name?: string;
    application_cryptogram?: string;
    verification_method?: string;
    verification_results?: string;
    statement_description?: string;
    device_details?: {
      device_id?: string;
      device_installation_id?: string;
      device_name?: string;
    };
  };
  cash_details?: {
    buyer_tendered_money: {
      amount: number;
      currency: string;
    };
    change_back_money?: {
      amount: number;
      currency: string;
    };
  };
  external_details?: {
    type: string;
    source: string;
    source_id?: string;
    source_fee_money?: {
      amount: number;
      currency: string;
    };
  };
  wallet_details?: {
    status?: string;
    brand?: string;
  };
  buy_now_pay_later_details?: {
    brand?: string;
    afterpay_details?: any;
    clearpay_details?: any;
  };
  application_details?: {
    square_product?: string;
    application_id?: string;
  };
  location_id: string;
  order_id?: string;
  reference_id?: string;
  customer_id?: string;
  employee_id?: string;
  team_member_id?: string;
  refund_ids?: string[];
  risk_evaluation?: {
    created_at?: string;
    risk_level?: 'PENDING' | 'NORMAL' | 'MODERATE' | 'HIGH';
  };
  buyer_email_address?: string;
  billing_address?: SquareAddress;
  shipping_address?: SquareAddress;
  note?: string;
  statement_description_identifier?: string;
  capabilities?: string[];
  receipt_number?: string;
  receipt_url?: string;
  device_details?: {
    device_id?: string;
    device_installation_id?: string;
    device_name?: string;
  };
  version_token?: string;
}

interface SquareOrder {
  id: string;
  location_id: string;
  reference_id?: string;
  source: {
    name?: string;
  };
  customer_id?: string;
  line_items?: SquareOrderLineItem[];
  taxes?: Array<{
    uid?: string;
    name?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
    rate?: string;
    inclusion_type?: 'ADDITIVE' | 'INCLUSIVE';
    type?: 'UNKNOWN_TAX' | 'ADDITIVE' | 'INCLUSIVE';
    scope?: 'OTHER_TAX_SCOPE' | 'LINE_ITEM' | 'ORDER';
  }>;
  discounts?: Array<{
    uid?: string;
    name?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
    type?: 'FIXED_PERCENTAGE' | 'FIXED_AMOUNT' | 'VARIABLE_PERCENTAGE' | 'VARIABLE_AMOUNT';
    percentage?: string;
    amount_money?: {
      amount: number;
      currency: string;
    };
    scope?: 'OTHER_DISCOUNT_SCOPE' | 'LINE_ITEM' | 'ORDER';
  }>;
  service_charges?: Array<{
    uid?: string;
    name?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
    total_money?: {
      amount: number;
      currency: string;
    };
    total_tax_money?: {
      amount: number;
      currency: string;
    };
    calculation_phase?: 'SUBTOTAL_PHASE' | 'TOTAL_PHASE';
    taxable?: boolean;
    type?: 'AUTO_GRATUITY' | 'CUSTOM';
    percentage?: string;
    amount_money?: {
      amount: number;
      currency: string;
    };
  }>;
  fulfillments?: Array<{
    uid?: string;
    type?: 'PICKUP' | 'SHIPMENT' | 'DELIVERY';
    state?: 'PROPOSED' | 'RESERVED' | 'PREPARED' | 'COMPLETED' | 'CANCELED' | 'FAILED';
    line_item_application?: 'ALL' | 'ENTRY_LIST';
    entries?: Array<{
      uid?: string;
      line_item_uid?: string;
      quantity?: string;
      metadata?: Record<string, string>;
    }>;
    metadata?: Record<string, string>;
    pickup_details?: {
      recipient?: {
        display_name?: string;
        email_address?: string;
        phone_number?: string;
      };
      expires_at?: string;
      auto_complete_duration?: string;
      schedule_type?: 'SCHEDULED' | 'ASAP';
      pickup_at?: string;
      pickup_window_duration?: string;
      prep_time_duration?: string;
      note?: string;
      placed_at?: string;
      accepted_at?: string;
      rejected_at?: string;
      ready_at?: string;
      expired_at?: string;
      picked_up_at?: string;
      canceled_at?: string;
      cancel_reason?: string;
      is_curbside_pickup?: boolean;
      curbside_pickup_details?: {
        curbside_details?: string;
        buyer_arrived_at?: string;
      };
    };
    shipment_details?: {
      recipient?: {
        display_name?: string;
        email_address?: string;
        phone_number?: string;
        address?: SquareAddress;
      };
      carrier?: string;
      shipping_note?: string;
      shipping_type?: string;
      tracking_number?: string;
      tracking_url?: string;
      placed_at?: string;
      in_progress_at?: string;
      packaged_at?: string;
      expected_shipped_at?: string;
      shipped_at?: string;
      canceled_at?: string;
      cancel_reason?: string;
      failed_at?: string;
      failure_reason?: string;
    };
    delivery_details?: {
      recipient?: {
        display_name?: string;
        email_address?: string;
        phone_number?: string;
        address?: SquareAddress;
      };
      schedule_type?: 'SCHEDULED' | 'ASAP';
      placed_at?: string;
      deliver_at?: string;
      prep_time_duration?: string;
      delivery_window_duration?: string;
      note?: string;
      completed_at?: string;
      in_progress_at?: string;
      rejected_at?: string;
      ready_at?: string;
      delivered_at?: string;
      canceled_at?: string;
      cancel_reason?: string;
      courier_pickup_at?: string;
      courier_pickup_window_duration?: string;
      is_no_contact_delivery?: boolean;
      dropoff_notes?: string;
      courier_provider_name?: string;
      courier_support_phone_number?: string;
      square_delivery_id?: string;
      external_delivery_id?: string;
      managed_delivery?: boolean;
    };
  }>;
  return_amounts?: {
    total_money?: {
      amount: number;
      currency: string;
    };
    tax_money?: {
      amount: number;
      currency: string;
    };
    discount_money?: {
      amount: number;
      currency: string;
    };
    tip_money?: {
      amount: number;
      currency: string;
    };
    service_charge_money?: {
      amount: number;
      currency: string;
    };
  };
  net_amounts: {
    base_price_money?: {
      amount: number;
      currency: string;
    };
    discount_money?: {
      amount: number;
      currency: string;
    };
    tax_money?: {
      amount: number;
      currency: string;
    };
    tip_money?: {
      amount: number;
      currency: string;
    };
    service_charge_money?: {
      amount: number;
      currency: string;
    };
    total_money?: {
      amount: number;
      currency: string;
    };
  };
  rounding_adjustment?: {
    uid?: string;
    name?: string;
    amount_money?: {
      amount: number;
      currency: string;
    };
  };
  tenders?: Array<{
    id?: string;
    location_id?: string;
    transaction_id?: string;
    created_at?: string;
    note?: string;
    amount_money?: {
      amount: number;
      currency: string;
    };
    tip_money?: {
      amount: number;
      currency: string;
    };
    processing_fee_money?: {
      amount: number;
      currency: string;
    };
    customer_id?: string;
    type: 'CARD' | 'CASH' | 'THIRD_PARTY_CARD' | 'SQUARE_GIFT_CARD' | 'NO_SALE' | 'WALLET' | 'OTHER';
    card_details?: {
      status?: string;
      card?: {
        card_brand?: string;
        last_4?: string;
        exp_month?: number;
        exp_year?: number;
        cardholder_name?: string;
        billing_address?: SquareAddress;
        fingerprint?: string;
        customer_id?: string;
        merchant_token?: string;
        reference_id?: string;
        enabled?: boolean;
        card_type?: string;
        prepaid_type?: string;
        bin?: string;
        version?: number;
        card_co_brand?: string;
      };
      entry_method?: string;
    };
    cash_details?: {
      buyer_tendered_money?: {
        amount: number;
        currency: string;
      };
      change_back_money?: {
        amount: number;
        currency: string;
      };
    };
    additional_recipients?: Array<{
      location_id?: string;
      description?: string;
      amount_money?: {
        amount: number;
        currency: string;
      };
      receivable_id?: string;
    }>;
    payment_id?: string;
  }>;
  refunds?: Array<{
    id?: string;
    location_id?: string;
    transaction_id?: string;
    tender_id?: string;
    created_at?: string;
    reason?: string;
    amount_money?: {
      amount: number;
      currency: string;
    };
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';
    processing_fee_money?: {
      amount: number;
      currency: string;
    };
    additional_recipients?: Array<{
      location_id?: string;
      description?: string;
      amount_money?: {
        amount: number;
        currency: string;
      };
      receivable_id?: string;
    }>;
  }>;
  metadata?: Record<string, string>;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  state: 'OPEN' | 'COMPLETED' | 'CANCELED' | 'DRAFT';
  version: number;
  total_money?: {
    amount: number;
    currency: string;
  };
  total_tax_money?: {
    amount: number;
    currency: string;
  };
  total_discount_money?: {
    amount: number;
    currency: string;
  };
  total_tip_money?: {
    amount: number;
    currency: string;
  };
  total_service_charge_money?: {
    amount: number;
    currency: string;
  };
  ticket_name?: string;
  pricing_options?: {
    auto_apply_discounts?: boolean;
    auto_apply_taxes?: boolean;
  };
  rewards?: Array<{
    id?: string;
    reward_tier_id?: string;
  }>;
}

interface SquareOrderLineItem {
  uid?: string;
  name?: string;
  quantity: string;
  item_type?: 'ITEM' | 'CUSTOM_AMOUNT' | 'GIFT_CARD';
  base_price_money?: {
    amount: number;
    currency: string;
  };
  gross_sales_money?: {
    amount: number;
    currency: string;
  };
  total_tax_money?: {
    amount: number;
    currency: string;
  };
  total_discount_money?: {
    amount: number;
    currency: string;
  };
  total_money?: {
    amount: number;
    currency: string;
  };
  variation_total_price_money?: {
    amount: number;
    currency: string;
  };
  note?: string;
  catalog_object_id?: string;
  catalog_version?: number;
  variation_name?: string;
  item_variation_vendor_code?: string;
  metadata?: Record<string, string>;
  modifiers?: Array<{
    uid?: string;
    catalog_object_id?: string;
    catalog_version?: number;
    name?: string;
    base_price_money?: {
      amount: number;
      currency: string;
    };
    total_price_money?: {
      amount: number;
      currency: string;
    };
    metadata?: Record<string, string>;
  }>;
  applied_taxes?: Array<{
    uid?: string;
    tax_uid?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
  }>;
  applied_discounts?: Array<{
    uid?: string;
    discount_uid?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
  }>;
  applied_service_charges?: Array<{
    uid?: string;
    service_charge_uid?: string;
    applied_money?: {
      amount: number;
      currency: string;
    };
  }>;
}

interface SquareCustomer {
  id: string;
  created_at: string;
  updated_at: string;
  cards?: Array<{
    id?: string;
    card_brand?: string;
    last_4?: string;
    exp_month?: number;
    exp_year?: number;
    cardholder_name?: string;
    billing_address?: SquareAddress;
    fingerprint?: string;
    customer_id?: string;
    merchant_token?: string;
    reference_id?: string;
    enabled?: boolean;
    card_type?: string;
    prepaid_type?: string;
    bin?: string;
    version?: number;
    card_co_brand?: string;
  }>;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  company_name?: string;
  email_address?: string;
  address?: SquareAddress;
  phone_number?: string;
  birthday?: string;
  reference_id?: string;
  note?: string;
  preferences?: {
    email_unsubscribed?: boolean;
  };
  creation_source?: 'THIRD_PARTY' | 'SQUARE' | 'SQUARE_DASHBOARD' | 'SQUARE_POINT_OF_SALE' | 'SQUARE_VIRTUAL_TERMINAL' | 'WEB' | 'DIRECTORY' | 'WALKUP' | 'SQUARE_KIOSK' | 'SQUARE_APPOINTMENTS' | 'INVOICES' | 'CUSTOMERS_API' | 'PAYROLL' | 'SQUARE_ONLINE_STORE' | 'SQUARE_CARD' | 'SQUARE_MARKETING' | 'SQUARE_BANKING' | 'BOOKINGS' | 'APPOINTMENTS' | 'ACCRUAL_LOYALTY_PROGRAM' | 'SQUARE_CAPITAL' | 'AFTERPAY' | 'CLEARPAY' | 'SQUARE_CHECKOUT' | 'SQUARE_ECOMMERCE_API' | 'UNKNOWN' | 'OTHER';
  group_ids?: string[];
  segment_ids?: string[];
  version?: number;
  tax_ids?: {
    eu_vat?: string;
  };
}

interface SquareAddress {
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
  locality?: string;
  sublocality?: string;
  sublocality_2?: string;
  sublocality_3?: string;
  administrative_district_level_1?: string;
  administrative_district_level_2?: string;
  administrative_district_level_3?: string;
  postal_code?: string;
  country?: string;
  first_name?: string;
  last_name?: string;
  organization?: string;
}

interface SquareCatalogItem {
  type: 'ITEM' | 'IMAGE' | 'CATEGORY' | 'ITEM_VARIATION' | 'TAX' | 'DISCOUNT' | 'MODIFIER_LIST' | 'MODIFIER' | 'PRICING_RULE' | 'PRODUCT_SET' | 'TIME_PERIOD' | 'MEASUREMENT_UNIT' | 'SUBSCRIPTION_PLAN' | 'ITEM_OPTION' | 'ITEM_OPTION_VAL' | 'CUSTOM_ATTRIBUTE_DEFINITION' | 'QUICK_AMOUNTS_SETTINGS' | 'SUBSCRIPTION_PLAN_VARIATION';
  id: string;
  updated_at?: string;
  created_at?: string;
  version?: number;
  is_deleted?: boolean;
  custom_attribute_values?: Record<string, any>;
  catalog_v1_ids?: Array<{
    catalog_v1_id?: string;
    location_id?: string;
  }>;
  present_at_all_locations?: boolean;
  present_at_location_ids?: string[];
  absent_at_location_ids?: string[];
  item_data?: {
    name?: string;
    description?: string;
    abbreviation?: string;
    label_color?: string;
    available_online?: boolean;
    available_for_pickup?: boolean;
    available_electronically?: boolean;
    category_id?: string;
    tax_ids?: string[];
    modifier_list_info?: Array<{
      modifier_list_id?: string;
      modifier_overrides?: Array<{
        modifier_id?: string;
        on_by_default?: boolean;
      }>;
      min_selected_modifiers?: number;
      max_selected_modifiers?: number;
      enabled?: boolean;
    }>;
    variations?: SquareCatalogItemVariation[];
    product_type?: 'REGULAR' | 'GIFT_CARD' | 'APPOINTMENTS_SERVICE' | 'RETAIL_ITEM' | 'RESTAURANT_ITEM';
    skip_modifier_screen?: boolean;
    item_options?: Array<{
      item_option_id?: string;
    }>;
    image_ids?: string[];
    sort_name?: string;
    description_html?: string;
    description_plaintext?: string;
    channels?: string[];
    is_taxable?: boolean;
    ecom_available?: boolean;
    ecom_visibility?: 'UNINDEXED' | 'UNAVAILABLE' | 'HIDDEN' | 'VISIBLE';
    ecom_seo_data?: {
      seo_title?: string;
      seo_description?: string;
    };
    food_and_beverage_details?: {
      calorie_details?: {
        calories?: number;
        calories_from_fat?: number;
      };
      dietary_preferences?: Array<{
        type?: 'DAIRY_FREE' | 'GLUTEN_FREE' | 'HALAL' | 'KOSHER' | 'NUT_FREE' | 'VEGAN' | 'VEGETARIAN';
        standard_name?: string;
        custom_name?: string;
      }>;
      ingredients?: Array<{
        type?: 'STANDARD' | 'CUSTOM';
        standard_name?: string;
        custom_name?: string;
      }>;
    };
  };
}

interface SquareCatalogItemVariation {
  type?: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  version?: number;
  is_deleted?: boolean;
  custom_attribute_values?: Record<string, any>;
  catalog_v1_ids?: Array<{
    catalog_v1_id?: string;
    location_id?: string;
  }>;
  item_variation_data?: {
    item_id?: string;
    name?: string;
    sku?: string;
    upc?: string;
    ordinal?: number;
    pricing_type?: 'FIXED_PRICING' | 'VARIABLE_PRICING';
    price_money?: {
      amount?: number;
      currency?: string;
    };
    location_overrides?: Array<{
      location_id?: string;
      price_money?: {
        amount?: number;
        currency?: string;
      };
      pricing_type?: 'FIXED_PRICING' | 'VARIABLE_PRICING';
      track_inventory?: boolean;
      inventory_alert_type?: 'NONE' | 'LOW_QUANTITY';
      inventory_alert_threshold?: number;
      sold_out?: boolean;
      sold_out_valid_until?: string;
    }>;
    track_inventory?: boolean;
    inventory_alert_type?: 'NONE' | 'LOW_QUANTITY';
    inventory_alert_threshold?: number;
    user_data?: string;
    service_duration?: number;
    available_for_booking?: boolean;
    item_option_values?: Array<{
      item_option_id?: string;
      item_option_value_id?: string;
    }>;
    measurement_unit_id?: string;
    sellable?: boolean;
    stockable?: boolean;
    image_ids?: string[];
    team_member_ids?: string[];
    stockable_conversion?: {
      stockable_item_variation_id?: string;
      stockable_quantity?: string;
      nonstockable_quantity?: string;
    };
  };
}

export class SquareAdapter implements IntegrationAdapter {
  id = 'square';
  name = 'Square';
  type = 'pos' as const;
  
  private credentials?: SquareCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl: string;

  constructor() {
    this.taxCalculator = new TaxCalculator();
    this.baseUrl = 'https://connect.squareup.com'; // Will be set based on environment
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const squareCredentials = credentials as SquareCredentials;
      
      if (!squareCredentials.accessToken || !squareCredentials.locationId || !squareCredentials.applicationId) {
        logger.error('Missing required Square credentials');
        return false;
      }

      this.credentials = squareCredentials;
      
      // Set the correct base URL based on environment
      this.baseUrl = squareCredentials.environment === 'sandbox' 
        ? 'https://connect.squareupsandbox.com' 
        : 'https://connect.squareup.com';

      // Test the connection by fetching location info
      const response = await fetch(`${this.baseUrl}/v2/locations/${squareCredentials.locationId}`, {
        headers: {
          'Authorization': `Bearer ${squareCredentials.accessToken}`,
          'Square-Version': '2023-10-18',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token might be expired, try to refresh if we have refresh token
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return await this.testConnection();
          }
        }
        logger.error('Square authentication failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      const location = data.location;
      logger.info(`Successfully authenticated with Square location: ${location?.name} (${location?.business_name})`);
      
      return true;
    } catch (error) {
      logger.error('Square authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Revoke tokens if possible
      if (this.credentials?.refreshToken && this.credentials?.applicationId) {
        await fetch(`${this.baseUrl}/oauth2/revoke`, {
          method: 'POST',
          headers: {
            'Authorization': `Client ${this.credentials.applicationId}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: this.credentials.applicationId,
            access_token: this.credentials.accessToken
          })
        });
      }
      
      this.credentials = undefined;
      
      logger.info('Disconnected from Square');
    } catch (error) {
      logger.error('Error during Square disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const response = await fetch(`${this.baseUrl}/v2/locations/${this.credentials.locationId}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Square-Version': '2023-10-18',
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('Square connection test failed:', error);
      return false;
    }
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Square');
    }

    try {
      // Fetch both payments and orders for comprehensive transaction data
      const payments = await this.fetchPayments(startDate, endDate);
      const orders = await this.fetchOrders(startDate, endDate);
      
      // Create a map of orders by ID for efficient lookup
      const orderMap = new Map(orders.map(order => [order.id, order]));

      const transactions = payments.map(payment => this.mapSquarePaymentToTransaction(payment, orderMap.get(payment.order_id || '')));

      logger.info(`Fetched ${transactions.length} transactions from Square`);

      return transactions;
    } catch (error) {
      logger.error('Failed to sync Square transactions:', error);
      throw error;
    }
  }

  async syncProducts(): Promise<Product[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Square');
    }

    try {
      let allItems: SquareCatalogItem[] = [];
      let cursor: string | undefined;

      // Paginate through all catalog items
      do {
        const params = new URLSearchParams({
          types: 'ITEM',
          include_related_objects: 'true'
        });

        if (cursor) {
          params.append('cursor', cursor);
        }

        const response = await fetch(`${this.baseUrl}/v2/catalog/list?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Square-Version': '2023-10-18',
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch catalog items: ${response.statusText}`);
        }

        const data = await response.json();
        const items = (data.objects || []).filter((obj: any) => obj.type === 'ITEM');
        
        allItems = allItems.concat(items);
        cursor = data.cursor;
        
      } while (cursor);

      logger.info(`Fetched ${allItems.length} items from Square catalog`);

      // Flatten variations into individual products
      const products: Product[] = [];
      
      for (const item of allItems) {
        if (item.item_data?.variations) {
          for (const variation of item.item_data.variations) {
            if (variation.item_variation_data) {
              products.push({
                id: `square_${variation.id}`,
                externalId: variation.id || '',
                name: `${item.item_data.name || ''} - ${variation.item_variation_data.name || ''}`.trim(),
                sku: variation.item_variation_data.sku || variation.item_variation_data.upc || '',
                price: (variation.item_variation_data.price_money?.amount || 0) / 100, // Square uses cents
                category: 'General', // Square doesn't have simple categories
                taxCategory: 'standard',
                description: item.item_data.description,
                weight: undefined, // Square doesn't track weight directly
                dimensions: undefined
              });
            }
          }
        }
      }

      return products;
    } catch (error) {
      logger.error('Failed to sync Square catalog items:', error);
      throw error;
    }
  }

  async syncCustomers(): Promise<Customer[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Square');
    }

    try {
      let allCustomers: SquareCustomer[] = [];
      let cursor: string | undefined;

      // Paginate through all customers
      do {
        const body: any = {
          limit: 100
        };

        if (cursor) {
          body.cursor = cursor;
        }

        const response = await fetch(`${this.baseUrl}/v2/customers/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Square-Version': '2023-10-18',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch customers: ${response.statusText}`);
        }

        const data = await response.json();
        const customers = data.customers || [];
        
        allCustomers = allCustomers.concat(customers);
        cursor = data.cursor;
        
      } while (cursor);

      logger.info(`Fetched ${allCustomers.length} customers from Square`);

      return allCustomers.map((customer) => ({
        id: `square_${customer.id}`,
        externalId: customer.id,
        email: customer.email_address || '',
        firstName: customer.given_name || '',
        lastName: customer.family_name || '',
        company: customer.company_name,
        phone: customer.phone_number,
        addresses: customer.address ? [this.mapSquareAddress(customer.address)] : [],
        taxExempt: false, // Square doesn't have built-in tax exemption
        taxExemptionReason: undefined,
        taxExemptionCertificate: customer.tax_ids?.eu_vat
      }));
    } catch (error) {
      logger.error('Failed to sync Square customers:', error);
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
      throw new Error('Not authenticated with Square');
    }

    try {
      const paymentId = transactionId.replace('square_', '');
      
      // Square payments are immutable after creation, but we can log the tax calculation
      logger.info(`Tax calculation completed for Square payment ${paymentId}`, {
        paymentId,
        taxData
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to update Square transaction:', error);
      return false;
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<void> {
    try {
      // Square webhook signature verification would go here
      // For now, we'll process the webhook payload
      
      const eventType = payload.type;
      const eventData = payload.data;
      
      switch (eventType) {
        case 'payment.created':
        case 'payment.updated':
          logger.info(`Square payment ${eventType}:`, eventData.id);
          break;
        case 'order.created':
        case 'order.updated':
          logger.info(`Square order ${eventType}:`, eventData.id);
          break;
        case 'customer.created':
        case 'customer.updated':
          logger.info(`Square customer ${eventType}:`, eventData.id);
          break;
        default:
          logger.info(`Unhandled Square webhook event: ${eventType}`);
      }

      logger.info(`Processed Square webhook: ${eventType}`);
    } catch (error) {
      logger.error('Failed to process Square webhook:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // Square API rate limits vary by endpoint but generally allow generous limits
    return {
      remaining: 1000, // This would be updated based on response headers
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // Reset hourly
      limit: 1000
    };
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.credentials?.refreshToken || !this.credentials?.applicationId) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: this.credentials.applicationId,
          client_secret: process.env.SQUARE_CLIENT_SECRET, // This should be securely stored
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken
        })
      });

      if (!response.ok) {
        logger.error('Failed to refresh Square token:', response.statusText);
        return false;
      }

      const data = await response.json();
      
      this.credentials.accessToken = data.access_token;
      if (data.refresh_token) {
        this.credentials.refreshToken = data.refresh_token;
      }
      this.credentials.expiresAt = new Date(Date.now() + (data.expires_at ? new Date(data.expires_at).getTime() - Date.now() : 30 * 24 * 60 * 60 * 1000));

      logger.info('Successfully refreshed Square access token');
      return true;
    } catch (error) {
      logger.error('Error refreshing Square token:', error);
      return false;
    }
  }

  private async fetchPayments(startDate?: Date, endDate?: Date): Promise<SquarePayment[]> {
    if (!this.credentials) return [];

    let allPayments: SquarePayment[] = [];
    let cursor: string | undefined;
    
    do {
      const body: any = {
        location_ids: [this.credentials.locationId],
        limit: 200
      };

      // Add date filters if provided
      if (startDate || endDate) {
        body.begin_time = startDate?.toISOString() || '2000-01-01T00:00:00.000Z';
        if (endDate) {
          body.end_time = endDate.toISOString();
        }
      }

      if (cursor) {
        body.cursor = cursor;
      }

      const response = await fetch(`${this.baseUrl}/v2/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Square-Version': '2023-10-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch payments: ${response.statusText}`);
      }

      const data = await response.json();
      const payments = data.payments || [];
      
      allPayments = allPayments.concat(payments);
      cursor = data.cursor;
      
    } while (cursor);

    return allPayments;
  }

  private async fetchOrders(startDate?: Date, endDate?: Date): Promise<SquareOrder[]> {
    if (!this.credentials) return [];

    let allOrders: SquareOrder[] = [];
    let cursor: string | undefined;
    
    do {
      const body: any = {
        location_ids: [this.credentials.locationId],
        limit: 500
      };

      // Add date filters if provided
      if (startDate || endDate) {
        body.query = {
          filter: {
            date_time_filter: {
              created_at: {
                start_at: startDate?.toISOString() || '2000-01-01T00:00:00.000Z'
              }
            }
          }
        };

        if (endDate) {
          body.query.filter.date_time_filter.created_at.end_at = endDate.toISOString();
        }
      }

      if (cursor) {
        body.cursor = cursor;
      }

      const response = await fetch(`${this.baseUrl}/v2/orders/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Square-Version': '2023-10-18',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const data = await response.json();
      const orders = data.orders || [];
      
      allOrders = allOrders.concat(orders);
      cursor = data.cursor;
      
    } while (cursor);

    return allOrders;
  }

  private mapSquarePaymentToTransaction(payment: SquarePayment, order?: SquareOrder): Transaction {
    return {
      id: `square_${payment.id}`,
      externalId: payment.id,
      date: new Date(payment.created_at),
      amount: payment.total_money.amount / 100, // Square uses cents
      currency: payment.total_money.currency,
      customerId: payment.customer_id ? `square_${payment.customer_id}` : undefined,
      items: order?.line_items?.map((item, index) => ({
        id: `square_line_${item.uid || index}`,
        productId: item.catalog_object_id ? `square_${item.catalog_object_id}` : '',
        sku: item.variation_name || '',
        name: item.name || '',
        quantity: parseInt(item.quantity) || 1,
        unitPrice: (item.base_price_money?.amount || 0) / 100,
        totalPrice: (item.total_money?.amount || 0) / 100,
        taxAmount: (item.total_tax_money?.amount || 0) / 100,
        taxCategory: 'standard'
      })) || [],
      shippingAddress: this.mapPaymentToAddress(payment),
      billingAddress: this.mapPaymentToAddress(payment),
      taxAmount: (order?.total_tax_money?.amount || 0) / 100,
      status: this.mapSquarePaymentStatus(payment.status),
      metadata: {
        squareLocationId: payment.location_id,
        squareOrderId: payment.order_id,
        squareReceiptNumber: payment.receipt_number,
        squareReceiptUrl: payment.receipt_url,
        squareSourceType: payment.source_type,
        squareApplicationDetails: payment.application_details,
        squareRiskEvaluation: payment.risk_evaluation
      }
    };
  }

  private mapPaymentToAddress(payment: SquarePayment): Address {
    const address = payment.shipping_address || payment.billing_address;
    
    if (!address) {
      return {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      };
    }

    return this.mapSquareAddress(address);
  }

  private mapSquareAddress(address: SquareAddress): Address {
    return {
      street1: address.address_line_1 || '',
      street2: address.address_line_2,
      city: address.locality || '',
      state: address.administrative_district_level_1 || '',
      zipCode: address.postal_code || '',
      country: address.country || 'US'
    };
  }

  private mapSquarePaymentStatus(status: string): Transaction['status'] {
    switch (status) {
      case 'COMPLETED':
      case 'APPROVED':
        return 'completed';
      case 'CANCELED':
      case 'FAILED':
        return 'cancelled';
      case 'PENDING':
      default:
        return 'pending';
    }
  }
}
