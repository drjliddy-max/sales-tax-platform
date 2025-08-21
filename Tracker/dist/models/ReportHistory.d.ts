import mongoose, { Document } from 'mongoose';
export interface IReportHistory extends Document {
    templateId?: mongoose.Types.ObjectId;
    scheduledReportId?: mongoose.Types.ObjectId;
    reportName: string;
    reportData: Record<string, any>;
    filePath?: string;
    generationTimeMs: number;
    status: 'generating' | 'completed' | 'failed';
    errorMessage?: string;
    generatedAt: Date;
}
export declare const ReportHistory: mongoose.Model<IReportHistory, {}, {}, {}, mongoose.Document<unknown, {}, IReportHistory> & IReportHistory & {
    _id: mongoose.Types.ObjectId;
}, any>;
//# sourceMappingURL=ReportHistory.d.ts.map