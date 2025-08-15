import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transactionId: string;
  source: 'square' | 'shopify' | 'clover' | 'toast' | 'manual';
  sourceTransactionId: string;
  businessId: string;
  locationId: string;
  timestamp: Date;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  currency: string;
  customer?: {
    id?: string;
    email?: string;
    taxExempt: boolean;
    exemptionCertificate?: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taxCategory: string;
    taxable: boolean;
  }>;
  taxBreakdown: Array<{
    jurisdiction: string;
    jurisdictionType: 'federal' | 'state' | 'county' | 'city' | 'special';
    rate: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  refundedAmount?: number;
  status: 'completed' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema({
  transactionId: { type: String, required: true, unique: true },
  source: { 
    type: String, 
    required: true, 
    enum: ['square', 'shopify', 'clover', 'toast', 'manual'] 
  },
  sourceTransactionId: { type: String, required: true },
  businessId: { type: String, required: true },
  locationId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  subtotal: { type: Number, required: true },
  totalTax: { type: Number, required: true },
  grandTotal: { type: Number, required: true },
  currency: { type: String, required: true, default: 'USD' },
  customer: {
    id: String,
    email: String,
    taxExempt: { type: Boolean, default: false },
    exemptionCertificate: String
  },
  items: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    taxCategory: { type: String, required: true },
    taxable: { type: Boolean, required: true }
  }],
  taxBreakdown: [{
    jurisdiction: { type: String, required: true },
    jurisdictionType: { 
      type: String, 
      required: true, 
      enum: ['federal', 'state', 'county', 'city', 'special'] 
    },
    rate: { type: Number, required: true },
    taxableAmount: { type: Number, required: true },
    taxAmount: { type: Number, required: true }
  }],
  address: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'US' }
  },
  refundedAmount: Number,
  status: { 
    type: String, 
    required: true, 
    enum: ['completed', 'pending', 'failed', 'refunded', 'partially_refunded'],
    default: 'completed'
  },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

TransactionSchema.index({ businessId: 1, timestamp: -1 });
TransactionSchema.index({ source: 1, sourceTransactionId: 1 });
TransactionSchema.index({ 'address.state': 1, timestamp: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);