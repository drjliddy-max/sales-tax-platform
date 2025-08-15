import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSession extends Document {
  userId: string;
  businessId?: string;
  sessionToken: string;
  auth0SessionId?: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  loginTime: Date;
  lastActivity: Date;
  logoutTime?: Date;
  expiresAt: Date;
  securityFlags: {
    isSuspicious: boolean;
    riskScore: number;
    geoLocation?: {
      country?: string;
      region?: string;
      city?: string;
    };
    deviceFingerprint?: string;
    multipleActiveDevices?: boolean;
  };
  metadata: {
    loginMethod?: 'password' | 'social' | 'sso' | 'mfa';
    browser?: string;
    platform?: string;
    referrer?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema: Schema = new Schema({
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

// Compound indexes for security and performance
UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ businessId: 1, isActive: 1 });
UserSessionSchema.index({ sessionToken: 1, isActive: 1 });
UserSessionSchema.index({ expiresAt: 1, isActive: 1 });
UserSessionSchema.index({ ipAddress: 1, loginTime: -1 });
UserSessionSchema.index({ 'securityFlags.isSuspicious': 1, loginTime: -1 });

// TTL index for automatic cleanup of expired sessions
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods for session management
UserSessionSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt;
};

UserSessionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

UserSessionSchema.methods.logout = function() {
  this.isActive = false;
  this.logoutTime = new Date();
  return this.save();
};

UserSessionSchema.methods.markSuspicious = function(riskScore: number = 75) {
  this.securityFlags.isSuspicious = true;
  this.securityFlags.riskScore = Math.max(this.securityFlags.riskScore, riskScore);
  return this.save();
};

// Static methods for session querying
UserSessionSchema.statics.findActiveSessions = function(userId: string) {
  return this.find({
    userId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).sort({ lastActivity: -1 });
};

UserSessionSchema.statics.findSuspiciousSessions = function(businessId?: string) {
  const query: any = {
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

UserSessionSchema.statics.cleanupExpiredSessions = function() {
  return this.updateMany(
    {
      isActive: true,
      expiresAt: { $lt: new Date() }
    },
    {
      isActive: false,
      logoutTime: new Date()
    }
  );
};

export default mongoose.model<IUserSession>('UserSession', UserSessionSchema);