import { TaxCalculator } from '../tax-calculation/TaxCalculator';
import { SquareIntegration } from '../../integrations/pos/SquareIntegration';
import { EnhancedAnalyticsService } from '../EnhancedAnalyticsService';
export interface BusinessInfo {
    id: string;
    name: string;
    industry: string;
    description?: string;
    website?: string;
    estimated_annual_revenue: number;
    addresses: {
        primary: BusinessAddress;
    };
    locations?: BusinessLocation[];
}
export interface BusinessAddress {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}
export interface BusinessLocation {
    id: string;
    address: BusinessAddress;
    location_type: 'primary' | 'warehouse' | 'retail' | 'office';
    active: boolean;
}
export interface SetupSession {
    business_id: string;
    started_at: Date;
    completed_at?: Date;
    steps_completed: string[];
    automation_level: 'full' | 'assisted' | 'manual';
    status: 'in_progress' | 'fully_automated' | 'failed';
}
export interface TaxProfile {
    jurisdictions: TaxJurisdiction[];
    filing_schedule: FilingSchedule;
    product_tax_rules: ProductTaxRule[];
    exemption_rules: ExemptionRule[];
    rate_monitoring: RateMonitoring;
    automation_level: AutomationLevel;
}
export interface TaxJurisdiction {
    name: string;
    type: 'federal' | 'state' | 'county' | 'city' | 'special_district';
    tax_rate: number;
    filing_frequency: 'monthly' | 'quarterly' | 'annually';
    registration_required: boolean;
    nexus_threshold?: NexusThreshold;
}
export interface NexusThreshold {
    economic_threshold: number;
    transaction_threshold: number;
    period: 'annual' | 'quarterly' | 'monthly';
}
export interface FilingSchedule {
    [jurisdiction: string]: {
        frequency: 'monthly' | 'quarterly' | 'annually';
        due_day: number;
        extension_available: boolean;
    };
}
export interface ProductTaxRule {
    category: string;
    tax_rate_multiplier: number;
    exemptions: string[];
    special_handling?: string;
}
export interface ExemptionRule {
    type: string;
    conditions: Record<string, any>;
    documentation_required: string[];
}
export interface RateMonitoring {
    enabled: boolean;
    update_frequency: 'daily' | 'weekly' | 'monthly';
    notification_method: 'email' | 'sms' | 'dashboard' | 'silent';
}
export interface AutomationLevel {
    calculation: 'full' | 'assisted' | 'manual';
    filing_preparation: 'automatic' | 'assisted' | 'manual';
    rate_updates: 'silent' | 'notification' | 'manual';
    reporting: 'scheduled' | 'on_demand' | 'manual';
}
export interface POSSystemInfo {
    name: string;
    type: 'cloud_pos' | 'traditional_pos' | 'mobile_pos';
    confidence: number;
    detection_method: string;
    auto_connect_available: boolean;
    api_endpoint?: string;
    credentials?: Record<string, any>;
}
export interface POSConnection {
    pos_system: string;
    connection_id: string;
    status: 'active' | 'inactive' | 'error';
    sync_enabled: boolean;
    tax_calculation_enabled: boolean;
    automation_level: 'full' | 'partial' | 'manual';
    connected_at: Date;
    connection_method: 'automatic' | 'manual';
    last_sync?: Date;
}
export interface POSDiscoveryResult {
    discovered_systems: POSSystemInfo[];
    active_connections: POSConnection[];
    sync_status: 'real_time' | 'periodic' | 'manual';
    automation_level: 'full' | 'partial' | 'none';
    manual_intervention_required: boolean;
}
export interface AnalyticsConfiguration {
    config: AnalyticsConfig;
    dashboard: DashboardConfig;
    automation_enabled: boolean;
    user_configuration_required: boolean;
}
export interface AnalyticsConfig {
    revenue_tracking: RevenueTrackingConfig;
    cohort_analysis: CohortAnalysisConfig;
    forecasting: ForecastingConfig;
    health_scoring: HealthScoringConfig;
    insights_generation: InsightsConfig;
}
export interface RevenueTrackingConfig {
    primary_metrics: string[];
    tracking_granularity: 'hourly' | 'daily' | 'weekly';
    seasonality_adjustment: boolean;
    peak_hour_analysis?: boolean;
    product_performance?: boolean;
    client_lifecycle_tracking?: boolean;
    appointment_analytics?: boolean;
}
export interface CohortAnalysisConfig {
    enabled: boolean;
    cohort_period: 'weekly' | 'monthly' | 'quarterly';
    retention_periods: number[];
}
export interface ForecastingConfig {
    enabled: boolean;
    forecast_horizon_months: number;
    confidence_intervals: boolean;
    seasonal_adjustments: boolean;
}
export interface HealthScoringConfig {
    enabled: boolean;
    scoring_frequency: 'daily' | 'weekly' | 'monthly';
    alert_thresholds: Record<string, number>;
}
export interface InsightsConfig {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    delivery_method: 'email' | 'dashboard' | 'sms';
    complexity_level: 'simple' | 'detailed' | 'advanced';
}
export interface DashboardConfig {
    dashboard_id: string;
    layout: string;
    widgets: DashboardWidget[];
    auto_refresh: boolean;
}
export interface DashboardWidget {
    type: string;
    position: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    config: Record<string, any>;
}
export interface ComplianceWorkflow {
    jurisdiction: string;
    filing_frequency: string;
    automation_steps: ComplianceStep[];
    alerts: ComplianceAlerts;
}
export interface ComplianceStep {
    step: string;
    automation_level: 'full' | 'assisted' | 'manual';
    trigger: string;
    dependencies?: string[];
}
export interface ComplianceAlerts {
    upcoming_deadline: AlertConfig;
    missing_data: AlertConfig;
    rate_changes: AlertConfig;
}
export interface AlertConfig {
    timing: number[] | string;
    method: ('email' | 'sms' | 'dashboard')[];
    urgency_escalation?: boolean;
    auto_resolution_attempts?: number;
    auto_application?: boolean;
}
export interface BackgroundService {
    service: string;
    frequency: string;
    automation_level: string;
    description: string;
    enabled?: boolean;
    last_run?: Date;
    next_run?: Date;
}
export interface ReportingSetup {
    scheduled_reports: ScheduledReportConfig[];
    delivery_method: string;
    format_preferences: string[];
    automation_level: 'full' | 'assisted' | 'manual';
}
export interface ScheduledReportConfig {
    report_type: string;
    frequency: string;
    delivery_time?: string;
    delivery_day?: string | number;
    recipients: string[];
    format: string;
}
export interface AutomationLogEntry {
    type: string;
    business_id: string;
    input_data: Record<string, any>;
    output_data?: Record<string, any>;
    confidence_score?: number;
    automation_level: string;
    timestamp: Date;
    success: boolean;
    error_message?: string;
}
export declare class AutomationLogger {
    log(entry: AutomationLogEntry): Promise<void>;
}
export declare class PassiveSetupService {
    private taxCalculator;
    private posService;
    private analyticsService;
    private automationLogger;
    private reportingService;
    constructor(taxCalculator: TaxCalculator, posService: SquareIntegration, analyticsService: typeof EnhancedAnalyticsService);
    autoConfigureNewBusiness(businessInfo: BusinessInfo): Promise<{
        automation_status: 'complete' | 'partial' | 'failed';
        setup_time_seconds: number;
        user_actions_required: number;
        ongoing_maintenance_required: boolean;
        next_automation_check: Date;
        configuration: {
            tax_profile: TaxProfile;
            pos_connections: POSDiscoveryResult;
            revenue_config: AnalyticsConfiguration;
            compliance_workflows: {
                workflows: ComplianceWorkflow[];
                total_jurisdictions: number;
                automation_coverage: string;
                manual_interventions_per_month: number;
            };
            reporting_setup: ReportingSetup;
            background_services: {
                enabled_services: BackgroundService[];
                monitoring_level: string;
                user_visibility: string;
                intervention_required: string;
            };
        };
    }>;
    autoDetectTaxObligations(businessInfo: BusinessInfo): Promise<TaxProfile>;
    autoDiscoverPOSSystems(businessInfo: BusinessInfo): Promise<POSDiscoveryResult>;
    detectPOSFromBusinessInfo(businessInfo: BusinessInfo): Promise<POSSystemInfo[]>;
    autoConnectPOS(posSystem: POSSystemInfo, businessInfo: BusinessInfo): Promise<POSConnection>;
    autoConfigureAnalytics(businessInfo: BusinessInfo, taxProfile: TaxProfile): Promise<AnalyticsConfiguration>;
    private getOptimalRevenueConfig;
    private getCohortConfig;
    private getForecastingConfig;
    private getHealthScoringConfig;
    setupAutomatedCompliance(businessInfo: BusinessInfo, taxProfile: TaxProfile): Promise<{
        workflows: ComplianceWorkflow[];
        total_jurisdictions: number;
        automation_coverage: string;
        manual_interventions_per_month: number;
    }>;
    enableBackgroundAutomation(businessInfo: BusinessInfo): Promise<{
        enabled_services: BackgroundService[];
        monitoring_level: string;
        user_visibility: string;
        intervention_required: string;
    }>;
    setupPassiveReporting(businessInfo: BusinessInfo): Promise<ReportingSetup>;
    private getObligationsByAddress;
    private getIndustrySpecificRules;
    private checkRevenueThresholds;
    private analyzeNexusRequirements;
    private consolidateJurisdictions;
    private determineOptimalFilingSchedule;
    private calculateConfidenceScore;
    private scheduleNextAutomationCheck;
    private logAutomationSuccess;
    private handleAutomationFailure;
    private scanNetworkForPOSDevices;
    private analyzeDomainForPOSIntegrations;
    private inferPOSFromIndustry;
    private deduplicatePOSSystems;
    private enableRealtimeSync;
    private tryOAuthAutoConnect;
    private tryAPIKeyAutoConnect;
    private tryWebhookAutoConnect;
    private verifyPOSConnection;
    private savePOSConnection;
    private createBusinessTypeDashboard;
    private enableAutomatedDataProcessing;
    private scheduleComplianceWorkflow;
    private enableBackgroundService;
    private scheduleAutomaticReport;
}
//# sourceMappingURL=PassiveSetupService.d.ts.map