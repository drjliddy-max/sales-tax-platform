"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxDataTransformer = void 0;
const types_1 = require("./types");
class TaxDataTransformer {
    constructor(posType, schema) {
        this.posType = posType;
        this.schema = schema;
    }
    transform(rawData) {
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
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to transform ${this.posType} data: ${error.message}`, 'TRANSFORMATION_FAILED', this.posType, undefined, false, { rawData, error: error.message });
        }
    }
    extractTransactionId(data) {
        const id = this.extractValue(data, this.schema.transactionIdField);
        if (!id) {
            throw new Error('Transaction ID not found');
        }
        return String(id);
    }
    extractTimestamp(data) {
        const timestamp = this.extractValue(data, this.schema.timestampField);
        if (!timestamp) {
            throw new Error('Timestamp not found');
        }
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid timestamp format: ${timestamp}`);
        }
        return date;
    }
    extractTotalAmount(data) {
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
    extractTotalTax(data) {
        const tax = this.extractValue(data, this.schema.totalTaxField);
        if (tax === undefined || tax === null) {
            return 0;
        }
        const numericTax = this.normalizeAmount(tax);
        return isNaN(numericTax) ? 0 : numericTax;
    }
    extractTaxLines(data) {
        const taxLinesData = this.extractValue(data, this.schema.taxLinesField);
        if (!taxLinesData || !Array.isArray(taxLinesData)) {
            return [];
        }
        return taxLinesData.map((line, index) => {
            try {
                return this.transformTaxLine(line, index);
            }
            catch (error) {
                console.warn(`Failed to transform tax line ${index}:`, error);
                return null;
            }
        }).filter(Boolean);
    }
    transformTaxLine(line, index) {
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
    extractTaxLineName(line, index) {
        const nameFields = ['name', 'title', 'description', 'type', 'taxName'];
        for (const field of nameFields) {
            const name = line[field];
            if (name && typeof name === 'string') {
                return name;
            }
        }
        return `Tax ${index + 1}`;
    }
    extractLocation(data) {
        const locationId = this.extractValue(data, this.schema.locationField);
        return {
            id: String(locationId || 'unknown'),
            name: this.extractLocationName(data),
            address: this.extractLocationAddress(data),
            timezone: this.extractTimezone(data),
            taxSettings: this.extractTaxSettings(data)
        };
    }
    extractLocationName(data) {
        const nameFields = ['locationName', 'location_name', 'storeName', 'store_name', 'shopName', 'shop_name'];
        for (const field of nameFields) {
            const name = this.extractValue(data, field);
            if (name && typeof name === 'string') {
                return name;
            }
        }
        return undefined;
    }
    extractLocationAddress(data) {
        const addressFields = {
            street: ['street', 'address1', 'address_line_1', 'street_address'],
            city: ['city', 'locality'],
            state: ['state', 'province', 'region', 'administrative_area_level_1'],
            zipCode: ['zipCode', 'zip_code', 'postal_code', 'postcode'],
            country: ['country', 'country_code', 'countryCode']
        };
        const address = {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'US'
        };
        for (const [key, fields] of Object.entries(addressFields)) {
            for (const field of fields) {
                const value = this.extractValue(data, field);
                if (value && typeof value === 'string') {
                    address[key] = value;
                    break;
                }
            }
        }
        return address;
    }
    extractTimezone(data) {
        const timezoneFields = ['timezone', 'time_zone', 'tz'];
        for (const field of timezoneFields) {
            const tz = this.extractValue(data, field);
            if (tz && typeof tz === 'string') {
                return tz;
            }
        }
        return undefined;
    }
    extractTaxSettings(data) {
        const taxIncludedFields = ['taxIncluded', 'tax_included', 'pricesIncludeTax'];
        const taxRateFields = ['defaultTaxRate', 'default_tax_rate', 'taxRate'];
        let taxIncluded = false;
        let defaultTaxRate;
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
    extractLineItems(data) {
        if (!this.schema.lineItemsField) {
            return [];
        }
        const lineItemsData = this.extractValue(data, this.schema.lineItemsField);
        if (!lineItemsData || !Array.isArray(lineItemsData)) {
            return [];
        }
        return lineItemsData.map((item, index) => {
            try {
                return this.transformLineItem(item, index);
            }
            catch (error) {
                console.warn(`Failed to transform line item ${index}:`, error);
                return null;
            }
        }).filter(Boolean);
    }
    transformLineItem(item, index) {
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
    extractItemTaxes(item) {
        const taxFields = ['taxes', 'tax_lines', 'taxLines', 'appliedTaxes', 'modifications'];
        for (const field of taxFields) {
            const taxes = item[field];
            if (taxes && Array.isArray(taxes)) {
                return taxes.map((tax, index) => this.transformTaxLine(tax, index))
                    .filter(Boolean);
            }
        }
        return [];
    }
    isItemTaxExempt(item) {
        const exemptFields = ['taxExempt', 'tax_exempt', 'isTaxExempt', 'is_tax_exempt'];
        for (const field of exemptFields) {
            const value = item[field];
            if (typeof value === 'boolean') {
                return value;
            }
        }
        return false;
    }
    extractItemCategory(item) {
        const categoryFields = ['category', 'categoryName', 'category_name', 'type', 'itemType'];
        for (const field of categoryFields) {
            const value = item[field];
            if (value && typeof value === 'string') {
                return value;
            }
        }
        return undefined;
    }
    extractCurrency(data) {
        const currencyFields = ['currency', 'currency_code', 'currencyCode'];
        for (const field of currencyFields) {
            const currency = this.extractValue(data, field);
            if (currency && typeof currency === 'string') {
                return currency.toUpperCase();
            }
        }
        return 'USD';
    }
    extractStatus(data) {
        if (!this.schema.statusField) {
            return 'completed';
        }
        const status = this.extractValue(data, this.schema.statusField);
        if (!status) {
            return 'completed';
        }
        return this.normalizeStatus(String(status));
    }
    extractMetadata(data) {
        return {
            posType: this.posType,
            originalData: data,
            transformedAt: new Date().toISOString()
        };
    }
    extractValue(data, path) {
        if (!path || !data)
            return undefined;
        const keys = path.split('.');
        let current = data;
        for (const key of keys) {
            if (key.includes('[') && key.includes(']')) {
                const [arrayKey, indexStr] = key.split('[');
                const index = parseInt(indexStr.replace(']', ''), 10);
                current = current?.[arrayKey];
                if (Array.isArray(current) && !isNaN(index)) {
                    current = current[index];
                }
            }
            else {
                current = current?.[key];
            }
            if (current === undefined || current === null) {
                return undefined;
            }
        }
        return current;
    }
    findFieldValue(obj, fields) {
        for (const field of fields) {
            const value = obj[field];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
        return undefined;
    }
    normalizeAmount(amount) {
        if (amount === undefined || amount === null) {
            return 0;
        }
        if (typeof amount === 'number') {
            if (this.posType === 'square' && amount > 100) {
                return amount / 100;
            }
            return amount;
        }
        if (typeof amount === 'string') {
            const parsed = parseFloat(amount.replace(/[^0-9.-]/g, ''));
            return isNaN(parsed) ? 0 : parsed;
        }
        if (typeof amount === 'object' && amount.amount !== undefined) {
            return this.normalizeAmount(amount.amount);
        }
        return 0;
    }
    normalizeTaxRate(rate) {
        if (rate === undefined || rate === null) {
            return 0;
        }
        if (typeof rate === 'number') {
            return rate > 1 ? rate / 100 : rate;
        }
        if (typeof rate === 'string') {
            const parsed = parseFloat(rate.replace(/[^0-9.-]/g, ''));
            if (isNaN(parsed))
                return 0;
            return parsed > 1 ? parsed / 100 : parsed;
        }
        return 0;
    }
    determineTaxType(line, rate) {
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
        if (rate !== undefined && rate !== null) {
            const numericRate = this.normalizeTaxRate(rate);
            return numericRate > 0 ? 'percentage' : 'fixed';
        }
        return 'percentage';
    }
    determineTaxScope(jurisdiction) {
        if (!jurisdiction)
            return undefined;
        const lowerJurisdiction = jurisdiction.toLowerCase();
        if (lowerJurisdiction.includes('state'))
            return 'state';
        if (lowerJurisdiction.includes('county'))
            return 'county';
        if (lowerJurisdiction.includes('city') || lowerJurisdiction.includes('municipal'))
            return 'city';
        if (lowerJurisdiction.includes('special') || lowerJurisdiction.includes('district'))
            return 'special';
        return undefined;
    }
    normalizeStatus(status) {
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
        return 'completed';
    }
}
exports.TaxDataTransformer = TaxDataTransformer;
//# sourceMappingURL=transformer.js.map