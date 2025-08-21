import mongoose, { Document } from 'mongoose';
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
export declare const AutomationLog: mongoose.Model<IAutomationLog, {}, {}, {}, mongoose.Document<unknown, {}, IAutomationLog> & IAutomationLog & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=AutomationLog.d.ts.map