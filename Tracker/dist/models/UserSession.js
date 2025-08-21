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
const UserSessionSchema = new mongoose_1.Schema({
    userId: {
        type: String,
        required: true,
        ref: 'User',
        index: true
    },
    businessId: {
        type: String,
        ref: 'Business',
        index: true
    },
    sessionToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    auth0SessionId: String,
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    loginTime: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastActivity: {
        type: Date,
        default: Date.now,
        index: true
    },
    logoutTime: Date,
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    securityFlags: {
        isSuspicious: { type: Boolean, default: false },
        riskScore: { type: Number, default: 0, min: 0, max: 100 },
        geoLocation: {
            country: String,
            region: String,
            city: String
        },
        deviceFingerprint: String,
        multipleActiveDevices: { type: Boolean, default: false }
    },
    metadata: {
        loginMethod: {
            type: String,
            enum: ['password', 'social', 'sso', 'mfa']
        },
        browser: String,
        platform: String,
        referrer: String
    }
}, {
    timestamps: true
});
UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ businessId: 1, isActive: 1 });
UserSessionSchema.index({ sessionToken: 1, isActive: 1 });
UserSessionSchema.index({ expiresAt: 1, isActive: 1 });
UserSessionSchema.index({ ipAddress: 1, loginTime: -1 });
UserSessionSchema.index({ 'securityFlags.isSuspicious': 1, loginTime: -1 });
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
UserSessionSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt;
};
UserSessionSchema.methods.updateActivity = function () {
    this.lastActivity = new Date();
    return this.save();
};
UserSessionSchema.methods.logout = function () {
    this.isActive = false;
    this.logoutTime = new Date();
    return this.save();
};
UserSessionSchema.methods.markSuspicious = function (riskScore = 75) {
    this.securityFlags.isSuspicious = true;
    this.securityFlags.riskScore = Math.max(this.securityFlags.riskScore, riskScore);
    return this.save();
};
UserSessionSchema.statics.findActiveSessions = function (userId) {
    return this.find({
        userId,
        isActive: true,
        expiresAt: { $gt: new Date() }
    }).sort({ lastActivity: -1 });
};
UserSessionSchema.statics.findSuspiciousSessions = function (businessId) {
    const query = {
        'securityFlags.isSuspicious': true,
        isActive: true
    };
    if (businessId) {
        query.businessId = businessId;
    }
    return this.find(query)
        .sort({ loginTime: -1 })
        .populate('userId', 'email name')
        .populate('businessId', 'name');
};
UserSessionSchema.statics.cleanupExpiredSessions = function () {
    return this.updateMany({
        isActive: true,
        expiresAt: { $lt: new Date() }
    }, {
        isActive: false,
        logoutTime: new Date()
    });
};
exports.default = mongoose_1.default.model('UserSession', UserSessionSchema);
//# sourceMappingURL=UserSession.js.map