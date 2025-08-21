/**
 * Data Integrity Service
 * 
 * Enforces application-wide policy that all data must be real, valid, and truthful.
 * No fabricated, mock, or artificially generated data is permitted.
 */

export interface DataSource {
  id: string;
  name: string;
  type: 'government' | 'financial' | 'business' | 'user' | 'third-party';
  url?: string;
  isVerified: boolean;
  lastValidated: Date;
  trustLevel: 'high' | 'medium' | 'low';
  description: string;
}

export interface DataValidationResult {
  isValid: boolean;
  source: DataSource | null;
  timestamp: Date;
  errors: string[];
  warnings: string[];
}

class DataIntegrityService {
  private verifiedSources: Map<string, DataSource> = new Map();
  private validationCache: Map<string, DataValidationResult> = new Map();

  constructor() {
    this.initializeVerifiedSources();
  }

  private initializeVerifiedSources() {
    // Government Sources
    this.registerSource({
      id: 'irs-gov',
      name: 'Internal Revenue Service',
      type: 'government',
      url: 'https://www.irs.gov',
      isVerified: true,
      lastValidated: new Date(),
      trustLevel: 'high',
      description: 'Official federal tax information and forms'
    });

    this.registerSource({
      id: 'state-tax-departments',
      name: 'State Revenue Departments',
      type: 'government',
      isVerified: true,
      lastValidated: new Date(),
      trustLevel: 'high',
      description: 'Official state tax rates and regulations'
    });

    // Financial Institution APIs
    this.registerSource({
      id: 'square-api',
      name: 'Square API',
      type: 'financial',
      url: 'https://developer.squareup.com',
      isVerified: true,
      lastValidated: new Date(),
      trustLevel: 'high',
      description: 'Live Square POS transaction data'
    });

    this.registerSource({
      id: 'stripe-api',
      name: 'Stripe API',
      type: 'financial',
      url: 'https://stripe.com/docs/api',
      isVerified: true,
      lastValidated: new Date(),
      trustLevel: 'high',
      description: 'Live Stripe payment processing data'
    });

    // Business Data Sources
    this.registerSource({
      id: 'user-business-data',
      name: 'User Business Information',
      type: 'business',
      isVerified: true,
      lastValidated: new Date(),
      trustLevel: 'medium',
      description: 'Verified user-provided business registration and setup data'
    });

    // Third-party Verified Sources
    this.registerSource({
      id: 'avalara-api',
      name: 'Avalara Tax API',
      type: 'third-party',
      url: 'https://developer.avalara.com',
      isVerified: true,
      lastValidated: new Date(),
      trustLevel: 'high',
      description: 'Professional tax calculation service with government-verified rates'
    });
  }

  /**
   * Register a verified data source
   */
  registerSource(source: DataSource): void {
    if (!this.validateSource(source)) {
      throw new Error(`Invalid data source: ${source.name}`);
    }
    this.verifiedSources.set(source.id, source);
  }

  /**
   * Validate that a data source meets real data requirements
   */
  private validateSource(source: DataSource): boolean {
    // Must have real, identifiable source
    if (!source.name || !source.type) return false;
    
    // Must be verified through official channels
    if (!source.isVerified) return false;
    
    // Must have been validated recently (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (source.lastValidated < thirtyDaysAgo) return false;

    return true;
  }

