import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '@/services/auth/Auth0Service';

export interface IUser extends Document {
  auth0Id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  emailVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  businessAccesses: Array<{
    businessId: string;
    role: UserRole;
    permissions: string[];
    isActive: boolean;
    grantedAt: Date;
    grantedBy: string;
    revokedAt?: Date;
    revokedBy?: string;
  }>;
  preferences: {
    timezone?: string;
    currency?: string;
    language?: string;
    emailNotifications: boolean;
    securityAlerts: boolean;
  };
  securityMetadata: {
    lastPasswordChange?: Date;
    mfaEnabled: boolean;
    lastSecurityReview?: Date;
    failedLoginAttempts: number;
    lockedUntil?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
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

// Indexes for performance and security
UserSchema.index({ auth0Id: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ 'businessAccesses.businessId': 1 });
UserSchema.index({ 'businessAccesses.role': 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ lastLogin: 1 });

// Compound indexes for multi-tenant queries
UserSchema.index({ 'businessAccesses.businessId': 1, 'businessAccesses.isActive': 1 });
UserSchema.index({ auth0Id: 1, 'businessAccesses.businessId': 1 });

// Add instance methods to interface
declare module 'mongoose' {
  interface Document {
    hasBusinessAccess?(businessId: string): boolean;
    getBusinessRole?(businessId: string): UserRole | null;
    getBusinessPermissions?(businessId: string): string[];
    addBusinessAccess?(businessId: string, role: UserRole, permissions: string[], grantedBy: string): void;
    revokeBusinessAccess?(businessId: string, revokedBy: string): void;
  }
}

// Methods for user management
UserSchema.methods.hasBusinessAccess = function(businessId: string): boolean {
  return this.businessAccesses.some((access: any) => 
    access.businessId === businessId && access.isActive
  );
};

UserSchema.methods.getBusinessRole = function(businessId: string): UserRole | null {
  const access = this.businessAccesses.find((access: any) => 
    access.businessId === businessId && access.isActive
  );
  return access?.role || null;
};

UserSchema.methods.getBusinessPermissions = function(businessId: string): string[] {
  const access = this.businessAccesses.find((access: any) => 
    access.businessId === businessId && access.isActive
  );
  return access?.permissions || [];
};

UserSchema.methods.addBusinessAccess = function(
  businessId: string, 
  role: UserRole, 
  permissions: string[], 
  grantedBy: string
) {
  // Remove any existing access for this business
  this.businessAccesses = this.businessAccesses.filter((access: any) => 
    access.businessId !== businessId
  );
  
  // Add new access
  this.businessAccesses.push({
    businessId,
    role,
    permissions,
    isActive: true,
    grantedAt: new Date(),
    grantedBy
  });
};

UserSchema.methods.revokeBusinessAccess = function(businessId: string, revokedBy: string) {
  const access = this.businessAccesses.find((access: any) => 
    access.businessId === businessId && access.isActive
  );
  
  if (access) {
    access.isActive = false;
    access.revokedAt = new Date();
    access.revokedBy = revokedBy;
  }
};

export default mongoose.model<IUser>('User', UserSchema);