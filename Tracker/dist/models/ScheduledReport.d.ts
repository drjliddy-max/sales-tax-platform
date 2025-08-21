import mongoose, { Document } from 'mongoose';
export interface IScheduledReport extends Document {
    templateId: mongoose.Types.ObjectId;
    name: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    deliveryMethod: 'email' | 'slack' | 'webhook';
    recipients: string[];
    filters: Record<string, any>;
    nextRunDate?: Date;
    lastRunDate?: Date;
    isActive: boolean;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    calculateNextRunDate(): Date;
}
export declare const ScheduledReport: mongoose.Model<IScheduledReport, {}, {}, {}, mongoose.Document<unknown, {}, IScheduledReport> & IScheduledReport & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ScheduledReport.d.ts.map