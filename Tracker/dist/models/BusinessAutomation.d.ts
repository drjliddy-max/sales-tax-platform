import mongoose, { Document } from 'mongoose';
export interface IBusinessAutomation extends Document {
    business_id: mongoose.Types.ObjectId;
    automation_profile: {
        setup_completed: boolean;
        setup_level: 'full' | 'partial' | 'manual';
        setup_completion_date?: Date;
        automation_preferences: {
            tax_calculation: 'full' | 'assisted' | 'manual';
            compliance_monitoring: 'proactive' | 'reactive' | 'manual';
            report_generation: 'automated' | 'scheduled' | 'on_demand';
            filing_preparation: 'automated' | 'assisted' | 'manual';
        };
    };
    pos_integrations: Array<{
        system_name: string;
        connection_status: 'active' | 'inactive' | 'error';
        automation_level: 'full' | 'partial' | 'manual';
        last_sync: Date;
        auto_discovered: boolean;
        confidence_score: number;
    }>;
    compliance_workflows: Array<{
        jurisdiction: string;
        workflow_type: 'filing' | 'registration' | 'monitoring';
        automation_level: 'full' | 'assisted' | 'manual';
        schedule: string;
        last_execution: Date;
        next_execution: Date;
        success_rate: number;
    }>;
    background_services: Array<{
        service_name: string;
        service_type: 'monitoring' | 'optimization' | 'maintenance' | 'security';
        enabled: boolean;
        automation_level: 'silent' | 'notify' | 'manual';
        frequency: string;
        last_run: Date;
        next_run: Date;
        health_status: 'healthy' | 'degraded' | 'error';
    }>;
    ai_insights: {
        enabled: boolean;
        confidence_threshold: number;
        last_analysis: Date;
        risk_score: number;
        recommendations: string[];
        pattern_analysis: Record<string, any>;
    };
    performance_metrics: {
        automation_coverage: number;
        user_intervention_rate: number;
        error_rate: number;
        processing_efficiency: number;
        cost_savings_estimated: number;
        time_savings_hours_per_month: number;
    };
    alerts_preferences: {
        urgency_threshold: 'low' | 'medium' | 'high';
        delivery_methods: ('email' | 'sms' | 'dashboard' | 'webhook')[];
        quiet_hours: {
            enabled: boolean;
            start_time: string;
            end_time: string;
            timezone: string;
        };
        escalation_enabled: boolean;
        escalation_delay_minutes: number;
    };
    created_at: Date;
    updated_at: Date;
    last_health_check: Date;
}
export declare const BusinessAutomation: mongoose.Model<IBusinessAutomation, {}, {}, {}, mongoose.Document<unknown, {}, IBusinessAutomation> & IBusinessAutomation & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=BusinessAutomation.d.ts.map