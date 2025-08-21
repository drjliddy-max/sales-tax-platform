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
const AuditLogSchema = new mongoose_1.Schema({
    entityType: {
        type: String,
        required: true,
        enum: ['transaction', 'tax_rate', 'business', 'filing', 'user', 'integration'],
        index: true
    },
    entityId: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: ['created', 'updated', 'deleted', 'accessed', 'exported', 'imported'],
        index: true
    },
    userId: {
        type: String,
        required: true,
        ref: 'User',
        index: true
    },
    businessId: {
        type: String,
        required: true,
        ref: 'Business',
        index: true
    },
    userRole: {
        type: String,
        required: true,
        enum: ['business_owner', 'accountant', 'bookkeeper', 'auditor', 'admin']
    },
    userPermissions: [{ type: String }],
    changes: {
        before: { type: mongoose_1.Schema.Types.Mixed },
        after: { type: mongoose_1.Schema.Types.Mixed },
        fieldChanges: [{
                field: { type: String, required: true },
                oldValue: { type: mongoose_1.Schema.Types.Mixed },
                newValue: { type: mongoose_1.Schema.Types.Mixed }
            }]
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        endpoint: String,
        method: String,
        requestId: String,
        sessionId: String,
        jurisdiction: String,
        operationType: String,
        complianceFlags: [{ type: String }]
    },
    severity: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
        index: true
    },
    compliance: {
        isComplianceRelevant: { type: Boolean, default: false },
        regulatoryCategory: {
            type: String,
            enum: ['tax_calculation', 'user_management', 'data_retention', 'financial_reporting']
        },
        retentionRequiredUntil: Date,
        jurisdictions: [{ type: String }]
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});
AuditLogSchema.index({ businessId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ 'compliance.isComplianceRelevant': 1, timestamp: -1 });
AuditLogSchema.index({ 'compliance.regulatoryCategory': 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 });
AuditLogSchema.statics.findByBusiness = function (businessId, limit = 100) {
    return this.find({ businessId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'email name');
};
AuditLogSchema.statics.findByUser = function (userId, limit = 100) {
    return this.find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('businessId', 'name');
};
AuditLogSchema.statics.findComplianceEvents = function (businessId, startDate, endDate) {
    return this.find({
        businessId,
        'compliance.isComplianceRelevant': true,
        timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });
};
AuditLogSchema.statics.findSecurityEvents = function (businessId, severity = 'high') {
    return this.find({
        businessId,
        severity: { $in: severity === 'high' ? ['high', 'critical'] : ['critical'] },
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).sort({ timestamp: -1 });
};
exports.default = mongoose_1.default.model('AuditLog', AuditLogSchema);
//# sourceMappingURL=AuditLog.js.map