/**
 * Universal Data Transformer
 * Standardizes tax data from different POS systems into a common format
 */

import {
  POSSystemType,
  TaxDataSchema,
  StandardizedTaxData,
  TaxLine,
  LocationInfo,
  LineItemTax,
  POSIntegrationError
} from './types';

export class TaxDataTransformer {
  private schema: TaxDataSchema;
  private posType: POSSystemType;

  constructor(posType: POSSystemType, schema: TaxDataSchema) {
    this.posType = posType;
    this.schema = schema;
  }

  /**
   * Transform raw POS data to standardized format
   */
  public transform(rawData: any): StandardizedTaxData {
    try {
      return {
        transactionId: this.extractTransactionId(rawData),
        timestamp: this.extractTimestamp(rawData),
        totalAmount: this.extractTotalAmount(rawData),
        totalTax: this.extractTotalTax(rawData),
        taxBreakdown: this.extractTaxLines(rawData),
        location: this.extractLocation(rawData),
        lineItems: this.extractLineItems(rawData),
        currency: this.extractCurrency(rawData),
        status: this.extractStatus(rawData),
        metadata: this.extractMetadata(rawData)
      };
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to transform ${this.posType} data: ${error.message}`,
        'TRANSFORMATION_FAILED',
        this.posType,
        undefined,
        false,
        { rawData, error: error.message }
      );
    }
  }

  /**
   * Extract transaction ID from raw data
   */
  private extractTransactionId(data: any): string {
    const id = this.extractValue(data, this.schema.transactionIdField);
    if (!id) {
      throw new Error('Transaction ID not found');
    }
    return String(id);
  }

  /**
   * Extract timestamp from raw data
   */
  private extractTimestamp(data: any): Date {
    const timestamp = this.extractValue(data, this.schema.timestampField);
    if (!timestamp) {
      throw new Error('Timestamp not found');
    }

    // Handle different timestamp formats
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp format: ${timestamp}`);
    }

