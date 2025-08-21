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
const UserSchema = new mongoose_1.Schema({
    auth0Id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        index: true
    },
    name: String,
    firstName: String,
    lastName: String,
    phoneNumber: String,
    profilePicture: String,
    emailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    businessAccesses: [{
            businessId: {
                type: String,
                required: true,
                ref: 'Business'
            },
            role: {
                type: String,
                required: true,
                enum: ['business_owner', 'accountant', 'bookkeeper', 'auditor', 'admin']
            },
            permissions: [{ type: String }],
            isActive: { type: Boolean, default: true },
            grantedAt: { type: Date, default: Date.now },
            grantedBy: {
                type: String,
                required: true,
                ref: 'User'
            },
            revokedAt: Date,
            revokedBy: {
                type: String,
                ref: 'User'
            }
        }],
    preferences: {
        timezone: { type: String, default: 'UTC' },
        currency: { type: String, default: 'USD' },
        language: { type: String, default: 'en' },
        emailNotifications: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true }
    },
    securityMetadata: {
        lastPasswordChange: Date,
        mfaEnabled: { type: Boolean, default: false },
        lastSecurityReview: Date,
        failedLoginAttempts: { type: Number, default: 0 },
        lockedUntil: Date
    }
}, {
    timestamps: true
});
UserSchema.index({ auth0Id: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ 'businessAccesses.businessId': 1 });
UserSchema.index({ 'businessAccesses.role': 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ lastLogin: 1 });
UserSchema.index({ 'businessAccesses.businessId': 1, 'businessAccesses.isActive': 1 });
UserSchema.index({ auth0Id: 1, 'businessAccesses.businessId': 1 });
UserSchema.methods.hasBusinessAccess = function (businessId) {
    return this.businessAccesses.some((access) => access.businessId === businessId && access.isActive);
};
UserSchema.methods.getBusinessRole = function (businessId) {
    const access = this.businessAccesses.find((access) => access.businessId === businessId && access.isActive);
    return access?.role || null;
};
UserSchema.methods.getBusinessPermissions = function (businessId) {
    const access = this.businessAccesses.find((access) => access.businessId === businessId && access.isActive);
    return access?.permissions || [];
};
UserSchema.methods.addBusinessAccess = function (businessId, role, permissions, grantedBy) {
    this.businessAccesses = this.businessAccesses.filter((access) => access.businessId !== businessId);
    this.businessAccesses.push({
        businessId,
        role,
        permissions,
        isActive: true,
        grantedAt: new Date(),
        grantedBy
    });
};
UserSchema.methods.revokeBusinessAccess = function (businessId, revokedBy) {
    const access = this.businessAccesses.find((access) => access.businessId === businessId && access.isActive);
    if (access) {
        access.isActive = false;
        access.revokedAt = new Date();
        access.revokedBy = revokedBy;
    }
};
exports.default = mongoose_1.default.model('User', UserSchema);
//# sourceMappingURL=User.js.map