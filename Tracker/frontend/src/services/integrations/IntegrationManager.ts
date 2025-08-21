import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'ecommerce' | 'accounting' | 'payment' | 'erp' | 'marketplace' | 'pos';
  status: 'active' | 'inactive' | 'error' | 'pending';
  credentials: Record<string, any>;
  settings: Record<string, any>;
  lastSync?: Date;
  webhookUrl?: string;
  webhookSecret?: string;
  rateLimits?: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface IntegrationAdapter {
  id: string;
  name: string;
  type: IntegrationConfig['type'];
  
  // Core methods
  authenticate(credentials: Record<string, any>): Promise<boolean>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  
  // Data sync methods
  syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]>;
  syncProducts(): Promise<Product[]>;
  syncCustomers(): Promise<Customer[]>;
  
  // Tax calculation hooks
  calculateTax(request: TaxCalculationRequest): Promise<TaxCalculationResponse>;
  updateTransaction(transactionId: string, taxData: TaxData): Promise<boolean>;
  
  // Webhook handling
  handleWebhook(payload: any, signature?: string): Promise<void>;
  
  // Rate limiting
  getRateLimits(): Promise<RateLimitInfo>;
}

export interface Transaction {
  id: string;
  externalId: string;
  date: Date;
  amount: number;
  currency: string;
  customerId: string;
  items: TransactionItem[];
  shippingAddress: Address;
  billingAddress: Address;
  taxAmount?: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  metadata?: Record<string, any>;
}

export interface Product {
  id: string;
  externalId: string;
  name: string;
  sku: string;
  price: number;
  category: string;
  taxCategory: string;
  description?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface Customer {
  id: string;
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
  addresses: Address[];
  taxExempt: boolean;
  taxExemptionReason?: string;
  taxExemptionCertificate?: string;
}

export interface Address {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface TransactionItem {
  id: string;
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount?: number;
  taxCategory: string;
}

export interface TaxCalculationRequest {
  transactionId: string;
  customerId: string;
  items: TransactionItem[];
  shippingAddress: Address;
  billingAddress?: Address;
  shippingAmount?: number;
  discountAmount?: number;
  exemptionCertificate?: string;
}

export interface TaxCalculationResponse {
  totalTax: number;
  breakdown: TaxBreakdown[];
  confidence: number;
  warnings: string[];
}

export interface TaxBreakdown {
  jurisdiction: string;
  jurisdictionType: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
}

export interface TaxData {
  totalTax: number;
  breakdown: TaxBreakdown[];
  calculatedAt: Date;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
}

export class IntegrationManager extends EventEmitter {
  private adapters: Map<string, IntegrationAdapter> = new Map();
  private configurations: Map<string, IntegrationConfig> = new Map();
  private syncQueues: Map<string, Array<() => Promise<void>>> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();

  constructor() {
    super();
    this.initializeAdapters();
  }

  private async initializeAdapters(): Promise<void> {
    // Import and register all enhanced adapters
    const { ShopifyAdapter } = await import('./adapters/ShopifyAdapter');
    const { WooCommerceAdapter } = await import('./adapters/WooCommerceAdapter');
    const { XeroAdapter } = await import('./adapters/XeroAdapter');
    const { StripeAdapter } = await import('./adapters/StripeAdapter');
    const { SquareAdapter } = await import('./adapters/SquareAdapter');
    const { BigCommerceAdapter } = await import('./adapters/BigCommerceAdapter');
    const { PayPalAdapter } = await import('./adapters/PayPalAdapter');
    
    await this.registerAdapter(new ShopifyAdapter());
    await this.registerAdapter(new WooCommerceAdapter());
    await this.registerAdapter(new XeroAdapter());
    await this.registerAdapter(new StripeAdapter());
    await this.registerAdapter(new SquareAdapter());
    await this.registerAdapter(new BigCommerceAdapter());
    await this.registerAdapter(new PayPalAdapter());
    
    logger.info(`Initialized ${this.adapters.size} enhanced integration adapters with competitive advantages`);
  }

  async registerAdapter(adapter: IntegrationAdapter): Promise<void> {
    this.adapters.set(adapter.id, adapter);
    this.syncQueues.set(adapter.id, []);
    
    // Initialize rate limiter for this adapter
    const rateLimiter = new RateLimiter({
      requestsPerMinute: 60,
      requestsPerHour: 3600,
      requestsPerDay: 50000
    });
    this.rateLimiters.set(adapter.id, rateLimiter);
    
    logger.debug(`Registered integration adapter: ${adapter.name}`);
  }

  async createIntegration(
    adapterId: string,
    tenantId: string,
    credentials: Record<string, any>,
    settings?: Record<string, any>
  ): Promise<IntegrationConfig> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    // Test authentication
    const isAuthenticated = await adapter.authenticate(credentials);
    if (!isAuthenticated) {
      throw new Error('Authentication failed');
    }

    // Test connection
    const connectionWorks = await adapter.testConnection();
    if (!connectionWorks) {
      throw new Error('Connection test failed');
    }

    const config: IntegrationConfig = {
      id: `${tenantId}_${adapterId}_${Date.now()}`,
      name: adapter.name,
      type: adapter.type,
      status: 'active',
      credentials,
      settings: settings || {},
      webhookUrl: this.generateWebhookUrl(adapterId),
      webhookSecret: this.generateWebhookSecret(),
      rateLimits: await this.getDefaultRateLimits(adapterId)
    };

    this.configurations.set(config.id, config);
    
    // Emit integration created event
    this.emit('integration:created', { config, adapter });
    
    logger.info(`Created integration: ${config.name} (${config.id})`);
    
