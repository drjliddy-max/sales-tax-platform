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
exports.AutomationLog = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const automationLogSchema = new mongoose_1.Schema({
    business_id: {
        type: String,
        required: true,
        index: true
    },
    automation_type: {
        type: String,
        required: true,
        enum: ['setup', 'compliance', 'monitoring', 'optimization'],
        index: true
    },
    event_type: {
        type: String,
        required: true,
        index: true
    },
    input_data: {
        type: mongoose_1.Schema.Types.Mixed,
        required: true
    },
    output_data: {
        type: mongoose_1.Schema.Types.Mixed
    },
    confidence_score: {
        type: Number,
        min: 0,
        max: 1
    },
    automation_level: {
        type: String,
        required: true,
        enum: ['full', 'assisted', 'manual']
    },
    success: {
        type: Boolean,
        required: true,
        index: true
    },
    error_message: {
        type: String
    },
    processing_time_ms: {
        type: Number,
        min: 0
    },
    triggered_by: {
        type: String,
        required: true,
        enum: ['system', 'schedule', 'user', 'api']
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    correlation_id: {
        type: String,
        index: true
    }
});
automationLogSchema.index({ business_id: 1, automation_type: 1, timestamp: -1 });
automationLogSchema.index({ success: 1, timestamp: -1 });
automationLogSchema.index({ event_type: 1, timestamp: -1 });
automationLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });
exports.AutomationLog = mongoose_1.default.model('AutomationLog', automationLogSchema);
//# sourceMappingURL=AutomationLog.js.map