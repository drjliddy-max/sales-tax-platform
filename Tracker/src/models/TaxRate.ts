import mongoose, { Schema, Document } from 'mongoose';

export interface ITaxRate extends Document {
  jurisdiction: string;
  jurisdictionType: 'federal' | 'state' | 'county' | 'city' | 'special';
  state: string;
  county?: string;
  city?: string;
  zipCode?: string;
  rate: number;
  productCategories: Array<{
    category: string;
    rate: number;
    exempt: boolean;
  }>;
  effectiveDate: Date;
  expirationDate?: Date;
  source: 'avalara' | 'taxjar' | 'manual';
  lastUpdated: Date;
  active: boolean;
}

const TaxRateSchema: Schema = new Schema({
  jurisdiction: { type: String, required: true },
  jurisdictionType: { 
    type: String, 
    required: true, 
    enum: ['federal', 'state', 'county', 'city', 'special'] 
  },
  state: { type: String, required: true },
  county: String,
  city: String,
  zipCode: String,
  rate: { type: Number, required: true },
  productCategories: [{
    category: { type: String, required: true },
    rate: { type: Number, required: true },
    exempt: { type: Boolean, default: false }
  }],
  effectiveDate: { type: Date, required: true },
  expirationDate: Date,
  source: { 
    type: String, 
    required: true, 
    enum: ['avalara', 'taxjar', 'manual'] 
  },
  lastUpdated: { type: Date, default: Date.now },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

TaxRateSchema.index({ state: 1, county: 1, city: 1, zipCode: 1 });
TaxRateSchema.index({ effectiveDate: -1, expirationDate: 1 });

export default mongoose.model<ITaxRate>('TaxRate', TaxRateSchema);