"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassiveSetupService = exports.AutomationLogger = void 0;
const ComprehensiveReportingService_1 = require("../ComprehensiveReportingService");
class AutomationLogger {
    async log(entry) {
        try {
            console.log(`[AUTOMATION] ${entry.type} for business ${entry.business_id}:`, {
                success: entry.success,
                confidence: entry.confidence_score,
                automation_level: entry.automation_level,
                timestamp: entry.timestamp
            });
        }
        catch (error) {
            console.error('Failed to log automation entry:', error);
        }
    }
}
exports.AutomationLogger = AutomationLogger;
class PassiveSetupService {
    constructor(taxCalculator, posService, analyticsService) {
        this.taxCalculator = taxCalculator;
        this.posService = posService;
        this.analyticsService = analyticsService;
        this.automationLogger = new AutomationLogger();
        this.reportingService = new ComprehensiveReportingService_1.ComprehensiveReportingService();
    }
    async autoConfigureNewBusiness(businessInfo) {
        const setupSession = {
            business_id: businessInfo.id,
            started_at: new Date(),
            steps_completed: [],
            automation_level: 'full',
            status: 'in_progress'
        };
        try {
            const taxProfile = await this.autoDetectTaxObligations(businessInfo);
            setupSession.steps_completed.push('tax_profile_detected');
            const posConnections = await this.autoDiscoverPOSSystems(businessInfo);
            setupSession.steps_completed.push('pos_systems_connected');
            const revenueConfig = await this.autoConfigureAnalytics(businessInfo, taxProfile);
            setupSession.steps_completed.push('analytics_configured');
            const complianceWorkflows = await this.setupAutomatedCompliance(businessInfo, taxProfile);
            setupSession.steps_completed.push('compliance_automated');
            const reportingSetup = await this.setupPassiveReporting(businessInfo);
            setupSession.steps_completed.push('reporting_configured');
            const backgroundServices = await this.enableBackgroundAutomation(businessInfo);
            setupSession.steps_completed.push('background_services_enabled');
            setupSession.completed_at = new Date();
            setupSession.status = 'fully_automated';
            await this.logAutomationSuccess(setupSession);
            return {
                automation_status: 'complete',
                setup_time_seconds: (setupSession.completed_at.getTime() - setupSession.started_at.getTime()) / 1000,
                user_actions_required: 0,
                ongoing_maintenance_required: false,
                next_automation_check: this.scheduleNextAutomationCheck(businessInfo.id),
                configuration: {
                    tax_profile: taxProfile,
                    pos_connections: posConnections,
                    revenue_config: revenueConfig,
                    compliance_workflows: complianceWorkflows,
                    reporting_setup: reportingSetup,
                    background_services: backgroundServices
                }
            };
        }
        catch (error) {
            await this.handleAutomationFailure(setupSession, error);
            throw error;
        }
    }
    async autoDetectTaxObligations(businessInfo) {
        const detection = {
            business_address: businessInfo.addresses.primary,
            business_type: businessInfo.industry,
            estimated_revenue: businessInfo.estimated_annual_revenue,
            locations: businessInfo.locations || []
        };
        const [addressBasedObligations, industryBasedRules, revenueThresholds, nexusAnalysis] = await Promise.all([
            this.getObligationsByAddress(detection.business_address),
            this.getIndustrySpecificRules(detection.business_type),
            this.checkRevenueThresholds(detection.estimated_revenue, detection.business_address),
            this.analyzeNexusRequirements(detection.locations)
        ]);
        const consolidatedProfile = {
            jurisdictions: this.consolidateJurisdictions([
                ...addressBasedObligations.jurisdictions,
                ...nexusAnalysis.required_jurisdictions
            ]),
            filing_schedule: this.determineOptimalFilingSchedule(detection.estimated_revenue, addressBasedObligations.jurisdictions),
            product_tax_rules: industryBasedRules.tax_categories,
            exemption_rules: industryBasedRules.exemptions,
            rate_monitoring: {
                enabled: true,
                update_frequency: 'daily',
                notification_method: 'silent'
            },
            automation_level: {
                calculation: 'full',
                filing_preparation: 'automatic',
                rate_updates: 'silent',
                reporting: 'scheduled'
            }
        };
        await this.automationLogger.log({
            type: 'tax_profile_detection',
            business_id: businessInfo.id,
            input_data: detection,
            output_data: consolidatedProfile,
            confidence_score: this.calculateConfidenceScore(consolidatedProfile),
            automation_level: 'full',
            timestamp: new Date(),
            success: true
        });
        return consolidatedProfile;
    }
    async autoDiscoverPOSSystems(businessInfo) {
        const discoveryMethods = [
            this.scanNetworkForPOSDevices.bind(this),
            this.detectPOSFromBusinessInfo.bind(this),
            this.analyzeDomainForPOSIntegrations.bind(this),
            this.inferPOSFromIndustry.bind(this)
        ];
        const discoveredSystems = [];
        for (const method of discoveryMethods) {
            try {
                const systems = await method(businessInfo);
                discoveredSystems.push(...systems);
            }
            catch (error) {
                console.log(`POS discovery method failed: ${error.message}`);
            }
        }
        const uniqueSystems = this.deduplicatePOSSystems(discoveredSystems);
        const rankedSystems = uniqueSystems.sort((a, b) => b.confidence - a.confidence);
        const connections = [];
        for (const system of rankedSystems.slice(0, 3)) {
            if (system.confidence > 0.7) {
                try {
                    const connection = await this.autoConnectPOS(system, businessInfo);
                    connections.push(connection);
                    await this.enableRealtimeSync(connection);
                }
                catch (error) {
                    console.log(`Auto-connection failed for ${system.name}: ${error.message}`);
                }
            }
        }
        return {
            discovered_systems: rankedSystems,
            active_connections: connections,
            sync_status: 'real_time',
            automation_level: 'full',
            manual_intervention_required: connections.length === 0
        };
    }
    async detectPOSFromBusinessInfo(businessInfo) {
        const indicators = [];
        const posKeywords = {
            'square': ['square', 'sq ', 'square pos'],
            'clover': ['clover', 'first data'],
            'shopify': ['shopify', 'shopify pos'],
            'lightspeed': ['lightspeed', 'lightspeed retail'],
            'toast': ['toast', 'toast pos', 'restaurant pos'],
            'ncr': ['ncr', 'aloha', 'ncr silver'],
            'revel': ['revel', 'revel pos'],
            'vend': ['vend', 'lightspeed retail']
        };
        const businessText = `
      ${businessInfo.description || ''} 
      ${businessInfo.website || ''} 
      ${businessInfo.industry || ''}
    `.toLowerCase();
        for (const [system, keywords] of Object.entries(posKeywords)) {
            for (const keyword of keywords) {
                if (businessText.includes(keyword)) {
                    indicators.push({
                        name: system,
                        type: 'cloud_pos',
                        confidence: 0.8,
                        detection_method: 'business_description',
                        auto_connect_available: true
                    });
                    break;
                }
            }
        }
        const industryPOSMap = {
            'restaurant': [
                { name: 'toast', confidence: 0.6, type: 'cloud_pos', detection_method: 'industry_inference', auto_connect_available: true },
                { name: 'square', confidence: 0.5, type: 'cloud_pos', detection_method: 'industry_inference', auto_connect_available: true }
            ],
            'retail': [
                { name: 'square', confidence: 0.7, type: 'cloud_pos', detection_method: 'industry_inference', auto_connect_available: true },
                { name: 'clover', confidence: 0.6, type: 'cloud_pos', detection_method: 'industry_inference', auto_connect_available: true },
                { name: 'lightspeed', confidence: 0.5, type: 'cloud_pos', detection_method: 'industry_inference', auto_connect_available: true }
            ],
            'salon': [
                { name: 'square', confidence: 0.8, type: 'cloud_pos', detection_method: 'industry_inference', auto_connect_available: true },
                { name: 'booker', confidence: 0.6, type: 'cloud_pos', detection_method: 'industry_inference', auto_connect_available: true }
            ]
        };
        if (industryPOSMap[businessInfo.industry]) {
            indicators.push(...industryPOSMap[businessInfo.industry]);
        }
        return indicators;
    }
    async autoConnectPOS(posSystem, businessInfo) {
        const connectionMethods = [
            () => this.tryOAuthAutoConnect(posSystem, businessInfo),
            () => this.tryAPIKeyAutoConnect(posSystem, businessInfo),
            () => this.tryWebhookAutoConnect(posSystem, businessInfo)
        ];
        for (const method of connectionMethods) {
            try {
                const connection = await method();
                if (connection.status === 'active') {
                    const verification = await this.verifyPOSConnection(connection);
                    if (verification.success) {
                        await this.savePOSConnection(businessInfo.id, connection);
                        return {
                            pos_system: posSystem.name,
                            connection_id: connection.id,
                            status: 'active',
                            sync_enabled: true,
                            tax_calculation_enabled: true,
                            automation_level: 'full',
                            connected_at: new Date(),
                            connection_method: 'automatic'
                        };
                    }
                }
            }
            catch (error) {
                console.log(`Connection method failed: ${error.message}`);
                continue;
            }
        }
        throw new Error(`Unable to auto-connect to ${posSystem.name}`);
    }
    async autoConfigureAnalytics(businessInfo, taxProfile) {
        const analyticsConfig = {
            revenue_tracking: this.getOptimalRevenueConfig(businessInfo),
            cohort_analysis: this.getCohortConfig(businessInfo),
            forecasting: this.getForecastingConfig(businessInfo),
            health_scoring: this.getHealthScoringConfig(businessInfo),
            insights_generation: {
                enabled: true,
                frequency: 'weekly',
                delivery_method: 'email',
                complexity_level: 'simple'
            }
        };
        const dashboard = await this.createBusinessTypeDashboard(businessInfo, analyticsConfig);
        await this.enableAutomatedDataProcessing(businessInfo.id, analyticsConfig);
        return {
            config: analyticsConfig,
            dashboard: dashboard,
            automation_enabled: true,
            user_configuration_required: false
        };
    }
    getOptimalRevenueConfig(businessInfo) {
        const industryDefaults = {
            'restaurant': {
                primary_metrics: ['daily_sales', 'average_ticket', 'table_turns', 'food_cost_ratio'],
                tracking_granularity: 'hourly',
                seasonality_adjustment: true,
                peak_hour_analysis: true
            },
            'retail': {
                primary_metrics: ['daily_sales', 'units_sold', 'average_transaction', 'inventory_turns'],
                tracking_granularity: 'daily',
                seasonality_adjustment: true,
                product_performance: true
            },
            'service': {
                primary_metrics: ['service_revenue', 'client_retention', 'average_service_value'],
                tracking_granularity: 'daily',
                seasonality_adjustment: true,
                client_lifecycle_tracking: true,
                appointment_analytics: true
            }
        };
        return industryDefaults[businessInfo.industry] || industryDefaults['retail'];
    }
    getCohortConfig(businessInfo) {
        return {
            enabled: true,
            cohort_period: 'monthly',
            retention_periods: [1, 3, 6, 12]
        };
    }
    getForecastingConfig(businessInfo) {
        return {
            enabled: true,
            forecast_horizon_months: 6,
            confidence_intervals: true,
            seasonal_adjustments: true
        };
    }
    getHealthScoringConfig(businessInfo) {
        return {
            enabled: true,
            scoring_frequency: 'weekly',
            alert_thresholds: {
                'low_health': 0.3,
                'at_risk': 0.5,
                'healthy': 0.8
            }
        };
    }
    async setupAutomatedCompliance(businessInfo, taxProfile) {
        const workflows = [];
        for (const jurisdiction of taxProfile.jurisdictions) {
            const workflow = {
                jurisdiction: jurisdiction.name,
                filing_frequency: jurisdiction.filing_frequency,
                automation_steps: [
                    {
                        step: 'data_collection',
                        automation_level: 'full',
                        trigger: 'period_end_minus_5_days'
                    },
                    {
                        step: 'calculation_verification',
                        automation_level: 'full',
                        trigger: 'data_collection_complete'
                    },
                    {
                        step: 'report_generation',
                        automation_level: 'full',
                        trigger: 'calculation_verified'
                    },
                    {
                        step: 'filing_preparation',
                        automation_level: 'assisted',
                        trigger: 'report_generated'
                    },
                    {
                        step: 'deadline_monitoring',
                        automation_level: 'full',
                        trigger: 'continuous'
                    }
                ],
                alerts: {
                    upcoming_deadline: {
                        timing: [30, 7, 1],
                        method: ['email', 'dashboard'],
                        urgency_escalation: true
                    },
                    missing_data: {
                        timing: 'immediate',
                        method: ['email', 'sms'],
                        auto_resolution_attempts: 3
                    },
                    rate_changes: {
                        timing: 'immediate',
                        method: ['email'],
                        auto_application: true
                    }
                }
            };
            workflows.push(workflow);
        }
        for (const workflow of workflows) {
            await this.scheduleComplianceWorkflow(businessInfo.id, workflow);
        }
        return {
            workflows: workflows,
            total_jurisdictions: taxProfile.jurisdictions.length,
            automation_coverage: '95%',
            manual_interventions_per_month: workflows.length * 0.2
        };
    }
    async enableBackgroundAutomation(businessInfo) {
        const backgroundServices = [
            {
                service: 'tax_rate_monitor',
                frequency: 'daily',
                automation_level: 'silent',
                description: 'Monitor and apply tax rate changes automatically'
            },
            {
                service: 'data_quality_monitor',
                frequency: 'hourly',
                automation_level: 'auto_correct',
                description: 'Detect and fix data quality issues automatically'
            },
            {
                service: 'performance_optimizer',
                frequency: 'weekly',
                automation_level: 'auto_tune',
                description: 'Optimize system performance automatically'
            },
            {
                service: 'security_monitor',
                frequency: 'continuous',
                automation_level: 'alert_and_protect',
                description: 'Monitor for security issues and auto-protect'
            },
            {
                service: 'automated_backup',
                frequency: 'daily',
                automation_level: 'full',
                description: 'Automatic data backup and recovery'
            },
            {
                service: 'system_health_monitor',
                frequency: 'continuous',
                automation_level: 'self_healing',
                description: 'Monitor and automatically fix system issues'
            }
        ];
        for (const service of backgroundServices) {
            await this.enableBackgroundService(businessInfo.id, service);
        }
        return {
            enabled_services: backgroundServices,
            monitoring_level: 'comprehensive',
            user_visibility: 'minimal',
            intervention_required: 'rare'
        };
    }
    async setupPassiveReporting(businessInfo) {
        const industryReportConfigs = {
            'restaurant': {
                daily_summary: { enabled: true, time: '23:30' },
                weekly_performance: { enabled: true, day: 'monday', time: '08:00' },
                monthly_financials: { enabled: true, day: 1, time: '09:00' },
                tax_summary: { enabled: true, frequency: 'monthly' }
            },
            'retail': {
                daily_sales: { enabled: true, time: '22:00' },
                weekly_inventory: { enabled: true, day: 'sunday', time: '18:00' },
                monthly_analytics: { enabled: true, day: 1, time: '08:00' },
                quarterly_review: { enabled: true, frequency: 'quarterly' }
            }
        };
        const config = industryReportConfigs[businessInfo.industry] || industryReportConfigs['retail'];
        const scheduledReports = [];
        for (const [reportType, settings] of Object.entries(config)) {
            if (settings.enabled) {
                const report = await this.scheduleAutomaticReport(businessInfo.id, reportType, settings);
                scheduledReports.push(report);
            }
        }
        return {
            scheduled_reports: scheduledReports,
            delivery_method: 'email',
            format_preferences: ['pdf', 'mobile_friendly'],
            automation_level: 'full'
        };
    }
    async getObligationsByAddress(address) {
        return {
            jurisdictions: [
                {
                    name: `${address.state} State`,
                    type: 'state',
                    tax_rate: 0.0625,
                    filing_frequency: 'monthly',
                    registration_required: true
                },
                {
                    name: `${address.city} City`,
                    type: 'city',
                    tax_rate: 0.01,
                    filing_frequency: 'quarterly',
                    registration_required: false
                }
            ]
        };
    }
    async getIndustrySpecificRules(industry) {
        return {
            tax_categories: [
                {
                    category: 'general',
                    tax_rate_multiplier: 1.0,
                    exemptions: []
                }
            ],
            exemptions: []
        };
    }
    async checkRevenueThresholds(revenue, address) {
        return {};
    }
    async analyzeNexusRequirements(locations) {
        return { required_jurisdictions: [] };
    }
    consolidateJurisdictions(jurisdictions) {
        const seen = new Set();
        return jurisdictions.filter(j => {
            if (seen.has(j.name))
                return false;
            seen.add(j.name);
            return true;
        });
    }
    determineOptimalFilingSchedule(revenue, jurisdictions) {
        const schedule = {};
        jurisdictions.forEach(j => {
            schedule[j.name] = {
                frequency: j.filing_frequency,
                due_day: 20,
                extension_available: true
            };
        });
        return schedule;
    }
    calculateConfidenceScore(profile) {
        return 0.9;
    }
    scheduleNextAutomationCheck(businessId) {
        const nextCheck = new Date();
        nextCheck.setDate(nextCheck.getDate() + 30);
        return nextCheck;
    }
    async logAutomationSuccess(session) {
        await this.automationLogger.log({
            type: 'setup_session_complete',
            business_id: session.business_id,
            input_data: { steps_completed: session.steps_completed },
            automation_level: session.automation_level,
            timestamp: new Date(),
            success: true
        });
    }
    async handleAutomationFailure(session, error) {
        session.status = 'failed';
        await this.automationLogger.log({
            type: 'setup_session_failed',
            business_id: session.business_id,
            input_data: { steps_completed: session.steps_completed },
            automation_level: session.automation_level,
            timestamp: new Date(),
            success: false,
            error_message: error.message
        });
    }
    async scanNetworkForPOSDevices(businessInfo) { return []; }
    async analyzeDomainForPOSIntegrations(businessInfo) { return []; }
    async inferPOSFromIndustry(businessInfo) { return []; }
    deduplicatePOSSystems(systems) { return systems; }
    async enableRealtimeSync(connection) { }
    async tryOAuthAutoConnect(system, info) { return { status: 'active', id: 'test' }; }
    async tryAPIKeyAutoConnect(system, info) { return { status: 'active', id: 'test' }; }
    async tryWebhookAutoConnect(system, info) { return { status: 'active', id: 'test' }; }
    async verifyPOSConnection(connection) { return { success: true }; }
    async savePOSConnection(businessId, connection) { }
    async createBusinessTypeDashboard(info, config) {
        return {
            dashboard_id: 'default',
            layout: 'grid',
            widgets: [],
            auto_refresh: true
        };
    }
    async enableAutomatedDataProcessing(businessId, config) { }
    async scheduleComplianceWorkflow(businessId, workflow) { }
    async enableBackgroundService(businessId, service) { }
    async scheduleAutomaticReport(businessId, type, settings) {
        return {
            report_type: type,
            frequency: settings.frequency || 'daily',
            recipients: [],
            format: 'pdf'
        };
    }
}
exports.PassiveSetupService = PassiveSetupService;
//# sourceMappingURL=PassiveSetupService.js.map