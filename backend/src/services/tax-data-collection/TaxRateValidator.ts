import Joi from 'joi';
import { logger } from '@/utils';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  normalizedData?: any;
}

interface TaxRateValidationRules {
  state: string;
  minRate: number;
  maxRate: number;
  allowedJurisdictionTypes: string[];
  requiredFields: string[];
}

export class TaxRateValidator {
  private validationRules: Map<string, TaxRateValidationRules> = new Map();
  private taxRateSchema!: Joi.ObjectSchema;

  constructor() {
    this.initializeValidationRules();
    this.initializeSchema();
  }

  private initializeValidationRules(): void {
    this.validationRules = new Map([
      ['TX', {
        state: 'TX',
        minRate: 0,
        maxRate: 8.25, // 6.25% state + 2% max local
        allowedJurisdictionTypes: ['state', 'city', 'county', 'special'],
        requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
      }],
      ['CA', {
        state: 'CA',
        minRate: 7.25, // Minimum statewide rate
        maxRate: 11.25, // Realistic maximum with districts
        allowedJurisdictionTypes: ['state', 'city', 'county', 'special'],
        requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
      }],
      ['NY', {
        state: 'NY',
        minRate: 4.0, // State rate
        maxRate: 8.875, // NYC maximum
        allowedJurisdictionTypes: ['state', 'city', 'county'],
        requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
      }],
      ['FL', {
        state: 'FL',
        minRate: 6.0, // State rate
        maxRate: 8.0, // 6% + 2% discretionary surtax
        allowedJurisdictionTypes: ['state', 'county'],
        requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
      }],
      ['CO', {
        state: 'CO',
        minRate: 2.9, // State rate
        maxRate: 11.2, // With local jurisdictions
        allowedJurisdictionTypes: ['state', 'city', 'county', 'special'],
        requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
      }]
    ]);
  }

  private initializeSchema(): void {
    this.taxRateSchema = Joi.object({
      state: Joi.string().length(2).uppercase().required(),
      jurisdiction: Joi.string().min(1).max(100).required(),
      jurisdictionType: Joi.string().valid('state', 'county', 'city', 'special').required(),
      rate: Joi.number().min(0).max(15).precision(4).required(),
      effectiveDate: Joi.date().required(),
      source: Joi.string().required(),
      sourceUrl: Joi.string().uri().required(),
      productCategories: Joi.array().items(Joi.string()).optional()
    });
  }

  async validateTaxRateData(data: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Schema validation
    const { error, value } = this.taxRateSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      result.isValid = false;
      result.errors.push(...error.details.map(detail => detail.message));
      return result;
    }

    result.normalizedData = value;

    // State-specific validation
    const stateRules = this.validationRules.get(value.state);
    if (stateRules) {
      const stateValidation = this.validateAgainstStateRules(value, stateRules);
      result.errors.push(...stateValidation.errors);
      result.warnings.push(...stateValidation.warnings);
      
      if (stateValidation.errors.length > 0) {
        result.isValid = false;
      }
    } else {
      result.warnings.push(`No validation rules defined for state: ${value.state}`);
    }

    // Business logic validation
    const businessValidation = this.validateBusinessLogic(value);
    result.errors.push(...businessValidation.errors);
    result.warnings.push(...businessValidation.warnings);
    
    if (businessValidation.errors.length > 0) {
      result.isValid = false;
    }

