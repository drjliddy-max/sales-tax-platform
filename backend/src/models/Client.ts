import mongoose, { Document, Schema } from 'mongoose';

export interface IClient extends Document {
  name: string;
  email: string;
  currentTierId?: mongoose.Types.ObjectId;
  status: 'active' | 'inactive' | 'suspended';
  signupDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    maxlength: 255
  },
  email: {
    type: String,
    required: true,
    unique: true,
    maxlength: 255
  },
  currentTierId: {
    type: Schema.Types.ObjectId,
    ref: 'ClientTier'
  },
  status: {
    type: String,
    default: 'active',
    enum: ['active', 'inactive', 'suspended']
  },
  signupDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for performance
ClientSchema.index({ email: 1 });
ClientSchema.index({ currentTierId: 1 });

export const Client = mongoose.model<IClient>('Client', ClientSchema);