  /**
   * Validate data against approved sources
   */
  async validateData(data: any, sourceId: string): Promise<DataValidationResult> {
    const result: DataValidationResult = {
      isValid: false,
      source: null,
      timestamp: new Date(),
      errors: [],
      warnings: []
    };

    // Check if source is registered and verified
    const source = this.verifiedSources.get(sourceId);
    if (!source) {
      result.errors.push(`Unregistered data source: ${sourceId}`);
      return result;
    }

    if (!source.isVerified) {
      result.errors.push(`Unverified data source: ${source.name}`);
      return result;
    }

    // Check for prohibited mock/fake data patterns
    const dataString = JSON.stringify(data).toLowerCase();
    const prohibitedPatterns = [
      'mock', 'fake', 'dummy', 'lorem', 'ipsum', 'placeholder',
      'test_', 'sample_', 'demo_', 'example_', 'temp_'
    ];

    for (const pattern of prohibitedPatterns) {
      if (dataString.includes(pattern)) {
        result.errors.push(`Prohibited mock/fake data pattern detected: ${pattern}`);
      }
    }

    // Check data freshness
    if (data.timestamp) {
      const dataAge = Date.now() - new Date(data.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (dataAge > maxAge) {
        result.warnings.push('Data is older than 24 hours');
      }
    }

    result.isValid = result.errors.length === 0;
    result.source = source;

    // Cache validation result
    this.validationCache.set(`${sourceId}_${Date.now()}`, result);

    return result;
  }

  /**
   * Check if data source is approved for use
   */
  isSourceApproved(sourceId: string): boolean {
    const source = this.verifiedSources.get(sourceId);
    return source ? source.isVerified : false;
  }

  /**
   * Get all approved data sources
   */
  getApprovedSources(): DataSource[] {
    return Array.from(this.verifiedSources.values())
      .filter(source => source.isVerified);
  }

  /**
   * Report data integrity violation
   */
  reportViolation(sourceId: string, violation: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const report = {
      sourceId,
      violation,
      timestamp,
      data: data ? JSON.stringify(data, null, 2) : 'N/A'
    };

    console.error('DATA INTEGRITY VIOLATION:', report);
    
    // In production, this would send to monitoring/alerting system
    if (process.env.NODE_ENV === 'production') {
      // Send to monitoring service
      this.sendViolationAlert(report);
    }
  }

  private async sendViolationAlert(report: any): Promise<void> {
    try {
      await fetch('/api/data-integrity/violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
    } catch (error) {
      console.error('Failed to send violation alert:', error);
    }
  }

  /**
   * Enforce real data policy in API calls
   */
  async validateApiResponse(response: any, endpoint: string): Promise<DataValidationResult> {
    // Determine source based on endpoint
    let sourceId = 'unknown';
    
    if (endpoint.includes('/api/square')) sourceId = 'square-api';
    else if (endpoint.includes('/api/stripe')) sourceId = 'stripe-api';
    else if (endpoint.includes('/api/avalara')) sourceId = 'avalara-api';
    else if (endpoint.includes('/api/insights')) sourceId = 'user-business-data';
    
    const validation = await this.validateData(response, sourceId);
    
    if (!validation.isValid) {
      this.reportViolation(sourceId, `Invalid API response from ${endpoint}`, response);
    }

    return validation;
  }

  /**
   * Generate data source attribution
   */
  generateAttribution(sourceId: string): string {
    const source = this.verifiedSources.get(sourceId);
    if (!source) return 'Source unknown';

    const lastUpdated = source.lastValidated.toLocaleDateString();
    return `Data provided by ${source.name} (verified ${lastUpdated})`;
  }

  /**
   * Check if component should display data
   */
  shouldDisplayData(data: any, sourceId: string): boolean {
    if (!data) return false;
    if (!this.isSourceApproved(sourceId)) return false;
    
    // Never display data that looks fabricated
    const dataString = JSON.stringify(data).toLowerCase();
    const suspiciousPatterns = [
      'lorem ipsum', 'john doe', 'jane doe', 'test company',
      'sample corp', 'demo business', 'example inc'
    ];

    return !suspiciousPatterns.some(pattern => dataString.includes(pattern));
  }
}

// Global instance
export const dataIntegrityService = new DataIntegrityService();

// React hook for data validation
export function useDataIntegrity() {
  return {
    validateData: dataIntegrityService.validateData.bind(dataIntegrityService),
    isSourceApproved: dataIntegrityService.isSourceApproved.bind(dataIntegrityService),
    shouldDisplayData: dataIntegrityService.shouldDisplayData.bind(dataIntegrityService),
    generateAttribution: dataIntegrityService.generateAttribution.bind(dataIntegrityService),
    reportViolation: dataIntegrityService.reportViolation.bind(dataIntegrityService)
  };
}