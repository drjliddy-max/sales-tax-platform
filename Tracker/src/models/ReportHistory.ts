import mongoose, { Document, Schema } from 'mongoose';

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

const reportHistorySchema = new Schema<IReportHistory>({
  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'ReportTemplate',
    required: false
  },
  scheduledReportId: {
    type: Schema.Types.ObjectId,
    ref: 'ScheduledReport',
    required: false
  },
  reportName: {
    type: String,
    required: true,
    trim: true
  },
  reportData: {
    type: Schema.Types.Mixed,
    required: true
  },
  filePath: {
    type: String,
    trim: true
  },
  generationTimeMs: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['generating', 'completed', 'failed'],
    default: 'completed'
  },
  errorMessage: {
    type: String,
    trim: true
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient querying of recent reports
reportHistorySchema.index({ generatedAt: -1 });
reportHistorySchema.index({ templateId: 1, generatedAt: -1 });
reportHistorySchema.index({ scheduledReportId: 1, generatedAt: -1 });

export const ReportHistory = mongoose.model<IReportHistory>('ReportHistory', reportHistorySchema);