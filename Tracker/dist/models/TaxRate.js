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
const TaxRateSchema = new mongoose_1.Schema({
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
exports.default = mongoose_1.default.model('TaxRate', TaxRateSchema);
//# sourceMappingURL=TaxRate.js.map