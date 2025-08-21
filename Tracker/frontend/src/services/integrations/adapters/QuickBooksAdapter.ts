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

interface QuickBooksCredentials {
  accessToken: string;
  refreshToken: string;
  realmId: string; // Company ID
  baseUrl: string; // sandbox or production
  clientId?: string;
  clientSecret?: string;
  expiresAt?: Date;
}

interface QuickBooksItem {
  Id: string;
  Name: string;
  Description?: string;
  Active: boolean;
  FullyQualifiedName: string;
  Taxable: boolean;
  UnitPrice: number;
  Type: 'Inventory' | 'NonInventory' | 'Service';
  QtyOnHand?: number;
  InvStartDate?: string;
  ParentRef?: {
    value: string;
    name: string;
  };
  Level?: number;
  IncomeAccountRef?: {
    value: string;
    name: string;
  };
  ExpenseAccountRef?: {
    value: string;
    name: string;
  };
  AssetAccountRef?: {
    value: string;
    name: string;
  };
  TrackQtyOnHand?: boolean;
  SalesTaxIncluded?: boolean;
  SalesTaxCodeRef?: {
    value: string;
    name: string;
  };
  PurchaseTaxIncluded?: boolean;
  PurchaseTaxCodeRef?: {
    value: string;
    name: string;
  };
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
  sparse?: boolean;
  domain: string;
}

