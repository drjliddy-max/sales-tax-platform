export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  timezone: string;
  currency: string;
  locale: string;
  plan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'trial' | 'inactive';
  settings: TenantSettings;
  billing: TenantBilling;
  limits: TenantLimits;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface TenantSettings {
  features: {
    advancedAnalytics: boolean;
    multiLocationSupport: boolean;
    apiAccess: boolean;
    customReporting: boolean;
    prioritySupport: boolean;
    ssoEnabled: boolean;
    auditLogging: boolean;
    dataRetentionYears: number;
  };
  integrations: {
    maxPOSConnections: number;
    allowedPOSTypes: string[];
    webhooksEnabled: boolean;
    thirdPartyIntegrations: string[];
  };
  compliance: {
    requireApprovalForReports: boolean;
    enableAuditTrail: boolean;
    dataResidencyRegion: string;
    encryptionLevel: 'standard' | 'enhanced';
  };
  branding: {
    allowCustomLogo: boolean;
    allowCustomColors: boolean;
    allowCustomDomain: boolean;
  };
}

export interface TenantBilling {
  customerId?: string;
  subscriptionId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  billingEmail: string;
  paymentMethod?: {
    type: string;
    last4?: string;
    brand?: string;
  };
  usage: {
    transactionsThisMonth: number;
    storageUsedMB: number;
    apiCallsThisMonth: number;
  };
}

export interface TenantLimits {
  maxUsers: number;
  maxBusinesses: number;
  maxTransactionsPerMonth: number;
  maxStorageMB: number;
  maxApiCallsPerMonth: number;
  maxPOSConnections: number;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantUserRole;
  permissions: string[];
  isActive: boolean;
  invitedAt?: string;
  joinedAt?: string;
  lastActiveAt?: string;
  invitedBy?: string;
}

export type TenantUserRole = 'owner' | 'admin' | 'manager' | 'user' | 'viewer';

export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantUserRole;
  permissions: string[];
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface TenantContext {
  tenant: Tenant | null;
  userRole: TenantUserRole | null;
  permissions: string[];
  isLoading: boolean;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
}

export interface CreateTenantRequest {
  name: string;
  slug?: string;
  plan: Tenant['plan'];
  timezone: string;
  currency: string;
  locale: string;
  ownerId: string;
  settings?: Partial<TenantSettings>;
}

export interface UpdateTenantRequest {
  name?: string;
  slug?: string;
  domain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  timezone?: string;
  currency?: string;
  locale?: string;
  settings?: Partial<TenantSettings>;
}

export interface TenantSwitchPayload {
  tenantId: string;
  userId: string;
}

export interface TenantApiResponse<T = any> {
  success: boolean;
  data?: T;
  tenant?: {
    id: string;
    name: string;
    plan: string;
  };
  error?: string;
  message?: string;
}

export interface UserTenantAccess {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantUserRole;
  permissions: string[];
  isActive: boolean;
  isPrimary: boolean;
}

export interface TenantPermissions {
  users: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    invite: boolean;
  };
  businesses: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  transactions: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    export: boolean;
  };
  reports: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    approve: boolean;
  };
  settings: {
    read: boolean;
    update: boolean;
    billing: boolean;
    integrations: boolean;
  };
  admin: {
    tenantManagement: boolean;
    userManagement: boolean;
    systemSettings: boolean;
    auditLogs: boolean;
  };
}

export const TENANT_PERMISSIONS: Record<TenantUserRole, TenantPermissions> = {
  owner: {
    users: { create: true, read: true, update: true, delete: true, invite: true },
    businesses: { create: true, read: true, update: true, delete: true },
    transactions: { create: true, read: true, update: true, delete: true, export: true },
    reports: { create: true, read: true, update: true, delete: true, approve: true },
    settings: { read: true, update: true, billing: true, integrations: true },
    admin: { tenantManagement: true, userManagement: true, systemSettings: true, auditLogs: true },
  },
  admin: {
    users: { create: true, read: true, update: true, delete: true, invite: true },
    businesses: { create: true, read: true, update: true, delete: true },
    transactions: { create: true, read: true, update: true, delete: true, export: true },
    reports: { create: true, read: true, update: true, delete: true, approve: true },
    settings: { read: true, update: true, billing: false, integrations: true },
    admin: { tenantManagement: false, userManagement: true, systemSettings: true, auditLogs: true },
  },
  manager: {
    users: { create: true, read: true, update: true, delete: false, invite: true },
    businesses: { create: true, read: true, update: true, delete: false },
    transactions: { create: true, read: true, update: true, delete: false, export: true },
    reports: { create: true, read: true, update: true, delete: false, approve: false },
    settings: { read: true, update: true, billing: false, integrations: false },
    admin: { tenantManagement: false, userManagement: false, systemSettings: false, auditLogs: true },
  },
  user: {
    users: { create: false, read: true, update: false, delete: false, invite: false },
    businesses: { create: false, read: true, update: false, delete: false },
    transactions: { create: true, read: true, update: true, delete: false, export: true },
    reports: { create: true, read: true, update: false, delete: false, approve: false },
    settings: { read: true, update: false, billing: false, integrations: false },
    admin: { tenantManagement: false, userManagement: false, systemSettings: false, auditLogs: false },
  },
  viewer: {
    users: { create: false, read: true, update: false, delete: false, invite: false },
    businesses: { create: false, read: true, update: false, delete: false },
    transactions: { create: false, read: true, update: false, delete: false, export: false },
    reports: { create: false, read: true, update: false, delete: false, approve: false },
    settings: { read: true, update: false, billing: false, integrations: false },
    admin: { tenantManagement: false, userManagement: false, systemSettings: false, auditLogs: false },
  },
};

export interface TenantAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}