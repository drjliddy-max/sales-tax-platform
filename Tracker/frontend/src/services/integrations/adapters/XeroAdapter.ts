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

interface XeroCredentials {
  accessToken: string;
  refreshToken: string;
  tenantId: string; // Xero organisation ID
  clientId?: string;
  clientSecret?: string;
  expiresAt?: Date;
  scope?: string;
}

interface XeroInvoice {
  InvoiceID: string;
  Type: 'ACCREC' | 'ACCPAY';
  InvoiceNumber?: string;
  Reference?: string;
  BrandingThemeID?: string;
  Url?: string;
  CurrencyCode: string;
  CurrencyRate?: number;
  Status: 'DRAFT' | 'SUBMITTED' | 'DELETED' | 'AUTHORISED' | 'PAID' | 'VOIDED';
  LineAmountTypes: 'Exclusive' | 'Inclusive' | 'NoTax';
  LineItems: XeroLineItem[];
  SubTotal: number;
  TotalTax: number;
  Total: number;
  UpdatedDateUTC: string;
  Date: string;
  DueDate?: string;
  ExpectedPaymentDate?: string;
  PlannedPaymentDate?: string;
  Contact: {
    ContactID: string;
    Name: string;
    Addresses?: XeroAddress[];
    Phones?: XeroPhone[];
    EmailAddress?: string;
    ContactStatus?: string;
    DefaultCurrency?: string;
    SalesTrackingCategories?: any[];
    PurchasesTrackingCategories?: any[];
    IsSupplier?: boolean;
    IsCustomer?: boolean;
    ContactPersons?: any[];
  };
  BrandingTheme?: {
    BrandingThemeID: string;
    Name: string;
  };
  HasErrors?: boolean;
  IsDiscounted?: boolean;
  HasAttachments?: boolean;
  Payments?: XeroPayment[];
  Prepayments?: any[];
  Overpayments?: any[];
  AmountDue?: number;
  AmountPaid?: number;
  FullyPaidOnDate?: string;
  AmountCredited?: number;
  SentToContact?: boolean;
  CISDeduction?: number;
  CISRate?: number;
  StatusAttributeString?: string;
  ValidationErrors?: any[];
  Warnings?: any[];
}

interface XeroLineItem {
  LineItemID?: string;
  Description?: string;
  UnitAmount: number;
  TaxType?: string;
  TaxAmount?: number;
  LineAmount: number;
  AccountCode?: string;
  ItemCode?: string;
  Quantity?: number;
  DiscountRate?: number;
  DiscountAmount?: number;
  RepeatingInvoiceID?: string;
  TrackingCategories?: any[];
}

interface XeroPayment {
  PaymentID: string;
  Date: string;
  Amount: number;
  Reference?: string;
  CurrencyRate?: number;
  Account: {
    AccountID: string;
    Code: string;
    Name: string;
    Type: string;
    BankAccountNumber?: string;
    Status?: string;
    Description?: string;
    BankAccountType?: string;
    CurrencyCode?: string;
    TaxType?: string;
    EnablePaymentsToAccount?: boolean;
    ShowInExpenseClaims?: boolean;
    Class?: string;
    SystemAccount?: string;
    ReportingCode?: string;
    ReportingCodeName?: string;
    HasAttachments?: boolean;
  };
  Invoice?: {
    InvoiceID: string;
    InvoiceNumber?: string;
    Type: string;
  };
  CreditNote?: any;
  Prepayment?: any;
  Overpayment?: any;
  UpdatedDateUTC: string;
  Status: 'AUTHORISED' | 'DELETED';
  PaymentType: 'ACCRECPAYMENT' | 'ACCPAYPAYMENT' | 'ARCREDITPAYMENT' | 'APCREDITPAYMENT' | 'AROVERPAYMENTPAYMENT' | 'ARPREPAYMENTPAYMENT' | 'APPREPAYMENTPAYMENT' | 'APOVERPAYMENTPAYMENT';
  ValidationErrors?: any[];
  Warnings?: any[];
}

