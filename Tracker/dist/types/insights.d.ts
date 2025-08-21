export interface BusinessData {
    id: string;
    name: string;
    industry: string;
    monthly_revenue: number;
    annual_revenue: number;
    employee_count: number;
    locations: BusinessLocation[];
    revenue_history: RevenueDataPoint[];
    tax_profile: TaxProfile;
    pos_integrations: POSIntegration[];
    created_at: Date;
    updated_at: Date;
}
export interface BusinessLocation {
    id: string;
    address: Address;
    is_primary: boolean;
    tax_jurisdictions: string[];
}
export interface Address {
    street: string;
    city: string;
    state: string;
    zip_code: string;
    country: string;
}
export interface RevenueDataPoint {
    date: Date;
    revenue: number;
    transactions: number;
    avg_transaction: number;
}
export interface TaxProfile {
    jurisdictions: TaxJurisdiction[];
    filing_schedule: FilingSchedule[];
    exemption_rules: ExemptionRule[];
    automation_level: AutomationLevel;
}
export interface TaxJurisdiction {
    name: string;
    type: 'state' | 'county' | 'city';
    rate: number;
    filing_frequency: 'monthly' | 'quarterly' | 'annual';
}
export interface FilingSchedule {
    jurisdiction: string;
    frequency: 'monthly' | 'quarterly' | 'annual';
    due_day: number;
    next_due_date: Date;
}
export interface ExemptionRule {
    type: string;
    conditions: Record<string, any>;
    documentation_required: string[];
}
export interface AutomationLevel {
    calculation: 'full' | 'assisted' | 'manual';
    filing_preparation: 'automatic' | 'assisted' | 'manual';
    rate_updates: 'silent' | 'notification' | 'manual';
    reporting: 'scheduled' | 'on_demand' | 'manual';
}
export interface POSIntegration {
    id: string;
    pos_system: string;
    status: 'active' | 'inactive' | 'error';
    last_sync: Date;
    sync_enabled: boolean;
}
export interface Insight {
    id?: string;
    type: InsightType;
    title: string;
    insight: string;
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
    estimated_revenue_impact?: number;
    estimated_savings?: number;
    actionable_steps: string[];
    confidence_score: number;
    generated_at: Date;
    expires_at?: Date;
    priority: number;
    business_id?: string;
    status?: 'active' | 'completed' | 'dismissed';
}
export type InsightType = 'seasonal_optimization' | 'pricing_optimization' | 'customer_retention' | 'tax_optimization' | 'exemption_opportunity' | 'peak_hour_optimization' | 'inventory_optimization' | 'nexus_threshold_warning' | 'audit_risk_mitigation' | 'compliance_improvement' | 'market_expansion' | 'cost_reduction' | 'automation_opportunity';
export interface SeasonalPattern {
    strength: number;
    peak_season: string;
    peak_increase: number;
    prep_weeks: number;
    marketing_start_weeks: number;
    low_season?: string;
    seasonal_variance: number;
}
export interface PricingAnalysis {
    optimization_potential: number;
    recommended_increase: number;
    revenue_impact: number;
    risk_assessment: 'low' | 'medium' | 'high';
    competitor_analysis?: CompetitorPricing[];
    price_elasticity: number;
}
export interface CompetitorPricing {
    competitor: string;
    avg_price: number;
    market_position: 'premium' | 'competitive' | 'budget';
}
export interface CustomerAnalysis {
    repeat_customer_rate: number;
    one_time_customers: number;
    repeat_customer_opportunity: number;
    avg_customer_lifetime_value: number;
    customer_acquisition_cost: number;
    churn_risk_factors: string[];
}
export interface TaxBurdenAnalysis {
    current_annual_tax: number;
    optimization_opportunities: TaxOptimization[];
    potential_savings: number;
    compliance_risk: number;
    industry_benchmark: number;
}
export interface TaxOptimization {
    type: string;
    description: string;
    estimated_savings: number;
    implementation_effort: 'low' | 'medium' | 'high';
    compliance_risk: 'low' | 'medium' | 'high';
    priority: number;
}
export interface ExemptionAnalysis {
    missed_exemptions: number;
    missed_savings: number;
    exemption_rate: number;
    improvement_potential: number;
    certificate_coverage: number;
    expired_certificates: number;
}
export interface PeakHourAnalysis {
    peak_hours: string[];
    optimization_potential: number;
    current_utilization: number;
    staffing_recommendations: StaffingRecommendation[];
}
export interface StaffingRecommendation {
    time_period: string;
    recommended_staff: number;
    current_staff: number;
    expected_improvement: number;
}
export interface InventoryAnalysis {
    overstock_value: number;
    potential_savings: number;
    fast_movers: InventoryItem[];
    slow_movers: InventoryItem[];
    turnover_rate: number;
}
export interface InventoryItem {
    product_id: string;
    name: string;
    current_stock: number;
    turnover_rate: number;
    value: number;
}
export interface MarketExpansionAnalysis {
    expansion_score: number;
    target_states: string[];
    estimated_additional_revenue: number;
    market_saturation: Record<string, number>;
    competition_analysis: Record<string, CompetitionMetrics>;
}
export interface CompetitionMetrics {
    competitor_count: number;
    market_share_opportunity: number;
    average_pricing: number;
    entry_difficulty: 'low' | 'medium' | 'high';
}
export interface AuditRiskAnalysis {
    score: number;
    risk_factors: AuditRiskFactor[];
    industry_baseline: number;
    recommendation: 'strengthen_defenses' | 'maintain_current_practices' | 'monitor_closely';
}
export interface AuditRiskFactor {
    factor: string;
    impact: number;
    description: string;
    severity: 'low' | 'medium' | 'high';
    mitigation_steps: string[];
}
export interface InsightDeliveryPreferences {
    delivery_method: 'email' | 'dashboard' | 'sms' | 'none';
    frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
    insight_types: InsightType[];
    optimal_send_time?: string;
    timezone: string;
    email_digest_enabled: boolean;
    mobile_notifications_enabled: boolean;
}
export interface InsightNotification {
    type: string;
    insights: Insight[];
    delivery_method: string;
    priority: 'low' | 'medium' | 'high';
    scheduled_send_time?: Date;
}
export interface UserInfo {
    id: string;
    name: string;
    email: string;
    business_id: string;
    timezone: string;
    notification_preferences: InsightDeliveryPreferences;
}
export interface InsightDigest {
    id: string;
    business_id: string;
    insights: Insight[];
    digest_type: 'weekly' | 'monthly';
    generated_at: Date;
    scheduled_send_date: Date;
    sent: boolean;
}
export interface InsightMetrics {
    total_insights_generated: number;
    insights_by_type: Record<InsightType, number>;
    average_confidence_score: number;
    total_estimated_value: number;
    insights_acted_upon: number;
    user_engagement_score: number;
}
//# sourceMappingURL=insights.d.ts.map