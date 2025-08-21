import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomDashboard extends Document {
  name: string;
  description?: string;
  layoutConfig: {
    widgets: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      config: Record<string, any>;
    }>;
    layout: Record<string, any>;
  };
  filters: Record<string, any>;
  isDefault: boolean;
  isShared: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customDashboardSchema = new Schema<ICustomDashboard>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  layoutConfig: {
    widgets: [{
      id: { type: String, required: true },
      type: { type: String, required: true },
      position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      },
      size: {
        width: { type: Number, required: true },
        height: { type: Number, required: true }
      },
      config: {
        type: Schema.Types.Mixed,
        default: {}
      }
    }],
    layout: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  filters: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isShared: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true
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
customDashboardSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const CustomDashboard = mongoose.model<ICustomDashboard>('CustomDashboard', customDashboardSchema);