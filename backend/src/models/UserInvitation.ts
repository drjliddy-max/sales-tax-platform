import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '@/services/auth/Auth0Service';

export interface IUserInvitation extends Document {
  email: string;
  businessId: string;
  role: UserRole;
  permissions: string[];
  invitedBy: string;
  invitationToken: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  revokedBy?: string;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    invitationMessage?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserInvitationSchema: Schema = new Schema({
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

// Compound indexes for efficient queries
UserInvitationSchema.index({ businessId: 1, status: 1 });
UserInvitationSchema.index({ email: 1, businessId: 1 });
UserInvitationSchema.index({ invitationToken: 1, status: 1 });
UserInvitationSchema.index({ expiresAt: 1, status: 1 });

// Add instance methods to interface
declare module 'mongoose' {
  interface Document {
    isExpired?(): boolean;
    canBeAccepted?(): boolean;
    accept?(acceptedBy?: string): void;
    revoke?(revokedBy: string, reason?: string): void;
  }
}

// Methods for invitation management
UserInvitationSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt && this.status === 'pending';
};

UserInvitationSchema.methods.canBeAccepted = function(): boolean {
  return this.status === 'pending' && !this.isExpired();
};

UserInvitationSchema.methods.accept = function(acceptedBy?: string) {
  if (!this.canBeAccepted()) {
    throw new Error('Invitation cannot be accepted');
  }
  
  this.status = 'accepted';
  this.acceptedAt = new Date();
  
  if (acceptedBy) {
    (this.metadata as any).acceptedBy = acceptedBy;
  }
};

UserInvitationSchema.methods.revoke = function(revokedBy: string, reason?: string) {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be revoked');
  }
  
  this.status = 'revoked';
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  
  if (reason) {
    (this.metadata as any).revocationReason = reason;
  }
};

// Auto-expire old invitations
UserInvitationSchema.pre('save', function() {
  if (this.isExpired && this.isExpired()) {
    this.status = 'expired';
  }
});

export default mongoose.model<IUserInvitation>('UserInvitation', UserInvitationSchema);