import mongoose, { Schema, Document } from 'mongoose';

export interface IBusiness extends Document {
  businessId: string;
  name: string;
  taxId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  locations: Array<{
    id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    active: boolean;
  }>;
  nexusStates: string[];
  integrations: {
    pos: Array<{
      type: 'square' | 'shopify' | 'clover' | 'toast';
      enabled: boolean;
      credentials: Record<string, any>;
      lastSync: Date;
    }>;
    accounting: Array<{
      type: 'quickbooks' | 'xero' | 'freshbooks';
      enabled: boolean;
      credentials: Record<string, any>;
      lastSync: Date;
    }>;
    taxProviders: Array<{
      type: 'avalara' | 'taxjar';
      enabled: boolean;
      credentials: Record<string, any>;
      primary: boolean;
    }>;
  };
  filingSchedule: Array<{
    state: string;
    frequency: 'monthly' | 'quarterly' | 'annually';
    dueDay: number;
    lastFiled: Date;
    nextDue: Date;
  }>;
  settings: {
    autoSync: boolean;
    syncFrequency: number;
    autoCalculateTax: boolean;
    emailNotifications: boolean;
    complianceAlerts: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema: Schema = new Schema({
  businessId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  taxId: { type: String, required: true },
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' }
  },
  locations: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true, default: 'US' }
    },
    active: { type: Boolean, default: true }
  }],
  nexusStates: [{ type: String }],
  integrations: {
    pos: [{
      type: { 
        type: String, 
        enum: ['square', 'shopify', 'clover', 'toast'] 
      },
      enabled: { type: Boolean, default: false },
      credentials: { type: Schema.Types.Mixed },
      lastSync: Date
    }],
    accounting: [{
      type: { 
        type: String, 
        enum: ['quickbooks', 'xero', 'freshbooks'] 
      },
      enabled: { type: Boolean, default: false },
      credentials: { type: Schema.Types.Mixed },
      lastSync: Date
    }],
    taxProviders: [{
      type: { 
        type: String, 
        enum: ['avalara', 'taxjar'] 
      },
      enabled: { type: Boolean, default: false },
      credentials: { type: Schema.Types.Mixed },
      primary: { type: Boolean, default: false }
    }]
  },
  filingSchedule: [{
    state: { type: String, required: true },
    frequency: { 
      type: String, 
      required: true, 
      enum: ['monthly', 'quarterly', 'annually'] 
    },
    dueDay: { type: Number, required: true },
    lastFiled: Date,
    nextDue: Date
  }],
  settings: {
    autoSync: { type: Boolean, default: true },
    syncFrequency: { type: Number, default: 3600000 }, // 1 hour in ms
    autoCalculateTax: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    complianceAlerts: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

BusinessSchema.index({ businessId: 1 });
BusinessSchema.index({ nexusStates: 1 });

export default mongoose.model<IBusiness>('Business', BusinessSchema);