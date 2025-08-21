import { TaxRate, ITaxRate } from '@/models';
import { FirecrawlService } from '@/services/tax-data-collection/FirecrawlService';
import { TaxRateCacheService } from '@/services/redis/TaxRateCacheService';
import { JobQueueService } from '@/services/redis/JobQueueService';
import { sentryService } from '@/services/monitoring/SentryService';
import { logger } from '@/utils';

export interface TaxCalculationRequest {
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    taxCategory: string;
  }>;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  customerTaxExempt?: boolean;
}

export interface TaxCalculationResult {
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  taxBreakdown: Array<{
    jurisdiction: string;
    jurisdictionType: 'federal' | 'state' | 'county' | 'city' | 'special';
    rate: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
  itemBreakdown: Array<{
    id: string;
    subtotal: number;
    taxAmount: number;
    total: number;
  }>;
}

export class TaxCalculator {
  private firecrawlService: FirecrawlService;
  private cacheService: TaxRateCacheService;
  private jobQueue: JobQueueService;

  constructor() {
    this.firecrawlService = new FirecrawlService();
    this.cacheService = new TaxRateCacheService();
    this.jobQueue = JobQueueService.getInstance();
  }

  async calculateTax(request: TaxCalculationRequest, businessId?: string): Promise<TaxCalculationResult> {
    const startTime = Date.now();
    const calculationId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Start Sentry transaction for tax calculation
    const transaction = sentryService.startTransaction(
      'tax_calculation',
      'financial.tax_calculation',
      {
        businessId,
        jurisdiction: `${request.address.city}, ${request.address.state}`,
        itemCount: request.items.length
      }
    );

    try {
      if (request.customerTaxExempt) {
        transaction.setAttribute('tax_exempt', 'true');
        const result = this.createTaxExemptResult(request);
        
        // Track tax-exempt calculation
        sentryService.trackTaxCalculationAccuracy({
          businessId: businessId || 'default',
          calculatedTax: 0,
          confidence: 1.0,
          jurisdiction: `${request.address.city}, ${request.address.state}`,
          calculationTime: Date.now() - startTime
        });

        transaction.end();
        return result;
      }

      // Get applicable tax rates with monitoring
      const applicableRates = await this.getApplicableTaxRatesWithCache(request.address);

      let cacheHit = false;
      let errorCount = 0;
      
      // Check if we have current rates, if not try to fetch them
      if (applicableRates.length === 0) {
        errorCount++;
        logger.warn(`No tax rates found for ${request.address.city}, ${request.address.state}. Attempting to fetch current rates.`);
        
        // Capture missing rates as Sentry event
        sentryService.captureFinancialError(
          new Error('Missing tax rates for jurisdiction'),
          {
            businessId,
            jurisdiction: `${request.address.city}, ${request.address.state}`,
            severity: 'medium'
          }
        );

        // Queue background job to fetch missing rates
        await this.jobQueue.addTaxRateUpdateJob({
          states: [request.address.state],
          force: true,
          source: 'manual'
        }, 'high');
        
        // Fetch missing tax rates
        await this.fetchMissingRates(request.address);

        // Retry after fetching and cache the results
        const retryRates = await this.getApplicableTaxRatesWithCache(request.address);
        if (retryRates.length > 0) {
          logger.info(`Successfully fetched ${retryRates.length} tax rates for ${request.address.city}, ${request.address.state}`);
        } else {
          errorCount++;
          // Critical error - still no rates after fetch attempt
          sentryService.captureFinancialError(
            new Error('Failed to fetch tax rates after retry'),
            {
              businessId,
              jurisdiction: `${request.address.city}, ${request.address.state}`,
              severity: 'critical'
            }
          );
        }
      } else {
        cacheHit = true;
      }
      
      // Calculate taxes
      const itemBreakdown = this.calculateItemTaxes(request.items, applicableRates);
      const taxBreakdown = this.calculateJurisdictionTaxes(itemBreakdown, applicableRates);

      const subtotal = request.items.reduce((sum, item) => 
        sum + (item.quantity * item.unitPrice), 0
      );
      const totalTax = taxBreakdown.reduce((sum, tax) => sum + tax.taxAmount, 0);
      const grandTotal = subtotal + totalTax;

      const processingTime = Date.now() - startTime;
      
      // Calculate confidence score based on available data
      const confidence = this.calculateConfidenceScore(applicableRates, taxBreakdown, errorCount);

      // Track tax calculation accuracy in Sentry
      sentryService.trackTaxCalculationAccuracy({
        businessId: businessId || 'default',
        calculatedTax: totalTax,
        confidence,
        jurisdiction: `${request.address.city}, ${request.address.state}`,
        calculationTime: processingTime
      });

      // Alert on potential calculation issues
      if (confidence < 0.8 && errorCount > 0) {
        sentryService.captureFinancialError(
          new Error('Low confidence tax calculation'),
          {
            businessId,
            jurisdiction: `${request.address.city}, ${request.address.state}`,
            amount: totalTax,
            severity: confidence < 0.5 ? 'critical' : 'high'
          }
        );
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

    } catch (error) {
      
      // Capture calculation error
      sentryService.captureFinancialError(
        error instanceof Error ? error : new Error('Tax calculation failed'),
        {
          businessId,
          jurisdiction: `${request.address.city}, ${request.address.state}`,
          severity: 'high'
        }
      );

      transaction.setAttribute('error', 'true');
      transaction.end();
      
      throw error;
    }
  }

  private calculateConfidenceScore(rates: ITaxRate[], breakdown: any[], errorCount: number): number {
    let score = 1.0;
    
    // Reduce confidence for missing rates
    if (rates.length === 0) {
      score -= 0.5;
    }
    
    // Reduce confidence for errors during calculation
    score -= (errorCount * 0.2);
    
    // Reduce confidence for incomplete breakdown
    if (breakdown.length === 0) {
      score -= 0.3;
    }
    
    // Check for outdated rates
    const now = new Date();
    const outdatedRates = rates.filter(rate => {
      const daysDiff = (now.getTime() - rate.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 30; // Rates older than 30 days
    });
    
    if (outdatedRates.length > 0) {
      score -= (outdatedRates.length / rates.length) * 0.2;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  private async fetchMissingRates(address: any): Promise<void> {
    try {
      const fetchedRates = await this.firecrawlService.crawlSpecificJurisdiction(
        address.state, 
        address.city
      );
      
      if (fetchedRates.length > 0) {
        await this.firecrawlService.updateTaxRatesInDatabase(fetchedRates);
        logger.info(`Fetched and stored ${fetchedRates.length} tax rates for ${address.city}, ${address.state}`);
      }
    } catch (error) {
      logger.error(`Failed to fetch missing rates for ${address.city}, ${address.state}:`, error);
    }
  }

  async refreshRatesForLocation(address: any): Promise<number> {
    try {
      const updatedRates = await this.firecrawlService.collectTaxRateUpdates();
      const locationRates = updatedRates.filter(rate => 
        rate.state === address.state && 
        (rate.jurisdiction.toLowerCase().includes(address.city.toLowerCase()) || 
         rate.jurisdictionType === 'state')
      );
      
      if (locationRates.length > 0) {
        const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(locationRates);
        
        // Invalidate cache for this location
        await this.cacheService.invalidateForJurisdiction(address.state, address.city);
        
        logger.info(`Refreshed ${updateCount} tax rates for ${address.city}, ${address.state}`);
        return updateCount;
      }
      
      return 0;
    } catch (error) {
      logger.error(`Failed to refresh rates for ${address.city}, ${address.state}:`, error);
      return 0;
    }
  }

  async calculateTaxAsync(request: TaxCalculationRequest, businessId?: string): Promise<string> {
    // Queue tax calculation for complex scenarios
    const job = await this.jobQueue.addTaxCalculationJob({
      transactionId: `temp_${Date.now()}`,
      businessId: businessId || 'default',
      recalculate: false
    }, 'normal');
    
    logger.info(`Queued tax calculation job: ${job.id}`);
    return job.id?.toString() || '';
  }

  async preloadCacheForLocation(address: any): Promise<void> {
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
        logger.info(`Preloaded cache for ${address.city}, ${address.state}: ${rates.length} rates`);
      }
    } catch (error) {
      logger.error(`Failed to preload cache for ${address.city}, ${address.state}:`, error);
    }
  }

  private async getApplicableTaxRatesWithCache(address: any): Promise<ITaxRate[]> {
    // Try cache first
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
      logger.debug(`Using cached tax rates for ${address.city}, ${address.state}`);
      return this.convertCachedRatesToITaxRate(cachedRates);
    }
    
    // Cache miss - get from database
    const dbRates = await this.getApplicableTaxRates(address);
    
    // Cache the results for next time
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
      logger.debug(`Cached ${dbRates.length} tax rates for ${address.city}, ${address.state}`);
    }
    
    return dbRates;
  }

