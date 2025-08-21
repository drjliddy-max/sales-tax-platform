import mongoose, { Document, Schema } from 'mongoose';

export interface IAutomationLog extends Document {
  business_id: string;
  automation_type: 'setup' | 'compliance' | 'monitoring' | 'optimization';
  event_type: string;
  input_data: Record<string, any>;
  output_data?: Record<string, any>;
  confidence_score?: number;
  automation_level: 'full' | 'assisted' | 'manual';
  success: boolean;
  error_message?: string;
  processing_time_ms?: number;
  triggered_by: 'system' | 'schedule' | 'user' | 'api';
  timestamp: Date;
  correlation_id?: string;
}

const automationLogSchema = new Schema<IAutomationLog>({
  business_id: {
    type: String,
    required: true,
    index: true
  },
  automation_type: {
    type: String,
    required: true,
    enum: ['setup', 'compliance', 'monitoring', 'optimization'],
    index: true
  },
  event_type: {
    type: String,
    required: true,
    index: true
  },
  input_data: {
    type: Schema.Types.Mixed,
    required: true
  },
  output_data: {
    type: Schema.Types.Mixed
  },
  confidence_score: {
    type: Number,
    min: 0,
    max: 1
  },
  automation_level: {
    type: String,
    required: true,
    enum: ['full', 'assisted', 'manual']
  },
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  error_message: {
    type: String
  },
  processing_time_ms: {
    type: Number,
    min: 0
  },
  triggered_by: {
    type: String,
    required: true,
    enum: ['system', 'schedule', 'user', 'api']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  correlation_id: {
    type: String,
    index: true
  }
});

// Compound indexes for efficient querying
automationLogSchema.index({ business_id: 1, automation_type: 1, timestamp: -1 });
automationLogSchema.index({ success: 1, timestamp: -1 });
automationLogSchema.index({ event_type: 1, timestamp: -1 });

// TTL index to automatically delete old logs (keep for 1 year)
automationLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

export const AutomationLog = mongoose.model<IAutomationLog>('AutomationLog', automationLogSchema);