    return result;
  }

  private validateAgainstStateRules(data: any, rules: TaxRateValidationRules): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Rate range validation
    if (data.rate < rules.minRate) {
      result.errors.push(`Rate ${data.rate}% is below minimum for ${rules.state} (${rules.minRate}%)`);
    }
    
    if (data.rate > rules.maxRate) {
      result.errors.push(`Rate ${data.rate}% exceeds maximum for ${rules.state} (${rules.maxRate}%)`);
    }

    // Jurisdiction type validation
    if (!rules.allowedJurisdictionTypes.includes(data.jurisdictionType)) {
      result.errors.push(`Invalid jurisdiction type '${data.jurisdictionType}' for ${rules.state}`);
    }

    // Required fields validation
    for (const field of rules.requiredFields) {
      if (!data[field]) {
        result.errors.push(`Required field '${field}' is missing`);
      }
    }

    return result;
  }

  private validateBusinessLogic(data: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Effective date validation
    const now = new Date();
    const effectiveDate = new Date(data.effectiveDate);
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    if (effectiveDate > oneYearFromNow) {
      result.warnings.push(`Effective date is more than one year in the future: ${effectiveDate.toISOString()}`);
    }
    
    if (effectiveDate < oneYearAgo) {
      result.warnings.push(`Effective date is more than one year old: ${effectiveDate.toISOString()}`);
    }

    // Rate reasonableness check
    if (data.rate === 0 && data.jurisdictionType !== 'state') {
      result.warnings.push('Zero tax rate for non-state jurisdiction may be unusual');
    }
    
    if (data.rate > 12) {
      result.warnings.push(`Unusually high tax rate: ${data.rate}%`);
    }

    // Jurisdiction name validation
    if (data.jurisdiction.length < 2) {
      result.errors.push('Jurisdiction name too short');
    }
    
    if (!/^[a-zA-Z\s\-\.\']+$/.test(data.jurisdiction)) {
      result.warnings.push('Jurisdiction name contains unusual characters');
    }

    // Source URL validation
    if (!data.sourceUrl.includes('.gov') && !data.sourceUrl.includes('avalara.com')) {
      result.warnings.push('Source URL is not from a government or trusted domain');
    }

    return result;
  }

  async validateBatchData(dataArray: any[]): Promise<{
    valid: any[];
    invalid: any[];
    warnings: any[];
    summary: {
      total: number;
      valid: number;
      invalid: number;
      warningsCount: number;
    };
  }> {
    const valid: any[] = [];
    const invalid: any[] = [];
    const warnings: any[] = [];

    for (const data of dataArray) {
      const validation = await this.validateTaxRateData(data);
      
      if (validation.isValid) {
        valid.push(validation.normalizedData);
        
        if (validation.warnings.length > 0) {
          warnings.push({
            data: validation.normalizedData,
            warnings: validation.warnings
          });
        }
      } else {
        invalid.push({
          data,
          errors: validation.errors,
          warnings: validation.warnings
        });
      }
    }

    return {
      valid,
      invalid,
      warnings,
      summary: {
        total: dataArray.length,
        valid: valid.length,
        invalid: invalid.length,
        warningsCount: warnings.length
      }
    };
  }

  async crossValidateWithExistingRates(newData: any[]): Promise<{
    matches: any[];
    conflicts: any[];
    newRates: any[];
  }> {
    const matches: any[] = [];
    const conflicts: any[] = [];
    const newRates: any[] = [];

    for (const data of newData) {
      try {
        const existing = await this.findExistingRate(data);
        
        if (!existing) {
          newRates.push(data);
        } else if (Math.abs(existing.rate - data.rate) < 0.0001) {
          matches.push({ existing, new: data });
        } else {
          conflicts.push({
            existing: {
              rate: existing.rate,
              effectiveDate: existing.effectiveDate,
              lastUpdated: existing.lastUpdated
            },
            new: data,
            rateDifference: data.rate - existing.rate
          });
        }
      } catch (error) {
        logger.error('Error during cross-validation:', error);
      }
    }

    return { matches, conflicts, newRates };
  }

  private async findExistingRate(data: any): Promise<any> {
    const { TaxRate } = await import('@/models');
    
    return await TaxRate.findOne({
      state: data.state,
      jurisdiction: data.jurisdiction,
      jurisdictionType: data.jurisdictionType,
      isActive: true
    });
  }

  async validateComplianceUpdate(update: any): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const schema = Joi.object({
      title: Joi.string().min(5).max(200).required(),
      description: Joi.string().min(10).max(1000).required(),
      effectiveDate: Joi.date().required(),
      impact: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
      category: Joi.string().valid('rate_change', 'filing_requirement', 'exemption_change', 'compliance_rule').required(),
      affectedStates: Joi.array().items(Joi.string().length(2)).min(1).required(),
      sourceUrl: Joi.string().uri().required()
    });

    const { error, value } = schema.validate(update, { abortEarly: false });
    
    if (error) {
      result.isValid = false;
      result.errors.push(...error.details.map(detail => detail.message));
    } else {
      result.normalizedData = value;
      
      // Additional business logic validation
      const effectiveDate = new Date(value.effectiveDate);
      const now = new Date();
      
      if (effectiveDate < now && Math.abs(effectiveDate.getTime() - now.getTime()) > 86400000) {
        result.warnings.push('Effective date is in the past');
      }
      
      if (value.impact === 'critical' && !value.description.toLowerCase().includes('immediate')) {
        result.warnings.push('Critical updates should mention immediate action required');
      }
    }

    return result;
  }
}