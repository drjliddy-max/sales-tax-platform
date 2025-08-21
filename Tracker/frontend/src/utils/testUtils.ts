import React from 'react';
import { Tenant, TenantUserRole } from '@/types/tenant';

/**
 * ⚠️  DATA INTEGRITY POLICY WARNING ⚠️
 * 
 * This file contains mock data for TESTING PURPOSES ONLY.
 * Under the application's Data Integrity Policy:
 * 
 * ✅ ALLOWED: Use in test environments, unit tests, and development testing
 * ❌ PROHIBITED: Use in production, user-facing components, or live data displays
 * 
 * All production data must come from verified, real sources only.
 */

// Ensure this file is not used in production
if (process.env.NODE_ENV === 'production') {
  throw new Error('VIOLATION: Mock data utilities cannot be used in production environment');
}

export const mockTenant: Tenant = {
  id: 'test-tenant-1',
  name: 'Test Organization',
  slug: 'test-org',
  timezone: 'UTC',
  currency: 'USD',
  locale: 'en-US',
  plan: 'professional',
  status: 'active',
  settings: {
    features: {
      advancedAnalytics: true,
      multiLocationSupport: true,
      apiAccess: true,
      customReporting: true,
      prioritySupport: false,
      ssoEnabled: false,
      auditLogging: true,
      dataRetentionYears: 7,
    },
    integrations: {
      maxPOSConnections: 10,
      allowedPOSTypes: ['square', 'shopify', 'clover'],
      webhooksEnabled: true,
      thirdPartyIntegrations: [],
    },
    compliance: {
      requireApprovalForReports: false,
      enableAuditTrail: true,
      dataResidencyRegion: 'us',
      encryptionLevel: 'standard',
    },
    branding: {
      allowCustomLogo: true,
      allowCustomColors: true,
      allowCustomDomain: false,
    },
  },
  billing: {
    currentPeriodStart: new Date().toISOString(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    billingEmail: 'billing@test.com',
    usage: {
      transactionsThisMonth: 150,
      storageUsedMB: 45,
      apiCallsThisMonth: 2500,
    },
  },
  limits: {
    maxUsers: 50,
    maxBusinesses: 10,
    maxTransactionsPerMonth: 10000,
    maxStorageMB: 1000,
    maxApiCallsPerMonth: 50000,
    maxPOSConnections: 10,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ownerId: 'test-owner-1',
};

export const mockTenantContext = {
  tenant: mockTenant,
  userRole: 'admin' as TenantUserRole,
  permissions: [
    'businesses.read',
    'businesses.create',
    'businesses.update',
    'transactions.read',
    'transactions.create',
    'reports.read',
    'reports.create',
    'settings.read',
    'settings.update',
  ],
  isLoading: false,
  switchTenant: jest.fn(),
  refreshTenant: jest.fn(),
};

export interface TenantTestContext {
  tenant: Tenant;
  userRole: TenantUserRole;
  permissions: string[];
  isLoading: boolean;
  switchTenant: () => Promise<void>;
  refreshTenant: () => Promise<void>;
}

export function createMockTenantContext(
  tenant: Partial<Tenant> = {},
  userRole: TenantUserRole = 'admin',
  permissions: string[] = mockTenantContext.permissions
): TenantTestContext {
  return {
    tenant: { ...mockTenant, ...tenant },
    userRole,
    permissions,
    isLoading: false,
    switchTenant: jest.fn().mockResolvedValue(undefined),
    refreshTenant: jest.fn().mockResolvedValue(undefined),
  };
}

export const mockMultipleTenants = [
  mockTenant,
  {
    ...mockTenant,
    id: 'test-tenant-2',
    name: 'Another Organization',
    slug: 'another-org',
    plan: 'starter' as const,
  },
  {
    ...mockTenant,
    id: 'test-tenant-3',
    name: 'Enterprise Client',
    slug: 'enterprise-client',
    plan: 'enterprise' as const,
    status: 'trial' as const,
  },
];

export function createMockBusiness(tenantId: string = mockTenant.id) {
  return {
    id: 'test-business-1',
    name: 'Test Business',
    taxId: '12-3456789',
    address: '123 Main St',
    city: 'Anytown',
    state: 'CA',
    zipCode: '12345',
    country: 'US',
    businessType: 'retail',
    nexusStates: ['CA', 'NY'],
    isActive: true,
    tenantId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerId: 'test-user-1',
  };
}

export function createMockTransaction(tenantId: string = mockTenant.id, businessId: string = 'test-business-1') {
  return {
    id: 'test-transaction-1',
    amount: 100.00,
    taxAmount: 8.75,
    totalAmount: 108.75,
    currency: 'USD',
    description: 'Test transaction',
    productCategory: 'general',
    customerType: 'individual',
    isExempt: false,
    saleLocation: 'CA',
    status: 'completed',
    transactionDate: new Date().toISOString(),
    tenantId,
    businessId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function createMockPOSConnection(tenantId: string = mockTenant.id) {
  return {
    id: 'test-pos-connection-1',
    posType: 'square',
    posName: 'Square POS',
    tenantId,
    status: 'connected' as const,
    lastSync: new Date(),
    locationsCount: 2,
    todaysSales: 1250.00,
    todaysTax: 109.38,
    metrics: {
      uptime: 99.8,
      totalTransactions: 1547,
      averageResponseTime: 245,
    },
  };
}

export function setupMockLocalStorage() {
  const store: Record<string, string> = {};
  
  const mockLocalStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
  });

  return mockLocalStorage;
}

export function mockApiResponse<T>(data: T, success: boolean = true) {
  return {
    success,
    data,
    message: success ? 'Success' : 'Error',
  };
}

export function mockTenantApiResponse<T>(data: T, tenant = mockTenant, success: boolean = true) {
  return {
    success,
    data,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
    },
    message: success ? 'Success' : 'Error',
  };
}