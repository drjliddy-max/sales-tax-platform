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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessAutomation = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const businessAutomationSchema = new mongoose_1.Schema({
    business_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        unique: true,
        index: true
    },
    automation_profile: {
        setup_completed: { type: Boolean, default: false },
        setup_level: {
            type: String,
            enum: ['full', 'partial', 'manual'],
            default: 'manual'
        },
        setup_completion_date: Date,
        automation_preferences: {
            tax_calculation: {
                type: String,
                enum: ['full', 'assisted', 'manual'],
                default: 'manual'
            },
            compliance_monitoring: {
                type: String,
                enum: ['proactive', 'reactive', 'manual'],
                default: 'manual'
            },
            report_generation: {
                type: String,
                enum: ['automated', 'scheduled', 'on_demand'],
                default: 'on_demand'
            },
            filing_preparation: {
                type: String,
                enum: ['automated', 'assisted', 'manual'],
                default: 'manual'
            }
        }
    },
    pos_integrations: [{
            system_name: { type: String, required: true },
            connection_status: {
                type: String,
                enum: ['active', 'inactive', 'error'],
                default: 'inactive'
            },
            automation_level: {
                type: String,
                enum: ['full', 'partial', 'manual'],
                default: 'manual'
            },
            last_sync: Date,
            auto_discovered: { type: Boolean, default: false },
            confidence_score: { type: Number, min: 0, max: 1, default: 0 }
        }],
    compliance_workflows: [{
            jurisdiction: { type: String, required: true },
            workflow_type: {
                type: String,
                enum: ['filing', 'registration', 'monitoring'],
                required: true
            },
            automation_level: {
                type: String,
                enum: ['full', 'assisted', 'manual'],
                default: 'manual'
            },
            schedule: String,
            last_execution: Date,
            next_execution: Date,
            success_rate: { type: Number, min: 0, max: 1, default: 1 }
        }],
    background_services: [{
            service_name: { type: String, required: true },
            service_type: {
                type: String,
                enum: ['monitoring', 'optimization', 'maintenance', 'security'],
                required: true
            },
            enabled: { type: Boolean, default: false },
            automation_level: {
                type: String,
                enum: ['silent', 'notify', 'manual'],
                default: 'manual'
            },
            frequency: String,
            last_run: Date,
            next_run: Date,
            health_status: {
                type: String,
                enum: ['healthy', 'degraded', 'error'],
                default: 'healthy'
            }
        }],
    ai_insights: {
        enabled: { type: Boolean, default: false },
        confidence_threshold: { type: Number, min: 0, max: 1, default: 0.7 },
        last_analysis: Date,
        risk_score: { type: Number, min: 0, max: 1, default: 0 },
        recommendations: [String],
        pattern_analysis: { type: mongoose_1.Schema.Types.Mixed, default: {} }
    },
    performance_metrics: {
        automation_coverage: { type: Number, min: 0, max: 1, default: 0 },
        user_intervention_rate: { type: Number, min: 0, max: 1, default: 1 },
        error_rate: { type: Number, min: 0, max: 1, default: 0 },
        processing_efficiency: { type: Number, min: 0, max: 1, default: 0 },
        cost_savings_estimated: { type: Number, min: 0, default: 0 },
        time_savings_hours_per_month: { type: Number, min: 0, default: 0 }
    },
    alerts_preferences: {
        urgency_threshold: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        delivery_methods: [{
                type: String,
                enum: ['email', 'sms', 'dashboard', 'webhook']
            }],
        quiet_hours: {
            enabled: { type: Boolean, default: false },
            start_time: { type: String, default: '22:00' },
            end_time: { type: String, default: '08:00' },
            timezone: { type: String, default: 'America/Chicago' }
        },
        escalation_enabled: { type: Boolean, default: false },
        escalation_delay_minutes: { type: Number, min: 5, default: 30 }
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    last_health_check: Date
});
businessAutomationSchema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});
businessAutomationSchema.index({ 'automation_profile.setup_level': 1 });
businessAutomationSchema.index({ 'ai_insights.risk_score': -1 });
businessAutomationSchema.index({ 'performance_metrics.automation_coverage': -1 });
businessAutomationSchema.index({ last_health_check: 1 });
exports.BusinessAutomation = mongoose_1.default.model('BusinessAutomation', businessAutomationSchema);
//# sourceMappingURL=BusinessAutomation.js.map