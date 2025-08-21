import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<ITaxRate, {}, {}, {}, mongoose.Document<unknown, {}, ITaxRate> & ITaxRate & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
//# sourceMappingURL=TaxRate.d.ts.map