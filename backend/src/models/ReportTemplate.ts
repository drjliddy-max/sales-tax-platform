import mongoose, { Document, Schema } from 'mongoose';

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

const reportTemplateSchema = new Schema<IReportTemplate>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['executive', 'operational', 'financial', 'custom'],
    index: true
  },
  templateConfig: {
    chartTypes: [String],
    metrics: [String],
    filters: {
      type: Schema.Types.Mixed,
      default: {}
    },
    layout: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
reportTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const ReportTemplate = mongoose.model<IReportTemplate>('ReportTemplate', reportTemplateSchema);