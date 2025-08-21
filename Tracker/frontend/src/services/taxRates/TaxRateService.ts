import { 
  TaxRateProvider, 
  TaxRateQuery, 
  TaxRateResponse, 
  TaxRateValidation,
  TaxRate,
  TaxRateUpdate,
  taxRateProviderRegistry 
} from './TaxRateProvider';
import { TaxRateCache, taxRateCache } from './TaxRateCache';
import { AvalaraProvider } from './AvalaraProvider';
import { TimeoutError, NetworkError } from '../../utils/fetchUtils';

export interface TaxRateServiceConfig {
  primaryProvider: string;
  fallbackProviders: string[];
  enableCaching: boolean;
  enableFallback: boolean;
  maxRetries: number;
  timeoutMs: number;
  enableMetrics: boolean;
}

export interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHitRate: number;
  averageResponseTime: number;
  providerUsage: Record<string, number>;
  errorsByProvider: Record<string, number>;
  lastError?: string;
  uptime: number;
}

export interface ProviderHealth {
  name: string;
  isHealthy: boolean;
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  consecutiveFailures: number;
}

export class TaxRateService {
  private config: TaxRateServiceConfig;
  private cache: TaxRateCache;
  private metrics: ServiceMetrics;
  private providerHealth = new Map<string, ProviderHealth>();
  private startTime = Date.now();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: Partial<TaxRateServiceConfig> = {}) {
    this.config = {
      primaryProvider: 'avalara',
      fallbackProviders: ['internal'],
      enableCaching: true,
      enableFallback: true,
      maxRetries: 3,
      timeoutMs: 10000,
      enableMetrics: true,
      ...config
    };

    this.cache = taxRateCache;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      providerUsage: {},
      errorsByProvider: {},
      uptime: 0
    };

    this.initializeHealthChecks();
  }

  /**
   * Get tax rates for a specific query with caching and fallback
   */
  async getRates(query: TaxRateQuery): Promise<TaxRateResponse> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Try cache first if enabled
      if (this.config.enableCaching) {
        const cached = await this.cache.get(query);
        if (cached) {
          this.updateMetrics(startTime, 'cache', true);
          return cached;
        }
      }

      // Try primary provider
      const primaryProvider = taxRateProviderRegistry.getProvider(this.config.primaryProvider);
      if (primaryProvider && this.isProviderHealthy(this.config.primaryProvider)) {
        try {
          const response = await this.makeRequestWithTimeout(primaryProvider, query);
          
          // Cache successful response
          if (this.config.enableCaching) {
            await this.cache.set(query, response);
          }
          
          this.updateMetrics(startTime, this.config.primaryProvider, true);
          this.updateProviderHealth(this.config.primaryProvider, true, Date.now() - startTime);
          
          return response;
        } catch (error) {
          console.warn(`Primary provider ${this.config.primaryProvider} failed:`, error);
          this.updateProviderHealth(this.config.primaryProvider, false);
          
          if (!this.config.enableFallback) {
            throw error;
          }
        }
      }

      // Try fallback providers if enabled
      if (this.config.enableFallback) {
        for (const providerName of this.config.fallbackProviders) {
          const provider = taxRateProviderRegistry.getProvider(providerName);
          
          if (provider && this.isProviderHealthy(providerName)) {
            try {
              const response = await this.makeRequestWithTimeout(provider, query);
              
              // Cache successful response
              if (this.config.enableCaching) {
                await this.cache.set(query, response);
              }
              
              this.updateMetrics(startTime, providerName, true);
              this.updateProviderHealth(providerName, true, Date.now() - startTime);
              
              return response;
            } catch (error) {
              console.warn(`Fallback provider ${providerName} failed:`, error);
              this.updateProviderHealth(providerName, false);
              continue;
            }
          }
        }
      }

      // All providers failed
      const error = new Error('All tax rate providers failed');
      this.updateMetrics(startTime, 'none', false);
      this.metrics.lastError = error.message;
      throw error;

    } catch (error) {
      this.updateMetrics(startTime, 'error', false);
      throw error;
    }
  }

  /**
   * Validate address using the best available provider with comprehensive error handling
   */
  async validateAddress(address: TaxRateQuery['address']): Promise<TaxRateValidation> {
    const providers = [
      this.config.primaryProvider,
      ...this.config.fallbackProviders
    ];

    let lastError: any;
    const attemptedProviders: string[] = [];

    for (const providerName of providers) {
      const provider = taxRateProviderRegistry.getProvider(providerName);
      
      if (provider && this.isProviderHealthy(providerName)) {
        attemptedProviders.push(providerName);
        
        try {
          const result = await provider.validateAddress(address);
          
          // Update provider health on success
          this.updateProviderHealth(providerName, true);
          
          return result;
        } catch (error) {
          lastError = error;
          
          // Update provider health on failure
          this.updateProviderHealth(providerName, false);
          
          if (error instanceof TimeoutError) {
            console.warn(`Address validation timeout for ${providerName} (${error.timeoutMs}ms):`, error.message);
          } else if (error instanceof NetworkError) {
            console.warn(`Address validation network error for ${providerName}:`, error.message);
          } else {
            console.warn(`Address validation failed for ${providerName}:`, error);
          }
          
          continue;
        }
      }
    }

    // Generate comprehensive fallback validation with error details
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (attemptedProviders.length === 0) {
      errors.push('No address validation providers are currently available');
      warnings.push('All validation services are offline. Address may be used as-is.');
    } else {
      if (lastError instanceof TimeoutError) {
        errors.push(`Address validation timed out after ${lastError.timeoutMs}ms`);
        warnings.push('Validation service is slow. Try again later or proceed with caution.');
      } else if (lastError instanceof NetworkError) {
        errors.push('Network connectivity issues preventing address validation');
        warnings.push('Check your internet connection and try again.');
      } else {
        errors.push(`All validation providers failed: ${attemptedProviders.join(', ')}`);
        warnings.push('Address validation temporarily unavailable. Proceeding with basic validation.');
      }
    }
    
    // Perform basic client-side validation as fallback
    const basicValidation = this.performBasicAddressValidation(address);
    
    return {
      isValid: basicValidation.isValid,
      confidence: basicValidation.confidence,
      warnings: [...warnings, ...basicValidation.warnings],
      errors: [...errors, ...basicValidation.errors],
      suggestedCorrections: basicValidation.suggestedCorrections
    };
  }

  /**
   * Get rate history for a jurisdiction
   */
  async getRateHistory(jurisdiction: string, startDate: Date, endDate: Date): Promise<TaxRate[]> {
    const primaryProvider = taxRateProviderRegistry.getProvider(this.config.primaryProvider);
    
    if (primaryProvider) {
      try {
        return await primaryProvider.getRateHistory(jurisdiction, startDate, endDate);
      } catch (error) {
        console.warn('Rate history failed:', error);
      }
    }

    return [];
  }

  /**
   * Subscribe to rate change notifications
   */
  async subscribeToUpdates(callback: (update: TaxRateUpdate) => void): Promise<string[]> {
    const subscriptionIds: string[] = [];
    
    // Subscribe to all available providers
    const providers = taxRateProviderRegistry.getAllProviders();
    
    for (const provider of providers) {
      try {
        const subscriptionId = await provider.subscribeToUpdates((update) => {
          // Invalidate cache when rates change
          if (this.config.enableCaching) {
            this.cache.invalidateByJurisdiction(update.jurisdiction);
          }
          
          callback(update);
        });
        
        subscriptionIds.push(`${provider.getName()}:${subscriptionId}`);
      } catch (error) {
        console.warn(`Failed to subscribe to ${provider.getName()}:`, error);
      }
    }

    return subscriptionIds;
  }

  /**
   * Unsubscribe from rate change notifications
   */
  async unsubscribeFromUpdates(subscriptionIds: string[]): Promise<void> {
    for (const fullId of subscriptionIds) {
      const [providerName, subscriptionId] = fullId.split(':');
      const provider = taxRateProviderRegistry.getProvider(providerName);
      
      if (provider) {
        try {
          await provider.unsubscribeFromUpdates(subscriptionId);
        } catch (error) {
          console.warn(`Failed to unsubscribe from ${providerName}:`, error);
        }
      }
    }
  }

  /**
   * Get batch rates for multiple queries
   */
  async getBatchRates(queries: TaxRateQuery[]): Promise<TaxRateResponse[]> {
    // Check cache for all queries first
    const results: TaxRateResponse[] = [];
    const uncachedQueries: { index: number; query: TaxRateQuery }[] = [];

    if (this.config.enableCaching) {
      for (let i = 0; i < queries.length; i++) {
        const cached = await this.cache.get(queries[i]);
        if (cached) {
          results[i] = cached;
        } else {
          uncachedQueries.push({ index: i, query: queries[i] });
        }
      }
    } else {
      uncachedQueries.push(...queries.map((query, index) => ({ index, query })));
    }

    // Get uncached queries from provider
    if (uncachedQueries.length > 0) {
      const primaryProvider = taxRateProviderRegistry.getProvider(this.config.primaryProvider);
      
      if (primaryProvider) {
        try {
          const batchQueries = uncachedQueries.map(item => item.query);
          const batchResults = await primaryProvider.getBatchRates(batchQueries);
          
          // Insert results and cache them
          for (let i = 0; i < uncachedQueries.length; i++) {
            const { index } = uncachedQueries[i];
            const result = batchResults[i];
            
            results[index] = result;
            
            if (this.config.enableCaching) {
              await this.cache.set(uncachedQueries[i].query, result);
            }
          }
        } catch (error) {
          console.error('Batch request failed:', error);
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Clear cache for specific jurisdiction
   */
  async invalidateCache(jurisdiction?: string): Promise<number> {
    if (!this.config.enableCaching) {
      return 0;
    }

    if (jurisdiction) {
      return await this.cache.invalidateByJurisdiction(jurisdiction);
    } else {
      await this.cache.clear();
      return 0;
    }
  }

  /**
   * Get service metrics and performance stats
   */
  getMetrics(): ServiceMetrics {
    const cacheStats = this.cache.getStats();
    
    return {
      ...this.metrics,
      cacheHitRate: cacheStats.hitRate,
      uptime: Date.now() - this.startTime
    };
  }

  /**
   * Get provider health status
   */
  getProviderHealth(): ProviderHealth[] {
    return Array.from(this.providerHealth.values());
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<TaxRateServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart health checks if needed
    if (newConfig.primaryProvider || newConfig.fallbackProviders) {
      this.initializeHealthChecks();
    }
  }

  /**
   * Test all provider connections
   */
  async testConnections(): Promise<Record<string, { success: boolean; message: string; responseTime: number }>> {
    const results: Record<string, { success: boolean; message: string; responseTime: number }> = {};
    const providers = taxRateProviderRegistry.getAllProviders();
    
    for (const provider of providers) {
      try {
        results[provider.getName()] = await provider.testConnection();
      } catch (error) {
        results[provider.getName()] = {
          success: false,
          message: error instanceof Error ? error.message : 'Connection test failed',
          responseTime: 0
        };
      }
    }

    return results;
  }

  /**
   * Preload cache with common addresses
   */
  async preloadCache(commonAddresses: TaxRateQuery[]): Promise<void> {
    if (!this.config.enableCaching) {
      return;
    }

    const primaryProvider = taxRateProviderRegistry.getProvider(this.config.primaryProvider);
    if (primaryProvider) {
      await this.cache.preload(commonAddresses, async (query) => {
        return await primaryProvider.getRates(query);
      });
    }
  }

  private async makeRequestWithTimeout(provider: TaxRateProvider, query: TaxRateQuery): Promise<TaxRateResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);

      provider.getRates(query)
        .then(response => {
          clearTimeout(timeout);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private updateMetrics(startTime: number, provider: string, success: boolean): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const responseTime = Date.now() - startTime;

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
      this.metrics.errorsByProvider[provider] = (this.metrics.errorsByProvider[provider] || 0) + 1;
    }

    this.metrics.providerUsage[provider] = (this.metrics.providerUsage[provider] || 0) + 1;
    this.metrics.averageResponseTime = (this.metrics.averageResponseTime + responseTime) / 2;
  }

  private updateProviderHealth(providerName: string, success: boolean, responseTime?: number): void {
    let health = this.providerHealth.get(providerName);
    
    if (!health) {
      health = {
        name: providerName,
        isHealthy: true,
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 0,
        consecutiveFailures: 0
      };
    }

    health.lastCheck = new Date();
    
    if (success) {
      health.consecutiveFailures = 0;
      health.isHealthy = true;
      if (responseTime) {
        health.responseTime = responseTime;
      }
    } else {
      health.consecutiveFailures++;
      health.isHealthy = health.consecutiveFailures < 3; // Mark unhealthy after 3 consecutive failures
    }

    this.providerHealth.set(providerName, health);
  }

  private isProviderHealthy(providerName: string): boolean {
    const health = this.providerHealth.get(providerName);
    return health ? health.isHealthy : true; // Assume healthy if no health data
  }

  private initializeHealthChecks(): void {
    // Clear existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Start health checks every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 5 * 60 * 1000);

    // Perform initial health check
    this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    const providers = [
      this.config.primaryProvider,
      ...this.config.fallbackProviders
    ];

    for (const providerName of providers) {
      const provider = taxRateProviderRegistry.getProvider(providerName);
      
      if (provider) {
        try {
          const result = await provider.testConnection();
          this.updateProviderHealth(providerName, result.success, result.responseTime);
        } catch (error) {
          this.updateProviderHealth(providerName, false);
        }
      }
    }
  }

  /**
   * Perform basic client-side address validation as fallback
   */
  private performBasicAddressValidation(address: TaxRateQuery['address']): TaxRateValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    let confidence = 0.5; // Base confidence for basic validation
    
    // Check required fields
    if (!address.line1 || address.line1.trim().length === 0) {
      errors.push('Street address is required');
    } else {
      confidence += 0.1;
    }
    
    if (!address.city || address.city.trim().length === 0) {
      errors.push('City is required');
    } else {
      confidence += 0.1;
    }
    
    if (!address.state || address.state.trim().length === 0) {
      errors.push('State is required');
    } else {
      // Validate state format (2-letter code for US)
      if (address.country === 'US' && !/^[A-Z]{2}$/i.test(address.state)) {
        warnings.push('State should be a 2-letter code (e.g., CA, NY, TX)');
      } else {
        confidence += 0.1;
      }
    }
    
    if (!address.postalCode || address.postalCode.trim().length === 0) {
      errors.push('Postal code is required');
    } else {
      // Validate postal code format
      if (address.country === 'US') {
        if (!/^\d{5}(-\d{4})?$/.test(address.postalCode)) {
          warnings.push('US postal code should be in format 12345 or 12345-6789');
        } else {
          confidence += 0.1;
        }
      } else {
        confidence += 0.05; // Less confidence for non-US postal codes
      }
    }
    
    // Basic format validation
    if (address.line1 && address.line1.length > 100) {
      warnings.push('Street address is unusually long');
    }
    
    if (address.city && address.city.length > 50) {
      warnings.push('City name is unusually long');
    }
    
    // Check for obviously invalid patterns
    if (address.line1 && /^[0-9]+$/.test(address.line1)) {
      warnings.push('Street address appears to be only numbers');
    }
    
    if (address.city && /^[0-9]+$/.test(address.city)) {
      errors.push('City name cannot be only numbers');
    }
    
    const isValid = errors.length === 0;
    
    // Adjust confidence based on validation results
    if (!isValid) {
      confidence = Math.max(0, confidence - (errors.length * 0.2));
    }
    
    if (warnings.length > 0) {
      confidence = Math.max(0.1, confidence - (warnings.length * 0.1));
    }
    
    return {
      isValid,
      confidence: Math.min(0.7, confidence), // Cap at 0.7 for basic validation
      warnings: warnings.length > 0 ? warnings : ['Using basic address validation only'],
      errors,
      suggestedCorrections: this.generateBasicCorrections(address)
    };
  }
  
  /**
   * Generate basic address corrections
   */
  private generateBasicCorrections(address: TaxRateQuery['address']): Partial<TaxRateQuery> | undefined {
    const corrections: any = {};
    let hasCorrections = false;
    
    // Standardize state to uppercase
    if (address.state && address.state !== address.state.toUpperCase()) {
      corrections.state = address.state.toUpperCase();
      hasCorrections = true;
    }
    
    // Clean up postal code format
    if (address.postalCode && address.country === 'US') {
      const cleaned = address.postalCode.replace(/[^0-9-]/g, '');
      if (cleaned !== address.postalCode) {
        corrections.postalCode = cleaned;
        hasCorrections = true;
      }
    }
    
    // Title case city names
    if (address.city) {
      const titleCase = address.city
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      if (titleCase !== address.city) {
        corrections.city = titleCase;
        hasCorrections = true;
      }
    }
    
    return hasCorrections ? { address: { ...address, ...corrections } } : undefined;
  }
}

// Global service instance
export const taxRateService = new TaxRateService({
  primaryProvider: 'avalara',
  fallbackProviders: ['internal'],
  enableCaching: true,
  enableFallback: true,
  maxRetries: 3,
  timeoutMs: 10000,
  enableMetrics: true
});
