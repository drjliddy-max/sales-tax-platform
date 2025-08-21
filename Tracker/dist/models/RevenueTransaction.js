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
exports.RevenueTransaction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RevenueTransactionSchema = new mongoose_1.Schema({
    clientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    revenueStreamId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'RevenueStream',
        required: true
    },
    subscriptionId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ClientSubscription'
    },
    transactionDate: {
        type: Date,
        default: Date.now
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD',
        maxlength: 3
    },
    taxAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    netAmount: {
        type: Number,
        required: true,
        min: 0
    },
    billingPeriodStart: {
        type: Date
    },
    billingPeriodEnd: {
        type: Date
    },
    paymentMethod: {
        type: String,
        maxlength: 50
    },
    status: {
        type: String,
        default: 'completed',
        enum: ['pending', 'completed', 'failed', 'refunded']
    },
    description: {
        type: String
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});
RevenueTransactionSchema.index({ clientId: 1 });
RevenueTransactionSchema.index({ transactionDate: -1 });
RevenueTransactionSchema.index({ revenueStreamId: 1 });
RevenueTransactionSchema.index({ status: 1 });
RevenueTransactionSchema.index({ subscriptionId: 1 });
exports.RevenueTransaction = mongoose_1.default.model('RevenueTransaction', RevenueTransactionSchema);
//# sourceMappingURL=RevenueTransaction.js.map