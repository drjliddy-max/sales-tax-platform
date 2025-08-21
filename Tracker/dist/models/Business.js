"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const BusinessSchema = new mongoose_1.Schema({
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
                credentials: { type: mongoose_1.Schema.Types.Mixed },
                lastSync: Date
            }],
        accounting: [{
                type: {
                    type: String,
                    enum: ['quickbooks', 'xero', 'freshbooks']
                },
                enabled: { type: Boolean, default: false },
                credentials: { type: mongoose_1.Schema.Types.Mixed },
                lastSync: Date
            }],
        taxProviders: [{
                type: {
                    type: String,
                    enum: ['avalara', 'taxjar']
                },
                enabled: { type: Boolean, default: false },
                credentials: { type: mongoose_1.Schema.Types.Mixed },
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
        syncFrequency: { type: Number, default: 3600000 },
        autoCalculateTax: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        complianceAlerts: { type: Boolean, default: true }
    }
}, {
    timestamps: true
});
BusinessSchema.index({ businessId: 1 });
BusinessSchema.index({ nexusStates: 1 });
exports.default = mongoose_1.default.model('Business', BusinessSchema);
//# sourceMappingURL=Business.js.map