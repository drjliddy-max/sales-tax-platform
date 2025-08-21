import mongoose, { Document } from 'mongoose';
export interface IReportTemplate extends Document {
    name: string;
    description?: string;
    category: 'executive' | 'operational' | 'financial' | 'custom';
    templateConfig: {
        chartTypes: string[];
        metrics: string[];
        filters: Record<string, any>;
        layout: Record<string, any>;
    };
    isDefault: boolean;
    isPublic: boolean;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ReportTemplate: mongoose.Model<IReportTemplate, {}, {}, {}, mongoose.Document<unknown, {}, IReportTemplate> & IReportTemplate & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ReportTemplate.d.ts.map