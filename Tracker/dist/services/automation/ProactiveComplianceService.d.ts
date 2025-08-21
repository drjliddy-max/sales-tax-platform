export interface CompliancePrediction {
    type: 'filing_due_soon' | 'rate_change_coming' | 'audit_risk_increasing' | 'nexus_threshold_approaching';
    jurisdiction?: string;
    jurisdictions?: string[];
    days_until_due?: number;
    risk_level?: number;
    risk_score?: number;
    confidence: number;
    auto_preparable: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimated_threshold_date?: Date;
    estimated_date?: Date;
    risk_factors?: string[];
    at_risk_jurisdictions?: NexusJurisdictionRisk[];
}
export interface NexusJurisdictionRisk {
    jurisdiction: string;
    risk_level: number;
    estimated_threshold_date: Date;
    threshold_type: 'economic' | 'transaction';
}
export interface FilingDataValidation {
    complete: boolean;
    validated: boolean;
    missing_items: FilingDataGap[];
    confidence_score: number;
}
export interface FilingDataGap {
    type: 'missing_transactions' | 'missing_exemption_certificates' | 'unreconciled_payments' | 'missing_location_data';
    jurisdiction: string;
    period: string;
    severity: 'low' | 'medium' | 'high';
    auto_resolvable: boolean;
    description: string;
}
export interface FilingResult {
    status: 'auto_prepared' | 'data_collection_initiated' | 'reminder_sent';
    filing_id?: string;
    error?: string;
    missing_data_count?: number;
}
export interface NexusPrediction {
    risk_level: number;
    at_risk_jurisdictions: NexusJurisdictionRisk[];
    estimated_date: Date | null;
}
export interface SalesTrajectory {
    current_sales: number;
    monthly_growth_rate: number;
    projected_annual_sales: number;
    confidence: number;
}
export interface TransactionTrajectory {
    current_transactions: number;
    monthly_growth_rate: number;
    projected_annual_transactions: number;
    confidence: number;
}
export interface ThresholdRisk {
    risk_level: number;
    estimated_date: Date;
    months_until_threshold: number;
}
export interface AuditRisk {
    score: number;
    factors: AuditRiskFactor[];
    industry_baseline: number;
    recommendation: 'strengthen_defenses' | 'maintain_current_practices' | 'monitor_closely';
}
export interface AuditRiskFactor {
    factor: string;
    impact: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
}
export interface FilingConsistencyAssessment {
    score: number;
    inconsistencies: string[];
    pattern_analysis: {
        filing_frequency_variations: number;
        amount_variations: number;
        timing_variations: number;
    };
}
export interface CalculationAccuracyAssessment {
    score: number;
    discrepancies: CalculationDiscrepancy[];
    accuracy_by_jurisdiction: Record<string, number>;
}
export interface CalculationDiscrepancy {
    jurisdiction: string;
    expected_amount: number;
    actual_amount: number;
    variance_percentage: number;
    period: string;
}
export interface ExemptionComplianceAssessment {
    score: number;
    certificate_coverage: number;
    missing_certificates: number;
    expired_certificates: number;
    compliance_by_customer: Record<string, number>;
}
export interface ComplianceAlert {
    type: string;
    title: string;
    message: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    auto_generated: boolean;
    action_url?: string;
    improvements?: string[];
    business_id: string;
}
export declare class ComplianceAI {
    analyzeCompliancePatterns(businessId: string): Promise<{
        risk_score: number;
        patterns: string[];
        recommendations: string[];
    }>;
    private calculateVariance;
    private analyzeFilingPatterns;
    private generateRecommendations;
}
export declare class ProactiveComplianceService {
    private filingService;
    private alertService;
    private complianceAI;
    private automationLogger;
    constructor(filingService: any, alertService: any);
    runProactiveCompliance(): Promise<void>;
    runBusinessComplianceCheck(business: any): Promise<void>;
    predictComplianceNeeds(business: any): Promise<CompliancePrediction[]>;
    autoPrepareFilingIfPossible(business: any, prediction: CompliancePrediction): Promise<FilingResult>;
    autoResolveFilingDataGaps(businessId: string, missingItems: FilingDataGap[]): Promise<void>;
    predictNexusThresholds(business: any): Promise<NexusPrediction>;
    calculateAuditRisk(business: any): Promise<AuditRisk>;
    strengthenAuditDefenses(business: any, prediction: CompliancePrediction): Promise<{
        improvements_applied: string[];
    }>;
    private getActiveBusinesses;
    private getUpcomingFilings;
    private canAutoPrepareFilin;
    private validateFilingData;
    private getCurrentFilingPeriod;
    private markFilingReadyForReview;
    private attemptTransactionRecovery;
    private requestExemptionCertificates;
    private autoReconcilePayments;
    private enrichLocationData;
    private getNexusMonitoringData;
    private calculateSalesTrajectory;
    private calculateTransactionTrajectory;
    private calculateThresholdRisk;
    private assessFilingConsistency;
    private assessCalculationAccuracy;
    private assessExemptionCompliance;
    private getIndustryAuditRisk;
    private preloadNewRates;
    private prepareNexusRegistration;
    private enableEnhancedDocumentation;
    private enableAdvancedCalculationValidation;
    private enableAutomatedExemptionTracking;
    private createAuditTrailBackup;
}
//# sourceMappingURL=ProactiveComplianceService.d.ts.map