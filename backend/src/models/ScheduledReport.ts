import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduledReport extends Document {
  templateId: mongoose.Types.ObjectId;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  deliveryMethod: 'email' | 'slack' | 'webhook';
  recipients: string[]; // Email addresses or webhook URLs
  filters: Record<string, any>;
  nextRunDate?: Date;
  lastRunDate?: Date;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance method
  calculateNextRunDate(): Date;
}

const scheduledReportSchema = new Schema<IScheduledReport>({
  templateId: {
    type: Schema.Types.ObjectId,
    ref: 'ReportTemplate',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    required: true,
    enum: ['daily', 'weekly', 'monthly', 'quarterly']
  },
  deliveryMethod: {
    type: String,
    required: true,
    enum: ['email', 'slack', 'webhook']
  },
  recipients: {
    type: [String],
    required: true,
    validate: {
      validator: function(v: string[]) {
        return v && v.length > 0;
      },
      message: 'At least one recipient is required'
    }
  },
  filters: {
    type: Schema.Types.Mixed,
    default: {}
  },
  nextRunDate: {
    type: Date,
    index: true
  },
  lastRunDate: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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

// Compound index for active scheduled reports
scheduledReportSchema.index({ nextRunDate: 1, isActive: 1 });

// Update updatedAt on save
scheduledReportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate next run date if not set
  if (!this.nextRunDate && this.isActive) {
    this.nextRunDate = this.calculateNextRunDate();
  }
  
  next();
});

// Method to calculate next run date based on frequency
scheduledReportSchema.methods.calculateNextRunDate = function(): Date {
  const now = new Date();
  const nextRun = new Date(now);
  
  switch (this.frequency) {
    case 'daily':
      nextRun.setDate(now.getDate() + 1);
      break;
    case 'weekly':
      nextRun.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      nextRun.setMonth(now.getMonth() + 1);
      break;
    case 'quarterly':
      nextRun.setMonth(now.getMonth() + 3);
      break;
  }
  
  return nextRun;
};

export const ScheduledReport = mongoose.model<IScheduledReport>('ScheduledReport', scheduledReportSchema);