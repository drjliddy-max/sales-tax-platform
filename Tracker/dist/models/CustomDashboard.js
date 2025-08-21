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
exports.CustomDashboard = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const customDashboardSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    layoutConfig: {
        widgets: [{
                id: { type: String, required: true },
                type: { type: String, required: true },
                position: {
                    x: { type: Number, required: true },
                    y: { type: Number, required: true }
                },
                size: {
                    width: { type: Number, required: true },
                    height: { type: Number, required: true }
                },
                config: {
                    type: mongoose_1.Schema.Types.Mixed,
                    default: {}
                }
            }],
        layout: {
            type: mongoose_1.Schema.Types.Mixed,
            default: {}
        }
    },
    filters: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    isShared: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});
customDashboardSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
exports.CustomDashboard = mongoose_1.default.model('CustomDashboard', customDashboardSchema);
//# sourceMappingURL=CustomDashboard.js.map