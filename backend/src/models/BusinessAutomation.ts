import mongoose, { Document, Schema } from 'mongoose';

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

const businessAutomationSchema = new Schema<IBusinessAutomation>({
  business_id: {
    type: Schema.Types.ObjectId,
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
    pattern_analysis: { type: Schema.Types.Mixed, default: {} }
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

// Update the updated_at field on save
businessAutomationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Indexes for efficient queries
businessAutomationSchema.index({ 'automation_profile.setup_level': 1 });
businessAutomationSchema.index({ 'ai_insights.risk_score': -1 });
businessAutomationSchema.index({ 'performance_metrics.automation_coverage': -1 });
businessAutomationSchema.index({ last_health_check: 1 });

export const BusinessAutomation = mongoose.model<IBusinessAutomation>('BusinessAutomation', businessAutomationSchema);