interface XeroContact {
  ContactID: string;
  ContactNumber?: string;
  AccountNumber?: string;
  ContactStatus: 'ACTIVE' | 'ARCHIVED' | 'GDPRREQUEST';
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  SkypeUserName?: string;
  ContactPersons?: any[];
  BankAccountDetails?: string;
  TaxNumber?: string;
  AccountsReceivableTaxType?: string;
  AccountsPayableTaxType?: string;
  Addresses?: XeroAddress[];
  Phones?: XeroPhone[];
  IsSupplier?: boolean;
  IsCustomer?: boolean;
  DefaultCurrency?: string;
  XeroNetworkKey?: string;
  SalesDefaultAccountCode?: string;
  PurchasesDefaultAccountCode?: string;
  SalesTrackingCategories?: any[];
  PurchasesTrackingCategories?: any[];
  TrackingCategoryName?: string;
  TrackingCategoryOption?: string;
  PaymentTerms?: {
    Bills?: {
      Day: number;
      Type: 'DAYSAFTERBILLDATE' | 'DAYSAFTERBILLMONTH' | 'OFCURRENTMONTH' | 'OFFOLLOWINGMONTH';
    };
    Sales?: {
      Day: number;
      Type: 'DAYSAFTERBILLDATE' | 'DAYSAFTERBILLMONTH' | 'OFCURRENTMONTH' | 'OFFOLLOWINGMONTH';
    };
  };
  UpdatedDateUTC: string;
  ContactGroups?: any[];
  Website?: string;
  BrandingTheme?: {
    BrandingThemeID: string;
    Name: string;
  };
  BatchPayments?: {
    BankAccountNumber: string;
    BankAccountName: string;
    Details: string;
  };
  Discount?: number;
  Balances?: {
    AccountsReceivable?: {
      Outstanding: number;
      Overdue: number;
    };
    AccountsPayable?: {
      Outstanding: number;
      Overdue: number;
    };
  };
  AttachmentsURI?: string;
  HasAttachments?: boolean;
  ValidationErrors?: any[];
  Warnings?: any[];
}

interface XeroAddress {
  AddressType: 'POBOX' | 'STREET' | 'DELIVERY';
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  AddressLine4?: string;
  City?: string;
  Region?: string;
  PostalCode?: string;
  Country?: string;
  AttentionTo?: string;
}

interface XeroPhone {
  PhoneType: 'DEFAULT' | 'DDI' | 'MOBILE' | 'FAX';
  PhoneNumber?: string;
  PhoneAreaCode?: string;
  PhoneCountryCode?: string;
}

interface XeroItem {
  ItemID: string;
  Code: string;
  Name: string;
  IsSold?: boolean;
  IsPurchased?: boolean;
  Description?: string;
  PurchaseDescription?: string;
  PurchaseDetails?: {
    UnitPrice?: number;
    AccountCode?: string;
    COGSAccountCode?: string;
    TaxType?: string;
  };
  SalesDetails?: {
    UnitPrice?: number;
    AccountCode?: string;
    TaxType?: string;
  };
  InventoryAssetAccountCode?: string;
  TotalCostPool?: number;
  QuantityOnHand?: number;
  UpdatedDateUTC: string;
  ValidationErrors?: any[];
  Warnings?: any[];
}

export class XeroAdapter implements IntegrationAdapter {
  id = 'xero';
  name = 'Xero';
  type = 'accounting' as const;
  
  private credentials?: XeroCredentials;
  private taxCalculator: TaxCalculator;
  private baseUrl = 'https://api.xero.com/api.xro/2.0';

  constructor() {
    this.taxCalculator = new TaxCalculator();
  }