    return config;
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    const config = this.configurations.get(integrationId);
    if (!config) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    const adapter = this.adapters.get(config.name.toLowerCase().replace(/\s+/g, ''));
    if (adapter) {
      await adapter.disconnect();
    }

    this.configurations.delete(integrationId);
    
    this.emit('integration:deleted', { integrationId, config });
    
    logger.info(`Deleted integration: ${integrationId}`);
  }

  async syncIntegration(integrationId: string, syncType: 'transactions' | 'products' | 'customers' | 'all'): Promise<void> {
    const config = this.configurations.get(integrationId);
    if (!config) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    const adapter = this.adapters.get(config.name.toLowerCase().replace(/\s+/g, ''));
    if (!adapter) {
      throw new Error(`Adapter not found for integration: ${integrationId}`);
    }

    // Check rate limits
    const rateLimiter = this.rateLimiters.get(adapter.id);
    if (!rateLimiter?.canMakeRequest()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      config.status = 'pending';
      this.emit('sync:started', { integrationId, syncType });

      let results: any = {};

      if (syncType === 'all' || syncType === 'transactions') {
        results.transactions = await adapter.syncTransactions();
        rateLimiter?.recordRequest();
      }

      if (syncType === 'all' || syncType === 'products') {
        results.products = await adapter.syncProducts();
        rateLimiter?.recordRequest();
      }

      if (syncType === 'all' || syncType === 'customers') {
        results.customers = await adapter.syncCustomers();
        rateLimiter?.recordRequest();
      }

      config.status = 'active';
      config.lastSync = new Date();
      
      this.emit('sync:completed', { integrationId, syncType, results });
      
      logger.info(`Sync completed for ${integrationId}: ${syncType}`);
      
    } catch (error) {
      config.status = 'error';
      this.emit('sync:failed', { integrationId, syncType, error });
      logger.error(`Sync failed for ${integrationId}:`, error);
      throw error;
    }
  }

  async calculateTaxForTransaction(
    integrationId: string,
    request: TaxCalculationRequest
  ): Promise<TaxCalculationResponse> {
    const config = this.configurations.get(integrationId);
    if (!config) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    const adapter = this.adapters.get(config.name.toLowerCase().replace(/\s+/g, ''));
    if (!adapter) {
      throw new Error(`Adapter not found for integration: ${integrationId}`);
    }

    const rateLimiter = this.rateLimiters.get(adapter.id);
    if (!rateLimiter?.canMakeRequest()) {
      throw new Error('Rate limit exceeded');
    }

    try {
      const response = await adapter.calculateTax(request);
      rateLimiter?.recordRequest();
      
      this.emit('tax:calculated', { integrationId, request, response });
      
      return response;
    } catch (error) {
      this.emit('tax:calculation:failed', { integrationId, request, error });
      throw error;
    }
  }

  async handleWebhook(adapterId: string, payload: any, signature?: string): Promise<void> {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    try {
      await adapter.handleWebhook(payload, signature);
      this.emit('webhook:processed', { adapterId, payload });
    } catch (error) {
      this.emit('webhook:failed', { adapterId, payload, error });
      throw error;
    }
  }

  getIntegrationsByType(type: IntegrationConfig['type']): IntegrationConfig[] {
    return Array.from(this.configurations.values()).filter(config => config.type === type);
  }

  getAllIntegrations(): IntegrationConfig[] {
    return Array.from(this.configurations.values());
  }

  getIntegration(integrationId: string): IntegrationConfig | undefined {
    return this.configurations.get(integrationId);
  }

  getAvailableAdapters(): Array<{ id: string; name: string; type: string }> {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      type: adapter.type
    }));
  }

  private generateWebhookUrl(adapterId: string): string {
    return `${process.env.VITE_API_BASE_URL}/webhooks/integrations/${adapterId}`;
  }

  private generateWebhookSecret(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async getDefaultRateLimits(adapterId: string): Promise<IntegrationConfig['rateLimits']> {
    // Default rate limits, can be customized per adapter
    return {
      requestsPerMinute: 60,
      requestsPerHour: 3600,
      requestsPerDay: 50000
    };
  }
}

class RateLimiter {
  private requests: Array<{ timestamp: number; type: 'minute' | 'hour' | 'day' }> = [];
  private limits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };

  constructor(limits: RateLimiter['limits']) {
    this.limits = limits;
  }

  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Clean old requests
    this.requests = this.requests.filter(req => {
      const age = now - req.timestamp;
      return age < 24 * 60 * 60 * 1000; // Keep requests from last 24 hours
    });

    // Check limits
    const minuteRequests = this.requests.filter(req => now - req.timestamp < 60 * 1000).length;
    const hourRequests = this.requests.filter(req => now - req.timestamp < 60 * 60 * 1000).length;
    const dayRequests = this.requests.length;

    return (
      minuteRequests < this.limits.requestsPerMinute &&
      hourRequests < this.limits.requestsPerHour &&
      dayRequests < this.limits.requestsPerDay
    );
  }

  recordRequest(): void {
    const now = Date.now();
    this.requests.push({ timestamp: now, type: 'minute' });
  }

  getRemainingRequests(): { minute: number; hour: number; day: number } {
    const now = Date.now();
    
    const minuteRequests = this.requests.filter(req => now - req.timestamp < 60 * 1000).length;
    const hourRequests = this.requests.filter(req => now - req.timestamp < 60 * 60 * 1000).length;
    const dayRequests = this.requests.length;

    return {
      minute: Math.max(0, this.limits.requestsPerMinute - minuteRequests),
      hour: Math.max(0, this.limits.requestsPerHour - hourRequests),
      day: Math.max(0, this.limits.requestsPerDay - dayRequests)
    };
  }
}


export const integrationManager = new IntegrationManager();
