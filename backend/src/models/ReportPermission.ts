import mongoose, { Document, Schema } from 'mongoose';

export interface IReportPermission extends Document {
  reportId: mongoose.Types.ObjectId;
  reportType: 'template' | 'dashboard';
  userId: mongoose.Types.ObjectId;
  permissionLevel: 'view' | 'edit' | 'admin';
  grantedBy?: mongoose.Types.ObjectId;
  grantedAt: Date;
}

const reportPermissionSchema = new Schema<IReportPermission>({
  reportId: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'reportType'
  },
  reportType: {
    type: String,
    required: true,
    enum: ['template', 'dashboard']
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  permissionLevel: {
    type: String,
    required: true,
    enum: ['view', 'edit', 'admin']
  },
  grantedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  grantedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient permission checks
reportPermissionSchema.index({ reportId: 1, reportType: 1, userId: 1 }, { unique: true });
reportPermissionSchema.index({ userId: 1, permissionLevel: 1 });

export const ReportPermission = mongoose.model<IReportPermission>('ReportPermission', reportPermissionSchema);