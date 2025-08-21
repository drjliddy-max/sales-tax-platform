"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCalculator = void 0;
const models_1 = require("@/models");
const FirecrawlService_1 = require("@/services/tax-data-collection/FirecrawlService");
const TaxRateCacheService_1 = require("@/services/redis/TaxRateCacheService");
const JobQueueService_1 = require("@/services/redis/JobQueueService");
const SentryService_1 = require("@/services/monitoring/SentryService");
const utils_1 = require("@/utils");
class TaxCalculator {
    constructor() {
        this.firecrawlService = new FirecrawlService_1.FirecrawlService();
        this.cacheService = new TaxRateCacheService_1.TaxRateCacheService();
        this.jobQueue = JobQueueService_1.JobQueueService.getInstance();
    }
    async calculateTax(request, businessId) {
        const startTime = Date.now();
        const calculationId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const transaction = SentryService_1.sentryService.startTransaction('tax_calculation', 'financial.tax_calculation', {
            businessId,
            jurisdiction: `${request.address.city}, ${request.address.state}`,
            itemCount: request.items.length
        });
        try {
            if (request.customerTaxExempt) {
                transaction.setAttribute('tax_exempt', 'true');
                const result = this.createTaxExemptResult(request);
                SentryService_1.sentryService.trackTaxCalculationAccuracy({
                    businessId: businessId || 'default',
                    calculatedTax: 0,
                    confidence: 1.0,
                    jurisdiction: `${request.address.city}, ${request.address.state}`,
                    calculationTime: Date.now() - startTime
                });
                transaction.end();
                return result;
            }
            const applicableRates = await this.getApplicableTaxRatesWithCache(request.address);
            let cacheHit = false;
            let errorCount = 0;
            if (applicableRates.length === 0) {
                errorCount++;
                utils_1.logger.warn(`No tax rates found for ${request.address.city}, ${request.address.state}. Attempting to fetch current rates.`);
                SentryService_1.sentryService.captureFinancialError(new Error('Missing tax rates for jurisdiction'), {
                    businessId,
                    jurisdiction: `${request.address.city}, ${request.address.state}`,
                    severity: 'medium'
                });
                await this.jobQueue.addTaxRateUpdateJob({
                    states: [request.address.state],
                    force: true,
                    source: 'manual'
                }, 'high');
                await this.fetchMissingRates(request.address);
                const retryRates = await this.getApplicableTaxRatesWithCache(request.address);
                if (retryRates.length > 0) {
                    utils_1.logger.info(`Successfully fetched ${retryRates.length} tax rates for ${request.address.city}, ${request.address.state}`);
                }
                else {
                    errorCount++;
                    SentryService_1.sentryService.captureFinancialError(new Error('Failed to fetch tax rates after retry'), {
                        businessId,
                        jurisdiction: `${request.address.city}, ${request.address.state}`,
                        severity: 'critical'
                    });
                }
            }
            else {
                cacheHit = true;
            }
            const itemBreakdown = this.calculateItemTaxes(request.items, applicableRates);
            const taxBreakdown = this.calculateJurisdictionTaxes(itemBreakdown, applicableRates);
            const subtotal = request.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
            const totalTax = taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0);
            const grandTotal = subtotal + totalTax;
            const processingTime = Date.now() - startTime;
            const confidence = this.calculateConfidenceScore(applicableRates, taxBreakdown, errorCount);
            SentryService_1.sentryService.trackTaxCalculationAccuracy({
                businessId: businessId || 'default',
                calculatedTax: totalTax,
                confidence,
                jurisdiction: `${request.address.city}, ${request.address.state}`,
                calculationTime: processingTime
            });
            if (confidence < 0.8 && errorCount > 0) {
                SentryService_1.sentryService.captureFinancialError(new Error('Low confidence tax calculation'), {
                    businessId,
                    jurisdiction: `${request.address.city}, ${request.address.state}`,
                    amount: totalTax,
                    severity: confidence < 0.5 ? 'critical' : 'high'
                });
            }
            transaction.setAttribute('confidence_score', confidence.toString());
            transaction.setAttribute('cache_hit', cacheHit.toString());
            transaction.end();
            return {
                subtotal,
                totalTax,
                grandTotal,
                taxBreakdown,
                itemBreakdown
            };
        }
        catch (error) {
            SentryService_1.sentryService.captureFinancialError(error instanceof Error ? error : new Error('Tax calculation failed'), {
                businessId,
                jurisdiction: `${request.address.city}, ${request.address.state}`,
                severity: 'high'
            });
            transaction.setAttribute('error', 'true');
            transaction.end();
            throw error;
        }
    }
    calculateConfidenceScore(rates, breakdown, errorCount) {
        let score = 1.0;
        if (rates.length === 0) {
            score -= 0.5;
        }
        score -= (errorCount * 0.2);
        if (breakdown.length === 0) {
            score -= 0.3;
        }
        const now = new Date();
        const outdatedRates = rates.filter(rate => {
            const daysDiff = (now.getTime() - rate.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff > 30;
        });
        if (outdatedRates.length > 0) {
            score -= (outdatedRates.length / rates.length) * 0.2;
        }
        return Math.max(0, Math.min(1, score));
    }
    async fetchMissingRates(address) {
        try {
            const fetchedRates = await this.firecrawlService.crawlSpecificJurisdiction(address.state, address.city);
            if (fetchedRates.length > 0) {
                await this.firecrawlService.updateTaxRatesInDatabase(fetchedRates);
                utils_1.logger.info(`Fetched and stored ${fetchedRates.length} tax rates for ${address.city}, ${address.state}`);
            }
        }
        catch (error) {
            utils_1.logger.error(`Failed to fetch missing rates for ${address.city}, ${address.state}:`, error);
        }
    }
    async refreshRatesForLocation(address) {
        try {
            const updatedRates = await this.firecrawlService.collectTaxRateUpdates();
            const locationRates = updatedRates.filter(rate => rate.state === address.state &&
                (rate.jurisdiction.toLowerCase().includes(address.city.toLowerCase()) ||
                    rate.jurisdictionType === 'state'));
            if (locationRates.length > 0) {
                const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(locationRates);
                await this.cacheService.invalidateForJurisdiction(address.state, address.city);
                utils_1.logger.info(`Refreshed ${updateCount} tax rates for ${address.city}, ${address.state}`);
                return updateCount;
            }
            return 0;
        }
        catch (error) {
            utils_1.logger.error(`Failed to refresh rates for ${address.city}, ${address.state}:`, error);
            return 0;
        }
    }
    async calculateTaxAsync(request, businessId) {
        const job = await this.jobQueue.addTaxCalculationJob({
            transactionId: `temp_${Date.now()}`,
            businessId: businessId || 'default',
            recalculate: false
        }, 'normal');
        utils_1.logger.info(`Queued tax calculation job: ${job.id}`);
        return job.id?.toString() || '';
    }
    async preloadCacheForLocation(address) {
        try {
            const rates = await this.getApplicableTaxRates(address);
            if (rates.length > 0) {
                const cacheQuery = {
                    state: address.state,
                    jurisdiction: address.city,
                    address: {
                        street: address.street,
                        city: address.city,
                        state: address.state,
                        zipCode: address.zipCode
                    }
                };
                const cacheData = rates.map(rate => ({
                    id: rate._id.toString(),
                    state: rate.state,
                    jurisdiction: rate.jurisdiction,
                    jurisdictionType: rate.jurisdictionType,
                    rate: rate.rate,
                    effectiveDate: rate.effectiveDate,
                    lastUpdated: rate.lastUpdated || new Date(),
                    productCategories: rate.productCategories?.map(cat => cat.category) || [],
                    isActive: true
                }));
                await this.cacheService.cacheTaxRates(cacheQuery, cacheData);
                utils_1.logger.info(`Preloaded cache for ${address.city}, ${address.state}: ${rates.length} rates`);
            }
        }
        catch (error) {
            utils_1.logger.error(`Failed to preload cache for ${address.city}, ${address.state}:`, error);
        }
    }
    async getApplicableTaxRatesWithCache(address) {
        const cacheQuery = {
            state: address.state,
            jurisdiction: address.city,
            address: {
                street: address.street,
                city: address.city,
                state: address.state,
                zipCode: address.zipCode
            }
        };
        const cachedRates = await this.cacheService.getCachedTaxRates(cacheQuery);
        if (cachedRates && cachedRates.length > 0) {
            utils_1.logger.debug(`Using cached tax rates for ${address.city}, ${address.state}`);
            return this.convertCachedRatesToITaxRate(cachedRates);
        }
        const dbRates = await this.getApplicableTaxRates(address);
        if (dbRates.length > 0) {
            const cacheData = dbRates.map(rate => ({
                id: rate._id.toString(),
                state: rate.state,
                jurisdiction: rate.jurisdiction,
                jurisdictionType: rate.jurisdictionType,
                rate: rate.rate,
                effectiveDate: rate.effectiveDate,
                lastUpdated: rate.lastUpdated || new Date(),
                productCategories: rate.productCategories?.map(cat => cat.category) || [],
                isActive: true
            }));
            await this.cacheService.cacheTaxRates(cacheQuery, cacheData);
            utils_1.logger.debug(`Cached ${dbRates.length} tax rates for ${address.city}, ${address.state}`);
        }
        return dbRates;
    }
    convertCachedRatesToITaxRate(cachedRates) {
        return cachedRates.map(cached => ({
            _id: cached.id,
            state: cached.state,
            jurisdiction: cached.jurisdiction,
            jurisdictionType: cached.jurisdictionType,
            rate: cached.rate,
            effectiveDate: cached.effectiveDate,
            lastUpdated: cached.lastUpdated,
            productCategories: (cached.productCategories || []).map((category) => ({
                category,
                rate: cached.rate,
                exempt: false
            })),
            active: cached.isActive,
            source: 'manual'
        }));
    }
    async getApplicableTaxRates(address) {
        const query = {
            state: address.state,
            active: true,
            effectiveDate: { $lte: new Date() },
            $or: [
                { expirationDate: { $exists: false } },
                { expirationDate: { $gte: new Date() } }
            ]
        };
        const rates = await models_1.TaxRate.find(query);
        return rates.filter(rate => {
            if (rate.zipCode && rate.zipCode !== address.zipCode)
                return false;
            if (rate.city && rate.city.toLowerCase() !== address.city.toLowerCase())
                return false;
            if (rate.county && !this.matchesCounty(rate.county, address))
                return false;
            return true;
        });
    }
    calculateItemTaxes(items, rates) {
        return items.map(item => {
            const itemSubtotal = item.quantity * item.unitPrice;
            let itemTaxAmount = 0;
            for (const rate of rates) {
                const categoryRate = this.getCategoryRate(rate, item.taxCategory);
                if (categoryRate > 0) {
                    itemTaxAmount += itemSubtotal * (categoryRate / 100);
                }
            }
            return {
                id: item.id,
                subtotal: itemSubtotal,
                taxAmount: itemTaxAmount,
                total: itemSubtotal + itemTaxAmount
            };
        });
    }
    calculateJurisdictionTaxes(itemBreakdown, rates) {
        const jurisdictionTaxes = new Map();
        for (const rate of rates) {
            const key = `${rate.jurisdiction}-${rate.jurisdictionType}`;
            let taxableAmount = 0;
            let taxAmount = 0;
            for (const item of itemBreakdown) {
                const categoryRate = this.getCategoryRate(rate, 'default');
                if (categoryRate > 0) {
                    taxableAmount += item.subtotal;
                    taxAmount += item.subtotal * (categoryRate / 100);
                }
            }
            if (taxAmount > 0) {
                jurisdictionTaxes.set(key, {
                    jurisdiction: rate.jurisdiction,
                    jurisdictionType: rate.jurisdictionType,
                    rate: rate.rate,
                    taxableAmount,
                    taxAmount
                });
            }
        }
        return Array.from(jurisdictionTaxes.values());
    }
    getCategoryRate(taxRate, category) {
        const categoryConfig = taxRate.productCategories.find(cat => cat.category === category);
        if (categoryConfig) {
            return categoryConfig.exempt ? 0 : categoryConfig.rate;
        }
        return taxRate.rate;
    }
    matchesCounty(rateCounty, address) {
        return true;
    }
    createTaxExemptResult(request) {
        const subtotal = request.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const itemBreakdown = request.items.map(item => ({
            id: item.id,
            subtotal: item.quantity * item.unitPrice,
            taxAmount: 0,
            total: item.quantity * item.unitPrice
        }));
        return {
            subtotal,
            totalTax: 0,
            grandTotal: subtotal,
            taxBreakdown: [],
            itemBreakdown
        };
    }
}
exports.TaxCalculator = TaxCalculator;
//# sourceMappingURL=TaxCalculator.js.map