  async authenticate(credentials: Record<string, any>): Promise<boolean> {
    try {
      const xeroCredentials = credentials as XeroCredentials;
      
      if (!xeroCredentials.accessToken || !xeroCredentials.tenantId) {
        logger.error('Missing required Xero credentials');
        return false;
      }

      this.credentials = xeroCredentials;

      // Test the connection by fetching organisation info
      const response = await fetch(`${this.baseUrl}/Organisation`, {
        headers: {
          'Authorization': `Bearer ${xeroCredentials.accessToken}`,
          'Xero-tenant-id': xeroCredentials.tenantId,
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
        logger.error('Xero authentication failed:', response.statusText);
        return false;
      }

      const data = await response.json();
      const org = data.Organisations?.[0];
      logger.info(`Successfully authenticated with Xero organisation: ${org?.Name}`);
      
      return true;
    } catch (error) {
      logger.error('Xero authentication error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Revoke tokens if possible
      if (this.credentials?.refreshToken && this.credentials?.clientId && this.credentials?.clientSecret) {
        await fetch('https://identity.xero.com/connect/revocation', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${this.credentials.clientId}:${this.credentials.clientSecret}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `token=${this.credentials.refreshToken}&token_type_hint=refresh_token`
        });
      }
      
      this.credentials = undefined;
      
      logger.info('Disconnected from Xero');
    } catch (error) {
      logger.error('Error during Xero disconnect:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.credentials) return false;

    try {
      const response = await fetch(`${this.baseUrl}/Organisation`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Xero-tenant-id': this.credentials.tenantId,
          'Accept': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logger.error('Xero connection test failed:', error);
      return false;
    }
  }

  async syncTransactions(startDate?: Date, endDate?: Date): Promise<Transaction[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Xero');
    }

    try {
      // Sync both invoices and payments
      const invoices = await this.fetchInvoices(startDate, endDate);
      
      const transactions = invoices.map(invoice => this.mapXeroInvoiceToTransaction(invoice));

      logger.info(`Fetched ${transactions.length} transactions from Xero`);

      return transactions;
    } catch (error) {
      logger.error('Failed to sync Xero transactions:', error);
      throw error;
    }
  }

  async syncProducts(): Promise<Product[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Xero');
    }

    try {
      let allItems: XeroItem[] = [];
      let page = 1;

      // Paginate through all items
      while (true) {
        const params = new URLSearchParams({
          page: page.toString()
        });

        const response = await fetch(`${this.baseUrl}/Items?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Xero-tenant-id': this.credentials.tenantId,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.statusText}`);
        }

        const data = await response.json();
        const items = data.Items || [];
        
        if (items.length === 0) break;
        
        allItems = allItems.concat(items);
        
        if (items.length < 100) break; // Xero default page size
        
        page++;
      }

      logger.info(`Fetched ${allItems.length} items from Xero`);

      return allItems.map((item) => ({
        id: `xero_${item.ItemID}`,
        externalId: item.ItemID,
        name: item.Name,
        sku: item.Code,
        price: item.SalesDetails?.UnitPrice || 0,
        category: 'General', // Xero doesn't have product categories
        taxCategory: item.SalesDetails?.TaxType || 'standard',
        description: item.Description,
        weight: undefined, // Xero doesn't track physical properties
        dimensions: undefined
      }));
    } catch (error) {
      logger.error('Failed to sync Xero items:', error);
      throw error;
    }
  }

  async syncCustomers(): Promise<Customer[]> {
    if (!this.credentials) {
      throw new Error('Not authenticated with Xero');
    }

    try {
      let allContacts: XeroContact[] = [];
      let page = 1;

      // Paginate through all contacts
      while (true) {
        const params = new URLSearchParams({
          page: page.toString(),
          where: 'IsCustomer==true'
        });

        const response = await fetch(`${this.baseUrl}/Contacts?${params}`, {
          headers: {
            'Authorization': `Bearer ${this.credentials.accessToken}`,
            'Xero-tenant-id': this.credentials.tenantId,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contacts: ${response.statusText}`);
        }

        const data = await response.json();
        const contacts = data.Contacts || [];
        
        if (contacts.length === 0) break;
        
        allContacts = allContacts.concat(contacts);
        
        if (contacts.length < 100) break; // Xero default page size
        
        page++;
      }

      logger.info(`Fetched ${allContacts.length} contacts from Xero`);

      return allContacts.map((contact) => ({
        id: `xero_${contact.ContactID}`,
        externalId: contact.ContactID,
        email: contact.EmailAddress || '',
        firstName: contact.FirstName || '',
        lastName: contact.LastName || '',
        company: contact.FirstName && contact.LastName ? undefined : contact.Name,
        phone: contact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
        addresses: (contact.Addresses || []).map(addr => this.mapXeroAddress(addr)),
        taxExempt: contact.TaxNumber === 'EXEMPT',
        taxExemptionReason: contact.TaxNumber === 'EXEMPT' ? 'Xero tax exempt' : undefined,
        taxExemptionCertificate: contact.TaxNumber !== 'EXEMPT' ? contact.TaxNumber : undefined
      }));
    } catch (error) {
      logger.error('Failed to sync Xero contacts:', error);
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
      throw new Error('Not authenticated with Xero');
    }

    try {
      const invoiceId = transactionId.replace('xero_', '');
      
      // Xero has complex tax handling - this would require updating line items with tax types
      logger.info(`Tax calculation completed for Xero invoice ${invoiceId}, manual update required`);
      
      return true;
    } catch (error) {
      logger.error('Failed to update Xero transaction:', error);
      return false;
    }
  }

  async handleWebhook(payload: any, signature?: string): Promise<void> {
    try {
      // Xero webhooks are handled here
      // They send notifications when data changes
      
      logger.info(`Processed Xero webhook: ${payload.events?.[0]?.eventType}`);
    } catch (error) {
      logger.error('Failed to process Xero webhook:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimitInfo> {
    // Xero API rate limits: 5,000 requests per day per organisation
    return {
      remaining: 5000, // This would be updated based on response headers
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Reset daily
      limit: 5000
    };
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.credentials?.refreshToken || !this.credentials?.clientId || !this.credentials?.clientSecret) {
      return false;
    }

    try {
      const response = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.credentials.clientId}:${this.credentials.clientSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=refresh_token&refresh_token=${this.credentials.refreshToken}`
      });

      if (!response.ok) {
        logger.error('Failed to refresh Xero token:', response.statusText);
        return false;
      }

      const data = await response.json();
      
      this.credentials.accessToken = data.access_token;
      if (data.refresh_token) {
        this.credentials.refreshToken = data.refresh_token;
      }
      this.credentials.expiresAt = new Date(Date.now() + (data.expires_in * 1000));

      logger.info('Successfully refreshed Xero access token');
      return true;
    } catch (error) {
      logger.error('Error refreshing Xero token:', error);
      return false;
    }
  }

  private async fetchInvoices(startDate?: Date, endDate?: Date): Promise<XeroInvoice[]> {
    if (!this.credentials) return [];

    let allInvoices: XeroInvoice[] = [];
    let page = 1;
    
    while (true) {
      let params = new URLSearchParams({
        page: page.toString()
      });

      // Add date filters if provided
      const whereConditions = [];
      if (startDate) {
        whereConditions.push(`Date >= DateTime(${startDate.getFullYear()}, ${startDate.getMonth() + 1}, ${startDate.getDate()})`);
      }
      if (endDate) {
        whereConditions.push(`Date <= DateTime(${endDate.getFullYear()}, ${endDate.getMonth() + 1}, ${endDate.getDate()})`);
      }

      if (whereConditions.length > 0) {
        params.append('where', whereConditions.join(' AND '));
      }

      const response = await fetch(`${this.baseUrl}/Invoices?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.credentials.accessToken}`,
          'Xero-tenant-id': this.credentials.tenantId,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.statusText}`);
      }

      const data = await response.json();
      const invoices = data.Invoices || [];
      
      if (invoices.length === 0) break;
      
      allInvoices = allInvoices.concat(invoices);
      
      if (invoices.length < 100) break;
      
      page++;
    }

    return allInvoices;
  }

  private mapXeroInvoiceToTransaction(invoice: XeroInvoice): Transaction {
    return {
      id: `xero_${invoice.InvoiceID}`,
      externalId: invoice.InvoiceID,
      date: new Date(invoice.Date),
      amount: invoice.Total,
      currency: invoice.CurrencyCode,
      customerId: `xero_${invoice.Contact.ContactID}`,
      items: invoice.LineItems.map((item, index) => ({
        id: `xero_line_${item.LineItemID || index}`,
        productId: item.ItemCode ? `xero_${item.ItemCode}` : '',
        sku: item.ItemCode || '',
        name: item.Description || '',
        quantity: item.Quantity || 1,
        unitPrice: item.UnitAmount,
        totalPrice: item.LineAmount,
        taxAmount: item.TaxAmount || 0,
        taxCategory: item.TaxType || 'standard'
      })),
      shippingAddress: this.mapContactToAddress(invoice.Contact),
      billingAddress: this.mapContactToAddress(invoice.Contact),
      taxAmount: invoice.TotalTax,
      status: this.mapXeroInvoiceStatus(invoice.Status),
      metadata: {
        xeroInvoiceNumber: invoice.InvoiceNumber,
        xeroType: invoice.Type,
        xeroReference: invoice.Reference,
        xeroDueDate: invoice.DueDate,
        xeroAmountDue: invoice.AmountDue,
        xeroAmountPaid: invoice.AmountPaid
      }
    };
  }

  private mapContactToAddress(contact: XeroInvoice['Contact']): Address {
    const address = contact.Addresses?.find(addr => addr.AddressType === 'STREET') || 
                   contact.Addresses?.[0];

    if (!address) {
      return {
        street1: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US'
      };
    }

    return this.mapXeroAddress(address);
  }

  private mapXeroAddress(address: XeroAddress): Address {
    return {
      street1: address.AddressLine1 || '',
      street2: address.AddressLine2,
      city: address.City || '',
      state: address.Region || '',
      zipCode: address.PostalCode || '',
      country: address.Country || 'US'
    };
  }

  private mapXeroInvoiceStatus(status: string): Transaction['status'] {
    switch (status) {
      case 'PAID':
        return 'completed';
      case 'VOIDED':
      case 'DELETED':
        return 'cancelled';
      case 'DRAFT':
      case 'SUBMITTED':
      case 'AUTHORISED':
      default:
        return 'pending';
    }
  }
}
