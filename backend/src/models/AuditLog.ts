import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '@/services/auth/Auth0Service';

export interface IAuditLog extends Document {
  entityType: 'transaction' | 'tax_rate' | 'business' | 'filing' | 'user' | 'integration';
  entityId: string;
  action: 'created' | 'updated' | 'deleted' | 'accessed' | 'exported' | 'imported';
  userId: string;
  businessId: string;
  userRole: UserRole;
  userPermissions: string[];
  changes: {
    before?: Record<string, any>;
    after?: Record<string, any>;
    fieldChanges?: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    requestId?: string;
    sessionId?: string;
    jurisdiction?: string;
    operationType?: string;
    complianceFlags?: string[];
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  compliance: {
    isComplianceRelevant: boolean;
    regulatoryCategory?: 'tax_calculation' | 'user_management' | 'data_retention' | 'financial_reporting';
    retentionRequiredUntil?: Date;
    jurisdictions?: string[];
  };
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema: Schema = new Schema({
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
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    fieldChanges: [{
      field: { type: String, required: true },
      oldValue: { type: Schema.Types.Mixed },
      newValue: { type: Schema.Types.Mixed }
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

// Compound indexes for efficient audit queries
AuditLogSchema.index({ businessId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ severity: 1, timestamp: -1 });
AuditLogSchema.index({ 'compliance.isComplianceRelevant': 1, timestamp: -1 });
AuditLogSchema.index({ 'compliance.regulatoryCategory': 1, timestamp: -1 });

// TTL index for automatic cleanup (optional - keep logs for 7 years for compliance)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 });

// Static methods for audit querying
AuditLogSchema.statics.findByBusiness = function(businessId: string, limit: number = 100) {
  return this.find({ businessId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'email name');
};

AuditLogSchema.statics.findByUser = function(userId: string, limit: number = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('businessId', 'name');
};

AuditLogSchema.statics.findComplianceEvents = function(
  businessId: string, 
  startDate: Date, 
  endDate: Date
) {
  return this.find({
    businessId,
    'compliance.isComplianceRelevant': true,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort({ timestamp: -1 });
};

AuditLogSchema.statics.findSecurityEvents = function(
  businessId: string, 
  severity: 'high' | 'critical' = 'high'
) {
  return this.find({
    businessId,
    severity: { $in: severity === 'high' ? ['high', 'critical'] : ['critical'] },
    timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  }).sort({ timestamp: -1 });
};

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);