import mongoose, { Document } from 'mongoose';
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
declare const _default: mongoose.Model<IBusiness, {}, {}, {}, mongoose.Document<unknown, {}, IBusiness> & IBusiness & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default _default;
//# sourceMappingURL=Business.d.ts.map