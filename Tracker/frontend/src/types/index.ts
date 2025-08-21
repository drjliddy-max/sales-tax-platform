export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  taxId?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  businessType: string;
  nexusStates: string[];
  isActive: boolean;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
}

export interface Transaction {
  id: string;
  externalId?: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  description?: string;
  productCategory?: string;
  customerType: string;
  isExempt: boolean;
  exemptionReason?: string;
  saleLocation: string;
  customerLocation?: string;
  status: string;
  paymentMethod?: string;
  posSource?: string;
  transactionDate: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  businessId: string;
  userId?: string;
}

export interface TaxRate {
  id: string;
  jurisdiction: string;
  jurisdictionCode: string;
  taxType: string;
  rate: number;
  productCategories: string[];
  effectiveDate: string;
  expirationDate?: string;
  isActive: boolean;
  description?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  businessId?: string;
}

export interface Insight {
  id: string;
  title: string;
  insight: string;
  impact: 'high' | 'medium' | 'low';
  confidence_score: number;
  estimated_revenue_impact?: number;
  estimated_savings?: number;
  actionable_steps?: string[];
  tenantId: string;
  createdAt: string;
}

export interface Report {
  id: string;
  name: string;
  type: string;
  period: string;
  startDate: string;
  endDate: string;
  status: string;
  fileUrl?: string;
  fileFormat?: string;
  totalTransactions?: number;
  totalAmount?: number;
  totalTax?: number;
  generatedAt?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  businessId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type UserRole = 'business_owner' | 'accountant' | 'bookkeeper' | 'auditor' | 'admin';

export interface AuthUser {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified: boolean;
}

// Help System Types
export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: HelpCategory;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lastUpdated: string;
  views: number;
  helpful: number;
  notHelpful: number;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: HelpCategory;
  tags: string[];
  priority: number;
}

export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  context?: {
    page?: string;
    userRole?: string;
    additionalInfo?: Record<string, any>;
  };
}

export interface HelpContext {
  page: string;
  userRole?: string;
  suggestedArticles: HelpArticle[];
  commonIssues: FAQ[];
  quickActions: QuickAction[];
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  action: () => void;
  icon: string;
}

// Re-export tenant types for convenience
export type {
  Tenant,
  TenantUser,
  TenantContext,
  TenantUserRole,
  TenantSettings,
  TenantBilling,
  TenantLimits,
  TenantInvitation,
  UserTenantAccess,
  TenantPermissions,
  CreateTenantRequest,
  UpdateTenantRequest,
  TenantApiResponse,
  TenantAuditLog
} from './tenant';
