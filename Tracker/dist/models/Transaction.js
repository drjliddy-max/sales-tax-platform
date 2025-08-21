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
const TransactionSchema = new mongoose_1.Schema({
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
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} }
}, {
    timestamps: true
});
TransactionSchema.index({ businessId: 1, timestamp: -1 });
TransactionSchema.index({ source: 1, sourceTransactionId: 1 });
TransactionSchema.index({ 'address.state': 1, timestamp: -1 });
exports.default = mongoose_1.default.model('Transaction', TransactionSchema);
//# sourceMappingURL=Transaction.js.map