  private convertCachedRatesToITaxRate(cachedRates: any[]): ITaxRate[] {
    return cachedRates.map(cached => ({
      _id: cached.id,
      state: cached.state,
      jurisdiction: cached.jurisdiction,
      jurisdictionType: cached.jurisdictionType,
      rate: cached.rate,
      effectiveDate: cached.effectiveDate,
      lastUpdated: cached.lastUpdated,
      productCategories: (cached.productCategories || []).map((category: string) => ({
        category,
        rate: cached.rate,
        exempt: false
      })),
      active: cached.isActive,
      source: 'manual' as const
    } as unknown as ITaxRate));
  }

  private async getApplicableTaxRates(address: any): Promise<ITaxRate[]> {
    const query = {
      state: address.state,
      active: true,
      effectiveDate: { $lte: new Date() },
      $or: [
        { expirationDate: { $exists: false } },
        { expirationDate: { $gte: new Date() } }
      ]
    };

    const rates = await TaxRate.find(query);
    
    return rates.filter(rate => {
      if (rate.zipCode && rate.zipCode !== address.zipCode) return false;
      if (rate.city && rate.city.toLowerCase() !== address.city.toLowerCase()) return false;
      if (rate.county && !this.matchesCounty(rate.county, address)) return false;
      return true;
    });
  }

  private calculateItemTaxes(items: any[], rates: ITaxRate[]) {
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

  private calculateJurisdictionTaxes(itemBreakdown: any[], rates: ITaxRate[]) {
    const jurisdictionTaxes = new Map();

    for (const rate of rates) {
      const key = `${rate.jurisdiction}-${rate.jurisdictionType}`;
      let taxableAmount = 0;
      let taxAmount = 0;

      for (const item of itemBreakdown) {
        const categoryRate = this.getCategoryRate(rate, 'default'); // Simplified for now
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

  private getCategoryRate(taxRate: ITaxRate, category: string): number {
    const categoryConfig = taxRate.productCategories.find(
      cat => cat.category === category
    );
    
    if (categoryConfig) {
      return categoryConfig.exempt ? 0 : categoryConfig.rate;
    }
    
    return taxRate.rate;
  }

  private matchesCounty(rateCounty: string, address: any): boolean {
    // This would need to be implemented with proper county lookup logic
    return true; // Simplified for now
  }

  private createTaxExemptResult(request: TaxCalculationRequest): TaxCalculationResult {
    const subtotal = request.items.reduce((sum, item) => 
      sum + (item.quantity * item.unitPrice), 0
    );

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