    return date;
  }

  /**
   * Extract total amount from raw data
   */
  private extractTotalAmount(data: any): number {
    const amount = this.extractValue(data, this.schema.totalAmountField);
    if (amount === undefined || amount === null) {
      throw new Error('Total amount not found');
    }

    const numericAmount = this.normalizeAmount(amount);
    if (isNaN(numericAmount)) {
      throw new Error(`Invalid total amount: ${amount}`);
    }

    return numericAmount;
  }

  /**
   * Extract total tax from raw data
   */
  private extractTotalTax(data: any): number {
    const tax = this.extractValue(data, this.schema.totalTaxField);
    if (tax === undefined || tax === null) {
      return 0; // Tax might be 0 for tax-exempt transactions
    }

    const numericTax = this.normalizeAmount(tax);
    return isNaN(numericTax) ? 0 : numericTax;
  }

  /**
   * Extract tax breakdown lines from raw data
   */
  private extractTaxLines(data: any): TaxLine[] {
    const taxLinesData = this.extractValue(data, this.schema.taxLinesField);
    if (!taxLinesData || !Array.isArray(taxLinesData)) {
      return [];
    }

    return taxLinesData.map((line: any, index: number) => {
      try {
        return this.transformTaxLine(line, index);
      } catch (error) {
        console.warn(`Failed to transform tax line ${index}:`, error);
        return null;
      }
    }).filter(Boolean) as TaxLine[];
  }

  /**
   * Transform individual tax line
   */
  private transformTaxLine(line: any, index: number): TaxLine {
    const rate = this.extractValue(line, this.schema.taxRateField);
    const amount = this.extractValue(line, this.schema.taxAmountField);
    const jurisdiction = this.schema.jurisdictionField ? 
      this.extractValue(line, this.schema.jurisdictionField) : 'unknown';

    return {
      name: this.extractTaxLineName(line, index),
      rate: this.normalizeTaxRate(rate),
      amount: this.normalizeAmount(amount) || 0,
      jurisdiction: String(jurisdiction || 'unknown'),
      type: this.determineTaxType(line, rate),
      scope: this.determineTaxScope(jurisdiction)
    };
  }

  /**
   * Extract tax line name
   */
  private extractTaxLineName(line: any, index: number): string {
    // Try common field names for tax line names
    const nameFields = ['name', 'title', 'description', 'type', 'taxName'];
    
    for (const field of nameFields) {
      const name = line[field];
      if (name && typeof name === 'string') {
        return name;
      }
    }

    // Fallback to generic name
    return `Tax ${index + 1}`;
  }

  /**
   * Extract location information from raw data
   */
  private extractLocation(data: any): LocationInfo {
    const locationId = this.extractValue(data, this.schema.locationField);
    
    // Basic location info - may be enhanced by specific adapters
    return {
      id: String(locationId || 'unknown'),
      name: this.extractLocationName(data),
      address: this.extractLocationAddress(data),
      timezone: this.extractTimezone(data),
      taxSettings: this.extractTaxSettings(data)
    };
  }

  /**
   * Extract location name
   */
  private extractLocationName(data: any): string | undefined {
    const nameFields = ['locationName', 'location_name', 'storeName', 'store_name', 'shopName', 'shop_name'];
    
    for (const field of nameFields) {
      const name = this.extractValue(data, field);
      if (name && typeof name === 'string') {
        return name;
      }
    }

    return undefined;
  }

  /**
   * Extract location address
   */
  private extractLocationAddress(data: any): LocationInfo['address'] {
    // Try to extract address components
    const addressFields = {
      street: ['street', 'address1', 'address_line_1', 'street_address'],
      city: ['city', 'locality'],
      state: ['state', 'province', 'region', 'administrative_area_level_1'],
      zipCode: ['zipCode', 'zip_code', 'postal_code', 'postcode'],
      country: ['country', 'country_code', 'countryCode']
    };

    const address: LocationInfo['address'] = {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US' // Default to US
    };

    for (const [key, fields] of Object.entries(addressFields)) {
      for (const field of fields) {
        const value = this.extractValue(data, field);
        if (value && typeof value === 'string') {
          (address as any)[key] = value;
          break;
        }
      }
    }

    return address;
  }

  /**
   * Extract timezone
   */
  private extractTimezone(data: any): string | undefined {
    const timezoneFields = ['timezone', 'time_zone', 'tz'];
    
    for (const field of timezoneFields) {
      const tz = this.extractValue(data, field);
      if (tz && typeof tz === 'string') {
        return tz;
      }
    }

    return undefined;
  }

  /**
   * Extract tax settings
   */
  private extractTaxSettings(data: any): LocationInfo['taxSettings'] | undefined {
    const taxIncludedFields = ['taxIncluded', 'tax_included', 'pricesIncludeTax'];
    const taxRateFields = ['defaultTaxRate', 'default_tax_rate', 'taxRate'];

    let taxIncluded = false;
    let defaultTaxRate: number | undefined;

    for (const field of taxIncludedFields) {
      const value = this.extractValue(data, field);
      if (typeof value === 'boolean') {
        taxIncluded = value;
        break;
      }
    }

    for (const field of taxRateFields) {
      const value = this.extractValue(data, field);
      if (typeof value === 'number' || typeof value === 'string') {
        const rate = this.normalizeTaxRate(value);
        if (!isNaN(rate)) {
          defaultTaxRate = rate;
          break;
        }
      }
    }

    return {
      taxIncluded,
      defaultTaxRate,
      exemptions: []
    };
  }

  /**
   * Extract line items from raw data
   */
  private extractLineItems(data: any): LineItemTax[] {
    if (!this.schema.lineItemsField) {
      return [];
    }

    const lineItemsData = this.extractValue(data, this.schema.lineItemsField);
    if (!lineItemsData || !Array.isArray(lineItemsData)) {
      return [];
    }

    return lineItemsData.map((item: any, index: number) => {
      try {
        return this.transformLineItem(item, index);
      } catch (error) {
        console.warn(`Failed to transform line item ${index}:`, error);
        return null;
      }
    }).filter(Boolean) as LineItemTax[];
  }

  /**
   * Transform individual line item
   */
  private transformLineItem(item: any, index: number): LineItemTax {
    const itemIdFields = ['id', 'itemId', 'item_id', 'lineItemId', 'sku'];
    const nameFields = ['name', 'title', 'description', 'itemName', 'item_name'];
    const quantityFields = ['quantity', 'qty'];
    const priceFields = ['price', 'unitPrice', 'unit_price', 'basePrice', 'base_price'];
    const totalFields = ['total', 'totalPrice', 'total_price', 'amount'];

    const itemId = this.findFieldValue(item, itemIdFields) || `item_${index}`;
    const itemName = this.findFieldValue(item, nameFields) || `Item ${index + 1}`;
    const quantity = Number(this.findFieldValue(item, quantityFields) || 1);
    const unitPrice = this.normalizeAmount(this.findFieldValue(item, priceFields) || 0);
    const totalPrice = this.normalizeAmount(this.findFieldValue(item, totalFields) || unitPrice * quantity);

    return {
      itemId: String(itemId),
      itemName: String(itemName),
      quantity,
      unitPrice,
      totalPrice,
      taxes: this.extractItemTaxes(item),
      taxExempt: this.isItemTaxExempt(item),
      category: this.extractItemCategory(item)
    };
  }

  /**
   * Extract taxes for individual line item
   */
  private extractItemTaxes(item: any): TaxLine[] {
    const taxFields = ['taxes', 'tax_lines', 'taxLines', 'appliedTaxes', 'modifications'];
    
    for (const field of taxFields) {
      const taxes = item[field];
      if (taxes && Array.isArray(taxes)) {
        return taxes.map((tax: any, index: number) => this.transformTaxLine(tax, index))
          .filter(Boolean) as TaxLine[];
      }
    }

    return [];
  }

  /**
   * Check if item is tax exempt
   */
  private isItemTaxExempt(item: any): boolean {
    const exemptFields = ['taxExempt', 'tax_exempt', 'isTaxExempt', 'is_tax_exempt'];
    
    for (const field of exemptFields) {
      const value = item[field];
      if (typeof value === 'boolean') {
        return value;
      }
    }

    return false;
  }

  /**
   * Extract item category
   */
  private extractItemCategory(item: any): string | undefined {
    const categoryFields = ['category', 'categoryName', 'category_name', 'type', 'itemType'];
    
    for (const field of categoryFields) {
      const value = item[field];
      if (value && typeof value === 'string') {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Extract currency from raw data
   */
  private extractCurrency(data: any): string {
    const currencyFields = ['currency', 'currency_code', 'currencyCode'];
    
    for (const field of currencyFields) {
      const currency = this.extractValue(data, field);
      if (currency && typeof currency === 'string') {
        return currency.toUpperCase();
      }
    }

    return 'USD'; // Default currency
  }

  /**
   * Extract transaction status
   */
  private extractStatus(data: any): StandardizedTaxData['status'] {
    if (!this.schema.statusField) {
      return 'completed';
    }

    const status = this.extractValue(data, this.schema.statusField);
    if (!status) {
      return 'completed';
    }

    return this.normalizeStatus(String(status));
  }

  /**
   * Extract metadata
   */
  private extractMetadata(data: any): Record<string, any> {
    return {
      posType: this.posType,
      originalData: data,
      transformedAt: new Date().toISOString()
    };
  }

  /**
   * Extract value using dot notation path
   */
  private extractValue(data: any, path: string): any {
    if (!path || !data) return undefined;

    const keys = path.split('.');
    let current = data;

    for (const key of keys) {
      if (key.includes('[') && key.includes(']')) {
        // Handle array notation like 'items[0].name'
        const [arrayKey, indexStr] = key.split('[');
        const index = parseInt(indexStr.replace(']', ''), 10);
        
        current = current?.[arrayKey];
        if (Array.isArray(current) && !isNaN(index)) {
          current = current[index];
        }
      } else {
        current = current?.[key];
      }

      if (current === undefined || current === null) {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Find field value from array of possible field names
   */
  private findFieldValue(obj: any, fields: string[]): any {
    for (const field of fields) {
      const value = obj[field];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Normalize amount values (handle cents, different formats)
   */
  private normalizeAmount(amount: any): number {
    if (amount === undefined || amount === null) {
      return 0;
    }

    if (typeof amount === 'number') {
      // For Square and some others that use cents
      if (this.posType === 'square' && amount > 100) {
        return amount / 100;
      }
      return amount;
    }

    if (typeof amount === 'string') {
      const parsed = parseFloat(amount.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }

    // Handle object format like {amount: 1000, currency: 'USD'}
    if (typeof amount === 'object' && amount.amount !== undefined) {
      return this.normalizeAmount(amount.amount);
    }

    return 0;
  }

  /**
   * Normalize tax rate (handle percentages vs decimals)
   */
  private normalizeTaxRate(rate: any): number {
    if (rate === undefined || rate === null) {
      return 0;
    }

    if (typeof rate === 'number') {
      // Convert percentage to decimal if needed
      return rate > 1 ? rate / 100 : rate;
    }

    if (typeof rate === 'string') {
      const parsed = parseFloat(rate.replace(/[^0-9.-]/g, ''));
      if (isNaN(parsed)) return 0;
      return parsed > 1 ? parsed / 100 : parsed;
    }

    return 0;
  }

  /**
   * Determine tax type (percentage vs fixed)
   */
  private determineTaxType(line: any, rate: any): 'percentage' | 'fixed' {
    // Check for explicit type field
    const typeFields = ['type', 'taxType', 'tax_type'];
    for (const field of typeFields) {
      const type = line[field];
      if (typeof type === 'string') {
        const lowerType = type.toLowerCase();
        if (lowerType.includes('percent') || lowerType.includes('rate')) {
          return 'percentage';
        }
        if (lowerType.includes('fixed') || lowerType.includes('flat')) {
          return 'fixed';
        }
      }
    }

    // Infer from rate value
    if (rate !== undefined && rate !== null) {
      const numericRate = this.normalizeTaxRate(rate);
      return numericRate > 0 ? 'percentage' : 'fixed';
    }

    return 'percentage';
  }

  /**
   * Determine tax scope from jurisdiction
   */
  private determineTaxScope(jurisdiction: string): TaxLine['scope'] {
    if (!jurisdiction) return undefined;

    const lowerJurisdiction = jurisdiction.toLowerCase();
    
    if (lowerJurisdiction.includes('state')) return 'state';
    if (lowerJurisdiction.includes('county')) return 'county';
    if (lowerJurisdiction.includes('city') || lowerJurisdiction.includes('municipal')) return 'city';
    if (lowerJurisdiction.includes('special') || lowerJurisdiction.includes('district')) return 'special';

    return undefined;
  }

  /**
   * Normalize transaction status
   */
  private normalizeStatus(status: string): StandardizedTaxData['status'] {
    const lowerStatus = status.toLowerCase();

    if (lowerStatus.includes('complet') || lowerStatus.includes('paid') || lowerStatus.includes('success')) {
      return 'completed';
    }
    if (lowerStatus.includes('pending') || lowerStatus.includes('processing')) {
      return 'pending';
    }
    if (lowerStatus.includes('fail') || lowerStatus.includes('error') || lowerStatus.includes('cancel')) {
      return 'failed';
    }
    if (lowerStatus.includes('refund') || lowerStatus.includes('void')) {
      return 'refunded';
    }

    return 'completed'; // Default to completed
  }
}
