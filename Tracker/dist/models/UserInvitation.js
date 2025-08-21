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
const UserInvitationSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    businessId: {
        type: String,
        required: true,
        ref: 'Business',
        index: true
    },
    role: {
        type: String,
        required: true,
        enum: ['business_owner', 'accountant', 'bookkeeper', 'auditor', 'admin']
    },
    permissions: [{ type: String }],
    invitedBy: {
        type: String,
        required: true,
        ref: 'User'
    },
    invitationToken: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'accepted', 'expired', 'revoked'],
        default: 'pending',
        index: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    acceptedAt: Date,
    revokedAt: Date,
    revokedBy: {
        type: String,
        ref: 'User'
    },
    metadata: {
        ipAddress: String,
        userAgent: String,
        invitationMessage: String
    }
}, {
    timestamps: true
});
UserInvitationSchema.index({ businessId: 1, status: 1 });
UserInvitationSchema.index({ email: 1, businessId: 1 });
UserInvitationSchema.index({ invitationToken: 1, status: 1 });
UserInvitationSchema.index({ expiresAt: 1, status: 1 });
UserInvitationSchema.methods.isExpired = function () {
    return new Date() > this.expiresAt && this.status === 'pending';
};
UserInvitationSchema.methods.canBeAccepted = function () {
    return this.status === 'pending' && !this.isExpired();
};
UserInvitationSchema.methods.accept = function (acceptedBy) {
    if (!this.canBeAccepted()) {
        throw new Error('Invitation cannot be accepted');
    }
    this.status = 'accepted';
    this.acceptedAt = new Date();
    if (acceptedBy) {
        this.metadata.acceptedBy = acceptedBy;
    }
};
UserInvitationSchema.methods.revoke = function (revokedBy, reason) {
    if (this.status !== 'pending') {
        throw new Error('Only pending invitations can be revoked');
    }
    this.status = 'revoked';
    this.revokedAt = new Date();
    this.revokedBy = revokedBy;
    if (reason) {
        this.metadata.revocationReason = reason;
    }
};
UserInvitationSchema.pre('save', function () {
    if (this.isExpired && this.isExpired()) {
        this.status = 'expired';
    }
});
exports.default = mongoose_1.default.model('UserInvitation', UserInvitationSchema);
//# sourceMappingURL=UserInvitation.js.map