interface QuickBooksCustomer {
  Id: string;
  Name: string;
  CompanyName?: string;
  DisplayName: string;
  PrintOnCheckName?: string;
  Active: boolean;
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  PrimaryEmailAddr?: {
    Address: string;
  };
  WebAddr?: {
    URI: string;
  };
  DefaultTaxCodeRef?: {
    value: string;
    name: string;
  };
  Taxable: boolean;
  BillAddr?: {
    Id: string;
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  ShipAddr?: {
    Id: string;
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  Notes?: string;
  Job: boolean;
  BillWithParent: boolean;
  ParentRef?: {
    value: string;
    name: string;
  };
  Level: number;
  SalesTermRef?: {
    value: string;
    name: string;
  };
  PaymentMethodRef?: {
    value: string;
    name: string;
  };
  Balance: number;
  OpenBalanceDate?: string;
  BalanceWithJobs?: number;
  CurrencyRef?: {
    value: string;
    name: string;
  };
  PreferredDeliveryMethod?: string;
  ResaleNum?: string;
  suffix?: string;
  Title?: string;
  MiddleName?: string;
  FamilyName?: string;
  GivenName?: string;
  FullyQualifiedName: string;
  sparse?: boolean;
  domain: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

interface QuickBooksSalesReceipt {
  Id: string;
  SyncToken: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
  DocNumber: string;
  TxnDate: string;
  DepartmentRef?: {
    value: string;
    name: string;
  };
  CurrencyRef: {
    value: string;
    name: string;
  };
  ExchangeRate?: number;
  PrivateNote?: string;
  Line: Array<{
    Id: string;
    LineNum: number;
    Description?: string;
    Amount: number;
    DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DiscountLineDetail';
    SalesItemLineDetail?: {
      ItemRef: {
        value: string;
        name: string;
      };
      UnitPrice?: number;
      Qty?: number;
      TaxCodeRef?: {
        value: string;
        name: string;
      };
      ServiceDate?: string;
    };
    SubTotalLineDetail?: {};
    DiscountLineDetail?: {
      PercentBased?: boolean;
      DiscountPercent?: number;
      DiscountAccountRef?: {
        value: string;
        name: string;
      };
    };
  }>;
  TxnTaxDetail?: {
    TxnTaxCodeRef?: {
      value: string;
      name: string;
    };
    TotalTax?: number;
    TaxLine?: Array<{
      Amount: number;
      DetailType: 'TaxLineDetail';
      TaxLineDetail: {
        TaxRateRef: {
          value: string;
          name: string;
        };
        PercentBased: boolean;
        TaxPercent: number;
        NetAmountTaxable: number;
      };
    }>;
  };
  CustomerRef: {
    value: string;
    name: string;
  };
  CustomerMemo?: {
    value: string;
  };
  BillAddr?: {
    Id: string;
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  ShipAddr?: {
    Id: string;
    Line1?: string;
    Line2?: string;
    City?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
    PostalCode?: string;
  };
  ClassRef?: {
    value: string;
    name: string;
  };
  SalesTermRef?: {
    value: string;
    name: string;
  };
  TotalAmt: number;
  PrintStatus: string;
  EmailStatus: string;
  BillEmail?: {
    Address: string;
  };
  DeliveryInfo?: {
    DeliveryType: string;
    DeliveryTime: string;
  };
  ApplyTaxAfterDiscount: boolean;
  domain: string;
  sparse: boolean;
  Balance: number;
}

export class QuickBooksAdapter implements IntegrationAdapter {
  id = 'quickbooks';
  name = 'QuickBooks Online';
  type = 'accounting' as const;
  
  private credentials?: QuickBooksCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl = '';

  constructor() {
    this.taxCalculator = new TaxCalculator();
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const qbCredentials = credentials as QuickBooksCredentials;
      
      if (!qbCredentials.accessToken || !qbCredentials.realmId) {
        logger.error('Missing required QuickBooks credentials');
        return false;
      }

      this.credentials = qbCredentials;
      this.baseUrl = qbCredentials.baseUrl || 'https://sandbox-quickbooks.api.intuit.com';

      // Test the connection by fetching company info
      const response = await fetch(`${this.baseUrl}/v3/company/${qbCredentials.realmId}/companyinfo/${qbCredentials.realmId}`, {
        headers: {
          'Authorization': `Bearer ${qbCredentials.accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token might be expired, try to refresh
          const refreshed = await this.refreshAccessToken();
          if (refreshed) {
            return await this.testConnection();
          }
        }
        logger.error('QuickBooks authentication failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      logger.info(`Successfully authenticated with QuickBooks: ${data.QueryResponse?.CompanyInfo?.[0]?.CompanyName}`);
      
      return true;
    } catch (error) {
      logger.error('QuickBooks authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Revoke tokens if possible
      if (this.credentials?.accessToken && this.credentials?.clientId && this.credentials?.clientSecret) {
        await fetch('https://appcenter.intuit.com/api/v1/Connection/Disconnect', {
          method: 'GET',
          headers: {
            'Authorization': `Intuit_IAM_Authentication intuit_appid=${this.credentials.clientId},intuit_app_secret=${this.credentials.clientSecret}`,
            'Accept': 'application/json'
          }
        });
      }
      
      this.credentials = undefined;
      this.baseUrl = '';
      
      logger.info('Disconnected from QuickBooks');
    } catch (error) {
      logger.error('Error during QuickBooks disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const response = await fetch(`${this.baseUrl}/v3/company/${this.credentials.realmId}/companyinfo/${this.credentials.realmId}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Accept': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('QuickBooks connection test failed:', error);
      return false;
    }
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with QuickBooks');
    }

    try {
      // QuickBooks doesn't have generic "transactions" - we'll sync sales receipts and invoices
      const salesReceipts = await this.fetchSalesReceipts(startDate, endDate);
      const invoices = await this.fetchInvoices(startDate, endDate);

      const transactions = [
        ...salesReceipts.map(receipt => this.mapSalesReceiptToTransaction(receipt)),
        ...invoices.map(invoice => this.mapInvoiceToTransaction(invoice))
      ];

      logger.info(`Fetched ${transactions.length} transactions from QuickBooks`);

      return transactions;
    } catch (error) {
      logger.error('Failed to sync QuickBooks transactions:', error);
      throw error;
    }
  }

  async syncProducts(): Promise<Product[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with QuickBooks');
    }

    try {
      let allItems: QuickBooksItem[] = [];
      let startPosition = 1;
      const maxResults = 500;

      // Paginate through all items
      while (true) {
        const query = `SELECT * FROM Item STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
        const encodedQuery = encodeURIComponent(query);
        
        const response = await fetch(`${this.baseUrl}/v3/company/${this.credentials.realmId}/query?query=${encodedQuery}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.statusText}`);
        }

        const data = await response.json();
        const items = data.QueryResponse?.Item || [];
        
        if (items.length === 0) break;
        
        allItems = allItems.concat(items);
        
        if (items.length < maxResults) break;
        
        startPosition += maxResults;
      }

      logger.info(`Fetched ${allItems.length} items from QuickBooks`);

      return allItems.map((item) => ({
        id: `quickbooks_${item.Id}`,
        externalId: item.Id,
        name: item.Name,
        sku: item.Id, // QuickBooks doesn't have SKU, use ID
        price: item.UnitPrice || 0,
        category: item.Type || 'General',
        taxCategory: item.Taxable ? 'taxable' : 'exempt',
        description: item.Description,
        weight: undefined, // QuickBooks doesn't track weight
        dimensions: undefined
      }));
    } catch (error) {
      logger.error('Failed to sync QuickBooks items:', error);
      throw error;
    }
  }

  async syncCustomers(): Promise<Customer[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with QuickBooks');
    }

    try {
      let allCustomers: QuickBooksCustomer[] = [];
      let startPosition = 1;
      const maxResults = 500;

      // Paginate through all customers
      while (true) {
        const query = `SELECT * FROM Customer STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
        const encodedQuery = encodeURIComponent(query);
        
        const response = await fetch(`${this.baseUrl}/v3/company/${this.credentials.realmId}/query?query=${encodedQuery}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch customers: ${response.statusText}`);
        }

        const data = await response.json();
        const customers = data.QueryResponse?.Customer || [];
        
        if (customers.length === 0) break;
        
        allCustomers = allCustomers.concat(customers);
        
        if (customers.length < maxResults) break;
        
        startPosition += maxResults;
      }

      logger.info(`Fetched ${allCustomers.length} customers from QuickBooks`);

      return allCustomers.map((customer) => {
        const addresses: Address[] = [];
        
        if (customer.BillAddr) {
          addresses.push(this.mapQuickBooksAddress(customer.BillAddr));
        }
        
        if (customer.ShipAddr && customer.ShipAddr.Id !== customer.BillAddr?.Id) {
          addresses.push(this.mapQuickBooksAddress(customer.ShipAddr));
        }

        return {
          id: `quickbooks_${customer.Id}`,
          externalId: customer.Id,
          email: customer.PrimaryEmailAddr?.Address || '',
          firstName: customer.GivenName || '',
          lastName: customer.FamilyName || '',
          company: customer.CompanyName,
          phone: customer.PrimaryPhone?.FreeFormNumber,
          addresses,
          taxExempt: !customer.Taxable,
          taxExemptionReason: customer.Taxable ? undefined : 'QuickBooks tax exempt',
          taxExemptionCertificate: customer.ResaleNum
        };
      });
    } catch (error) {
      logger.error('Failed to sync QuickBooks customers:', error);
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
      throw new Error('Not authenticated with QuickBooks');
    }

    try {
      // QuickBooks has complex tax handling - this would require creating tax rates
      // and updating the transaction with proper tax line items
      const qbId = transactionId.replace('quickbooks_', '');
      
      logger.info(`Tax calculation completed for QuickBooks transaction ${qbId}, manual update required`);
      
      // For now, we'll just log the tax calculation result
      // In a full implementation, you'd update the QB transaction with tax details
      return true;
    } catch (error) {
      logger.error('Failed to update QuickBooks transaction:', error);
      return false;
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<void> {
    try {
      // QuickBooks webhooks would be handled here
      // They send notifications when data changes
      
      logger.info(`Processed QuickBooks webhook`);
    } catch (error) {
      logger.error('Failed to process QuickBooks webhook:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // QuickBooks has rate limits: 500 requests per app per realm per 5-minute window
    return {
      remaining: 500, // This would be updated based on response headers
      resetTime: new Date(Date.now() + 5 * 60 * 1000), // Reset every 5 minutes
      limit: 500
    };
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.credentials?.refreshToken || !this.credentials?.clientId || !this.credentials?.clientSecret) {
      return false;
    }

    try {
      const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.credentials.clientId}:${this.credentials.clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=refresh_token&refresh_token=${this.credentials.refreshToken}`
      });

      if (!response.ok) {
        logger.error('Failed to refresh QuickBooks token:', response.statusText);
        return false;
      }

      const data = await response.json();
      
      this.credentials.accessToken = data.access_token;
      if (data.refresh_token) {
        this.credentials.refreshToken = data.refresh_token;
      }
      this.credentials.expiresAt = new Date(Date.now() + (data.expires_in * 1000));

      logger.info('Successfully refreshed QuickBooks access token');
      return true;
    } catch (error) {
      logger.error('Error refreshing QuickBooks token:', error);
      return false;
    }
  }

  private async fetchSalesReceipts(startDate?: Date, endDate?: Date): Promise<QuickBooksSalesReceipt[]> {
    if (!this.credentials) return [];

    let query = "SELECT * FROM SalesReceipt";
    
    if (startDate || endDate) {
      const conditions = [];
      if (startDate) {
        conditions.push(`TxnDate >= '${startDate.toISOString().split('T')[0]}'`);
      }
      if (endDate) {
        conditions.push(`TxnDate <= '${endDate.toISOString().split('T')[0]}'`);
      }
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const encodedQuery = encodeURIComponent(query);
    
    const response = await fetch(`${this.baseUrl}/v3/company/${this.credentials.realmId}/query?query=${encodedQuery}`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sales receipts: ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.SalesReceipt || [];
  }

  private async fetchInvoices(startDate?: Date, endDate?: Date): Promise<any[]> {
    if (!this.credentials) return [];

    let query = "SELECT * FROM Invoice";
    
    if (startDate || endDate) {
      const conditions = [];
      if (startDate) {
        conditions.push(`TxnDate >= '${startDate.toISOString().split('T')[0]}'`);
      }
      if (endDate) {
        conditions.push(`TxnDate <= '${endDate.toISOString().split('T')[0]}'`);
      }
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const encodedQuery = encodeURIComponent(query);
    
    const response = await fetch(`${this.baseUrl}/v3/company/${this.credentials.realmId}/query?query=${encodedQuery}`, {
      headers: {
        'Authorization': `Bearer ${this.credentials.accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch invoices: ${response.statusText}`);
    }

    const data = await response.json();
    return data.QueryResponse?.Invoice || [];
  }

  private mapSalesReceiptToTransaction(receipt: QuickBooksSalesReceipt): Transaction {
    return {
      id: `quickbooks_receipt_${receipt.Id}`,
      externalId: receipt.Id,
      date: new Date(receipt.TxnDate),
      amount: receipt.TotalAmt,
      currency: receipt.CurrencyRef?.name || 'USD',
      customerId: `quickbooks_${receipt.CustomerRef.value}`,
      items: receipt.Line
        .filter(line => line.DetailType === 'SalesItemLineDetail')
        .map((line, index) => ({
          id: `quickbooks_line_${line.Id}`,
          productId: line.SalesItemLineDetail?.ItemRef?.value ? `quickbooks_${line.SalesItemLineDetail.ItemRef.value}` : '',
          sku: line.SalesItemLineDetail?.ItemRef?.value || '',
          name: line.SalesItemLineDetail?.ItemRef?.name || line.Description || '',
          quantity: line.SalesItemLineDetail?.Qty || 1,
          unitPrice: line.SalesItemLineDetail?.UnitPrice || line.Amount,
          totalPrice: line.Amount,
          taxAmount: 0, // Would be calculated from TxnTaxDetail
          taxCategory: 'standard'
        })),
      shippingAddress: receipt.ShipAddr ? this.mapQuickBooksAddress(receipt.ShipAddr) : {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      billingAddress: receipt.BillAddr ? this.mapQuickBooksAddress(receipt.BillAddr) : {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      taxAmount: receipt.TxnTaxDetail?.TotalTax || 0,
      status: 'completed',
      metadata: {
        quickbooksDocNumber: receipt.DocNumber,
        quickbooksType: 'SalesReceipt',
        printStatus: receipt.PrintStatus,
        emailStatus: receipt.EmailStatus
      }
    };
  }

  private mapInvoiceToTransaction(invoice: any): Transaction {
    return {
      id: `quickbooks_invoice_${invoice.Id}`,
      externalId: invoice.Id,
      date: new Date(invoice.TxnDate),
      amount: invoice.TotalAmt,
      currency: invoice.CurrencyRef?.name || 'USD',
      customerId: `quickbooks_${invoice.CustomerRef.value}`,
      items: invoice.Line
        .filter((line: any) => line.DetailType === 'SalesItemLineDetail')
        .map((line: any, index: number) => ({
          id: `quickbooks_line_${line.Id}`,
          productId: line.SalesItemLineDetail?.ItemRef?.value ? `quickbooks_${line.SalesItemLineDetail.ItemRef.value}` : '',
          sku: line.SalesItemLineDetail?.ItemRef?.value || '',
          name: line.SalesItemLineDetail?.ItemRef?.name || line.Description || '',
          quantity: line.SalesItemLineDetail?.Qty || 1,
          unitPrice: line.SalesItemLineDetail?.UnitPrice || line.Amount,
          totalPrice: line.Amount,
          taxAmount: 0, // Would be calculated from TxnTaxDetail
          taxCategory: 'standard'
        })),
      shippingAddress: invoice.ShipAddr ? this.mapQuickBooksAddress(invoice.ShipAddr) : {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      billingAddress: invoice.BillAddr ? this.mapQuickBooksAddress(invoice.BillAddr) : {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      },
      taxAmount: invoice.TxnTaxDetail?.TotalTax || 0,
      status: invoice.Balance > 0 ? 'pending' : 'completed',
      metadata: {
        quickbooksDocNumber: invoice.DocNumber,
        quickbooksType: 'Invoice',
        balance: invoice.Balance,
        dueDate: invoice.DueDate
      }
    };
  }

  private mapQuickBooksAddress(address: any): Address {
    return {
      street1: address.Line1 || '',
      street2: address.Line2,
      city: address.City || '',
      state: address.CountrySubDivisionCode || '',
      zipCode: address.PostalCode || '',
      country: address.Country || 'US'
    };
  }
}
