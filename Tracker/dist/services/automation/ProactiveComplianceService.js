"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProactiveComplianceService = exports.ComplianceAI = void 0;
const Business_1 = __importDefault(require("../../models/Business"));
const Transaction_1 = __importDefault(require("../../models/Transaction"));
const PassiveSetupService_1 = require("./PassiveSetupService");
class ComplianceAI {
    async analyzeCompliancePatterns(businessId) {
        const transactions = await Transaction_1.default.find({ businessId }).limit(1000);
        const patterns = [];
        let riskScore = 0;
        if (transactions.length > 0) {
            const avgAmount = transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length;
            const highVariance = this.calculateVariance(transactions.map((t) => t.amount)) > avgAmount;
            if (highVariance) {
                patterns.push('High transaction amount variance detected');
                riskScore += 0.2;
            }
        }
        const filingPattern = await this.analyzeFilingPatterns(businessId);
        if (filingPattern.irregularity_score > 0.3) {
            patterns.push('Irregular filing patterns detected');
            riskScore += 0.3;
        }
        return {
            risk_score: Math.min(riskScore, 1.0),
            patterns,
            recommendations: this.generateRecommendations(patterns, riskScore)
        };
    }
    calculateVariance(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return variance;
    }
    async analyzeFilingPatterns(businessId) {
        return { irregularity_score: 0.1 };
    }
    generateRecommendations(patterns, riskScore) {
        const recommendations = [];
        if (riskScore > 0.5) {
            recommendations.push('Consider implementing automated compliance monitoring');
            recommendations.push('Review and standardize transaction recording processes');
        }
        if (patterns.some(p => p.includes('filing'))) {
            recommendations.push('Establish consistent filing schedules and reminders');
        }
        return recommendations;
    }
}
exports.ComplianceAI = ComplianceAI;
class ProactiveComplianceService {
    constructor(filingService, alertService) {
        this.filingService = filingService;
        this.alertService = alertService;
        this.complianceAI = new ComplianceAI();
        this.automationLogger = new PassiveSetupService_1.AutomationLogger();
    }
    async runProactiveCompliance() {
        const businesses = await this.getActiveBusinesses();
        for (const business of businesses) {
            try {
                await this.runBusinessComplianceCheck(business);
            }
            catch (error) {
                console.error(`Compliance check failed for business ${business.id}:`, error);
                await this.automationLogger.log({
                    type: 'compliance_check_failed',
                    business_id: business.id,
                    input_data: { business_name: business.name },
                    automation_level: 'full',
                    timestamp: new Date(),
                    success: false,
                    error_message: error.message
                });
            }
        }
    }
    async runBusinessComplianceCheck(business) {
        const predictions = await this.predictComplianceNeeds(business);
        for (const prediction of predictions) {
            switch (prediction.type) {
                case 'filing_due_soon':
                    await this.autoPrepareFilingIfPossible(business, prediction);
                    break;
                case 'rate_change_coming':
                    await this.preloadNewRates(business, prediction);
                    break;
                case 'audit_risk_increasing':
                    await this.strengthenAuditDefenses(business, prediction);
                    break;
                case 'nexus_threshold_approaching':
                    await this.prepareNexusRegistration(business, prediction);
                    break;
            }
        }
        await this.automationLogger.log({
            type: 'business_compliance_check',
            business_id: business.id,
            input_data: { predictions_count: predictions.length },
            output_data: { predictions },
            automation_level: 'full',
            timestamp: new Date(),
            success: true
        });
    }
    async predictComplianceNeeds(business) {
        const predictions = [];
        const upcomingFilings = await this.getUpcomingFilings(business.id);
        for (const filing of upcomingFilings) {
            const daysUntilDue = Math.ceil((new Date(filing.next_due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            predictions.push({
                type: 'filing_due_soon',
                jurisdiction: filing.jurisdiction,
                days_until_due: daysUntilDue,
                confidence: 1.0,
                auto_preparable: await this.canAutoPrepareFilin(business.id, filing),
                priority: daysUntilDue <= 7 ? 'high' : 'medium'
            });
        }
        const nexusPrediction = await this.predictNexusThresholds(business);
        if (nexusPrediction.risk_level > 0.7) {
            predictions.push({
                type: 'nexus_threshold_approaching',
                jurisdictions: nexusPrediction.at_risk_jurisdictions.map(j => j.jurisdiction),
                estimated_threshold_date: nexusPrediction.estimated_date || undefined,
                confidence: nexusPrediction.risk_level,
                auto_preparable: true,
                priority: 'high',
                at_risk_jurisdictions: nexusPrediction.at_risk_jurisdictions
            });
        }
        const auditRisk = await this.calculateAuditRisk(business);
        if (auditRisk.score > 0.6) {
            predictions.push({
                type: 'audit_risk_increasing',
                risk_factors: auditRisk.factors.map(f => f.factor),
                risk_score: auditRisk.score,
                confidence: 0.8,
                auto_preparable: true,
                priority: 'medium'
            });
        }
        return predictions;
    }
    async autoPrepareFilingIfPossible(business, prediction) {
        try {
            const dataCheck = await this.validateFilingData(business.id, prediction.jurisdiction);
            if (dataCheck.complete && dataCheck.validated) {
                const filing = await this.filingService.generateFiling({
                    business_id: business.id,
                    jurisdiction: prediction.jurisdiction,
                    period: this.getCurrentFilingPeriod(prediction),
                    auto_generated: true
                });
                await this.markFilingReadyForReview(filing.id);
                await this.alertService.sendGentleAlert(business.id, {
                    type: 'filing_ready',
                    title: 'Your tax filing is ready for review',
                    message: `We've prepared your ${prediction.jurisdiction} filing. Just review and submit when convenient.`,
                    action_url: `/filings/${filing.id}/review`,
                    urgency: 'low',
                    auto_generated: true
                });
                return { status: 'auto_prepared', filing_id: filing.id };
            }
            else {
                await this.autoResolveFilingDataGaps(business.id, dataCheck.missing_items);
                return { status: 'data_collection_initiated', missing_data_count: dataCheck.missing_items.length };
            }
        }
        catch (error) {
            await this.alertService.sendFilingReminder(business.id, prediction);
            return { status: 'reminder_sent', error: error.message };
        }
    }
    async autoResolveFilingDataGaps(businessId, missingItems) {
        for (const item of missingItems) {
            try {
                switch (item.type) {
                    case 'missing_transactions':
                        await this.attemptTransactionRecovery(businessId, item);
                        break;
                    case 'missing_exemption_certificates':
                        await this.requestExemptionCertificates(businessId, item);
                        break;
                    case 'unreconciled_payments':
                        await this.autoReconcilePayments(businessId, item);
                        break;
                    case 'missing_location_data':
                        await this.enrichLocationData(businessId, item);
                        break;
                }
            }
            catch (error) {
                console.error(`Failed to resolve data gap ${item.type}:`, error);
            }
        }
    }
    async predictNexusThresholds(business) {
        const nexusThresholds = await this.getNexusMonitoringData(business.id);
        const atRiskJurisdictions = [];
        for (const jurisdiction of nexusThresholds) {
            const salesTrajectory = await this.calculateSalesTrajectory(business.id, jurisdiction.state);
            const transactionTrajectory = await this.calculateTransactionTrajectory(business.id, jurisdiction.state);
            const economicRisk = this.calculateThresholdRisk(jurisdiction.current_sales, jurisdiction.economic_threshold, salesTrajectory);
            const transactionRisk = this.calculateThresholdRisk(jurisdiction.current_transactions, jurisdiction.transaction_threshold, transactionTrajectory);
            const overallRisk = Math.max(economicRisk.risk_level, transactionRisk.risk_level);
            if (overallRisk > 0.7) {
                atRiskJurisdictions.push({
                    jurisdiction: jurisdiction.state,
                    risk_level: overallRisk,
                    estimated_threshold_date: new Date(Math.min(economicRisk.estimated_date.getTime(), transactionRisk.estimated_date.getTime())),
                    threshold_type: economicRisk.risk_level > transactionRisk.risk_level ? 'economic' : 'transaction'
                });
            }
        }
        return {
            risk_level: atRiskJurisdictions.length > 0 ? Math.max(...atRiskJurisdictions.map(j => j.risk_level)) : 0,
            at_risk_jurisdictions: atRiskJurisdictions,
            estimated_date: atRiskJurisdictions.length > 0 ?
                new Date(Math.min(...atRiskJurisdictions.map(j => j.estimated_threshold_date.getTime()))) : null
        };
    }
    async calculateAuditRisk(business) {
        const riskFactors = [];
        let overallScore = 0;
        const filingConsistency = await this.assessFilingConsistency(business.id);
        if (filingConsistency.score < 0.8) {
            riskFactors.push({
                factor: 'inconsistent_filings',
                impact: 0.3,
                description: 'Filing patterns show inconsistencies',
                severity: 'medium'
            });
            overallScore += 0.3;
        }
        const calculationAccuracy = await this.assessCalculationAccuracy(business.id);
        if (calculationAccuracy.score < 0.95) {
            riskFactors.push({
                factor: 'calculation_discrepancies',
                impact: 0.4,
                description: 'Tax calculations show potential discrepancies',
                severity: 'high'
            });
            overallScore += 0.4;
        }
        const exemptionCompliance = await this.assessExemptionCompliance(business.id);
        if (exemptionCompliance.score < 0.9) {
            riskFactors.push({
                factor: 'exemption_management',
                impact: 0.2,
                description: 'Exemption certificate management needs improvement',
                severity: 'low'
            });
            overallScore += 0.2;
        }
        const industryRisk = await this.getIndustryAuditRisk(business.industry);
        overallScore += industryRisk * 0.1;
        return {
            score: Math.min(overallScore, 1.0),
            factors: riskFactors,
            industry_baseline: industryRisk,
            recommendation: overallScore > 0.6 ? 'strengthen_defenses' : 'maintain_current_practices'
        };
    }
    async strengthenAuditDefenses(business, prediction) {
        const improvements = [];
        if (prediction.risk_factors?.includes('inconsistent_filings')) {
            await this.enableEnhancedDocumentation(business.id);
            improvements.push('enhanced_documentation');
        }
        if (prediction.risk_factors?.includes('calculation_discrepancies')) {
            await this.enableAdvancedCalculationValidation(business.id);
            improvements.push('calculation_validation');
        }
        if (prediction.risk_factors?.includes('exemption_management')) {
            await this.enableAutomatedExemptionTracking(business.id);
            improvements.push('exemption_tracking');
        }
        await this.createAuditTrailBackup(business.id);
        improvements.push('audit_trail_backup');
        await this.alertService.sendGentleAlert(business.id, {
            type: 'audit_protection_enhanced',
            title: 'Audit protection automatically enhanced',
            message: 'We\'ve strengthened your audit defenses behind the scenes. You\'re well-protected.',
            improvements: improvements,
            urgency: 'low',
            business_id: business.id,
            auto_generated: true
        });
        return { improvements_applied: improvements };
    }
    async getActiveBusinesses() {
        return Business_1.default.find({ status: 'active' }).limit(100);
    }
    async getUpcomingFilings(businessId) {
        return [
            {
                jurisdiction: 'Texas State',
                filing_frequency: 'monthly',
                last_filed: new Date('2024-01-20'),
                next_due_date: new Date('2024-02-20')
            }
        ];
    }
    async canAutoPrepareFilin(businessId, filing) {
        const dataCheck = await this.validateFilingData(businessId, filing.jurisdiction);
        return dataCheck.complete && dataCheck.validated;
    }
    async validateFilingData(businessId, jurisdiction) {
        return {
            complete: true,
            validated: true,
            missing_items: [],
            confidence_score: 0.95
        };
    }
    getCurrentFilingPeriod(prediction) {
        const now = new Date();
        return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    }
    async markFilingReadyForReview(filingId) {
        console.log(`Marking filing ${filingId} as ready for review`);
    }
    async attemptTransactionRecovery(businessId, item) {
        console.log(`Attempting transaction recovery for ${businessId}`);
    }
    async requestExemptionCertificates(businessId, item) {
        console.log(`Requesting exemption certificates for ${businessId}`);
    }
    async autoReconcilePayments(businessId, item) {
        console.log(`Auto-reconciling payments for ${businessId}`);
    }
    async enrichLocationData(businessId, item) {
        console.log(`Enriching location data for ${businessId}`);
    }
    async getNexusMonitoringData(businessId) {
        return [
            {
                state: 'Texas',
                economic_threshold: 500000,
                transaction_threshold: 200,
                current_sales: 450000,
                current_transactions: 180
            }
        ];
    }
    async calculateSalesTrajectory(businessId, state) {
        return {
            current_sales: 450000,
            monthly_growth_rate: 0.05,
            projected_annual_sales: 540000,
            confidence: 0.8
        };
    }
    async calculateTransactionTrajectory(businessId, state) {
        return {
            current_transactions: 180,
            monthly_growth_rate: 0.03,
            projected_annual_transactions: 216,
            confidence: 0.85
        };
    }
    calculateThresholdRisk(current, threshold, trajectory) {
        const monthsToThreshold = (threshold - current) / (current * trajectory.monthly_growth_rate);
        const riskLevel = Math.max(0, 1 - (monthsToThreshold / 12));
        const estimatedDate = new Date();
        estimatedDate.setMonth(estimatedDate.getMonth() + Math.max(0, monthsToThreshold));
        return {
            risk_level: Math.min(riskLevel, 1.0),
            estimated_date: estimatedDate,
            months_until_threshold: Math.max(0, monthsToThreshold)
        };
    }
    async assessFilingConsistency(businessId) {
        return {
            score: 0.85,
            inconsistencies: [],
            pattern_analysis: {
                filing_frequency_variations: 0.1,
                amount_variations: 0.15,
                timing_variations: 0.05
            }
        };
    }
    async assessCalculationAccuracy(businessId) {
        return {
            score: 0.98,
            discrepancies: [],
            accuracy_by_jurisdiction: {
                'Texas State': 0.99,
                'Harris County': 0.97
            }
        };
    }
    async assessExemptionCompliance(businessId) {
        return {
            score: 0.92,
            certificate_coverage: 0.95,
            missing_certificates: 2,
            expired_certificates: 1,
            compliance_by_customer: {}
        };
    }
    async getIndustryAuditRisk(industry) {
        const industryRisks = {
            'restaurant': 0.15,
            'retail': 0.12,
            'service': 0.08,
            'manufacturing': 0.20
        };
        return industryRisks[industry] || 0.10;
    }
    async preloadNewRates(business, prediction) {
        console.log(`Preloading new tax rates for ${business.id}`);
    }
    async prepareNexusRegistration(business, prediction) {
        console.log(`Preparing nexus registration for ${business.id}`);
    }
    async enableEnhancedDocumentation(businessId) {
        console.log(`Enabling enhanced documentation for ${businessId}`);
    }
    async enableAdvancedCalculationValidation(businessId) {
        console.log(`Enabling advanced calculation validation for ${businessId}`);
    }
    async enableAutomatedExemptionTracking(businessId) {
        console.log(`Enabling automated exemption tracking for ${businessId}`);
    }
    async createAuditTrailBackup(businessId) {
        console.log(`Creating audit trail backup for ${businessId}`);
    }
}
exports.ProactiveComplianceService = ProactiveComplianceService;
//# sourceMappingURL=ProactiveComplianceService.js.map