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
exports.ScheduledReport = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const scheduledReportSchema = new mongoose_1.Schema({
    templateId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ReportTemplate',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    frequency: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly', 'quarterly']
    },
    deliveryMethod: {
        type: String,
        required: true,
        enum: ['email', 'slack', 'webhook']
    },
    recipients: {
        type: [String],
        required: true,
        validate: {
            validator: function (v) {
                return v && v.length > 0;
            },
            message: 'At least one recipient is required'
        }
    },
    filters: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    nextRunDate: {
        type: Date,
        index: true
    },
    lastRunDate: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: false
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
scheduledReportSchema.index({ nextRunDate: 1, isActive: 1 });
scheduledReportSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    if (!this.nextRunDate && this.isActive) {
        this.nextRunDate = this.calculateNextRunDate();
    }
    next();
});
scheduledReportSchema.methods.calculateNextRunDate = function () {
    const now = new Date();
    const nextRun = new Date(now);
    switch (this.frequency) {
        case 'daily':
            nextRun.setDate(now.getDate() + 1);
            break;
        case 'weekly':
            nextRun.setDate(now.getDate() + 7);
            break;
        case 'monthly':
            nextRun.setMonth(now.getMonth() + 1);
            break;
        case 'quarterly':
            nextRun.setMonth(now.getMonth() + 3);
            break;
    }
    return nextRun;
};
exports.ScheduledReport = mongoose_1.default.model('ScheduledReport', scheduledReportSchema);
//# sourceMappingURL=ScheduledReport.js.map