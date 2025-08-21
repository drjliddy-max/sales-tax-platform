"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxRateValidator = void 0;
const joi_1 = __importDefault(require("joi"));
const utils_1 = require("@/utils");
class TaxRateValidator {
    constructor() {
        this.validationRules = new Map();
        this.initializeValidationRules();
        this.initializeSchema();
    }
    initializeValidationRules() {
        this.validationRules = new Map([
            ['TX', {
                    state: 'TX',
                    minRate: 0,
                    maxRate: 8.25,
                    allowedJurisdictionTypes: ['state', 'city', 'county', 'special'],
                    requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
                }],
            ['CA', {
                    state: 'CA',
                    minRate: 7.25,
                    maxRate: 11.25,
                    allowedJurisdictionTypes: ['state', 'city', 'county', 'special'],
                    requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
                }],
            ['NY', {
                    state: 'NY',
                    minRate: 4.0,
                    maxRate: 8.875,
                    allowedJurisdictionTypes: ['state', 'city', 'county'],
                    requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
                }],
            ['FL', {
                    state: 'FL',
                    minRate: 6.0,
                    maxRate: 8.0,
                    allowedJurisdictionTypes: ['state', 'county'],
                    requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
                }],
            ['CO', {
                    state: 'CO',
                    minRate: 2.9,
                    maxRate: 11.2,
                    allowedJurisdictionTypes: ['state', 'city', 'county', 'special'],
                    requiredFields: ['jurisdiction', 'rate', 'effectiveDate']
                }]
        ]);
    }
    initializeSchema() {
        this.taxRateSchema = joi_1.default.object({
            state: joi_1.default.string().length(2).uppercase().required(),
            jurisdiction: joi_1.default.string().min(1).max(100).required(),
            jurisdictionType: joi_1.default.string().valid('state', 'county', 'city', 'special').required(),
            rate: joi_1.default.number().min(0).max(15).precision(4).required(),
            effectiveDate: joi_1.default.date().required(),
            source: joi_1.default.string().required(),
            sourceUrl: joi_1.default.string().uri().required(),
            productCategories: joi_1.default.array().items(joi_1.default.string()).optional()
        });
    }
    async validateTaxRateData(data) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
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
        const stateRules = this.validationRules.get(value.state);
        if (stateRules) {
            const stateValidation = this.validateAgainstStateRules(value, stateRules);
            result.errors.push(...stateValidation.errors);
            result.warnings.push(...stateValidation.warnings);
            if (stateValidation.errors.length > 0) {
                result.isValid = false;
            }
        }
        else {
            result.warnings.push(`No validation rules defined for state: ${value.state}`);
        }
        const businessValidation = this.validateBusinessLogic(value);
        result.errors.push(...businessValidation.errors);
        result.warnings.push(...businessValidation.warnings);
        if (businessValidation.errors.length > 0) {
            result.isValid = false;
        }
        return result;
    }
    validateAgainstStateRules(data, rules) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        if (data.rate < rules.minRate) {
            result.errors.push(`Rate ${data.rate}% is below minimum for ${rules.state} (${rules.minRate}%)`);
        }
        if (data.rate > rules.maxRate) {
            result.errors.push(`Rate ${data.rate}% exceeds maximum for ${rules.state} (${rules.maxRate}%)`);
        }
        if (!rules.allowedJurisdictionTypes.includes(data.jurisdictionType)) {
            result.errors.push(`Invalid jurisdiction type '${data.jurisdictionType}' for ${rules.state}`);
        }
        for (const field of rules.requiredFields) {
            if (!data[field]) {
                result.errors.push(`Required field '${field}' is missing`);
            }
        }
        return result;
    }
    validateBusinessLogic(data) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
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
        if (data.rate === 0 && data.jurisdictionType !== 'state') {
            result.warnings.push('Zero tax rate for non-state jurisdiction may be unusual');
        }
        if (data.rate > 12) {
            result.warnings.push(`Unusually high tax rate: ${data.rate}%`);
        }
        if (data.jurisdiction.length < 2) {
            result.errors.push('Jurisdiction name too short');
        }
        if (!/^[a-zA-Z\s\-\.\']+$/.test(data.jurisdiction)) {
            result.warnings.push('Jurisdiction name contains unusual characters');
        }
        if (!data.sourceUrl.includes('.gov') && !data.sourceUrl.includes('avalara.com')) {
            result.warnings.push('Source URL is not from a government or trusted domain');
        }
        return result;
    }
    async validateBatchData(dataArray) {
        const valid = [];
        const invalid = [];
        const warnings = [];
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
            }
            else {
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
    async crossValidateWithExistingRates(newData) {
        const matches = [];
        const conflicts = [];
        const newRates = [];
        for (const data of newData) {
            try {
                const existing = await this.findExistingRate(data);
                if (!existing) {
                    newRates.push(data);
                }
                else if (Math.abs(existing.rate - data.rate) < 0.0001) {
                    matches.push({ existing, new: data });
                }
                else {
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
            }
            catch (error) {
                utils_1.logger.error('Error during cross-validation:', error);
            }
        }
        return { matches, conflicts, newRates };
    }
    async findExistingRate(data) {
        const { TaxRate } = await Promise.resolve().then(() => __importStar(require('@/models')));
        return await TaxRate.findOne({
            state: data.state,
            jurisdiction: data.jurisdiction,
            jurisdictionType: data.jurisdictionType,
            isActive: true
        });
    }
    async validateComplianceUpdate(update) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        const schema = joi_1.default.object({
            title: joi_1.default.string().min(5).max(200).required(),
            description: joi_1.default.string().min(10).max(1000).required(),
            effectiveDate: joi_1.default.date().required(),
            impact: joi_1.default.string().valid('low', 'medium', 'high', 'critical').required(),
            category: joi_1.default.string().valid('rate_change', 'filing_requirement', 'exemption_change', 'compliance_rule').required(),
            affectedStates: joi_1.default.array().items(joi_1.default.string().length(2)).min(1).required(),
            sourceUrl: joi_1.default.string().uri().required()
        });
        const { error, value } = schema.validate(update, { abortEarly: false });
        if (error) {
            result.isValid = false;
            result.errors.push(...error.details.map(detail => detail.message));
        }
        else {
            result.normalizedData = value;
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
exports.TaxRateValidator = TaxRateValidator;
//# sourceMappingURL=TaxRateValidator.js.map