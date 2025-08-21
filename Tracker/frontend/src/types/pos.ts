/**
 * POS Integration Type Definitions
 * Complete type definitions for POS integration system
 */

// Base POS System types
export interface POSSystem {
  id: string;
  name: string;
  description: string;
  category: 'popular' | 'restaurant' | 'retail' | 'enterprise' | 'mobile' | 'specialty';
  marketShare?: 'high' | 'medium' | 'low';
  logo?: string;
  website?: string;
  supportedRegions?: string[];
  pricing?: 'free' | 'paid' | 'freemium' | 'enterprise';
  verified: boolean;
  status: 'active' | 'inactive' | 'pending' | 'deprecated';
  clientContributed: boolean;
  contributedBy?: string;
  lastUpdated: string;
  usageStats: {
    clientsUsing: number;
    activeConnections: number;
    monthlyTransactions?: number;
  };
  authMethod?: 'oauth' | 'api_key' | 'manual';
  features?: string[];
  marketFocus?: string;
  hasConfiguration?: boolean;
}

// POS Discovery and Registry
export interface POSDiscoveryResponse {
  success: boolean;
  systems?: POSSystem[];
  categories?: Record<string, POSSystem[]>;
  results?: POSSystem[];
  error?: string;
}

export interface POSRegistryStats {
  totalSystems: number;
  verifiedSystems: number;
  clientContributedSystems: number;
  totalPlugins: number;
  categories: string[];
  totalActiveConnections: number;
  totalClients: number;
}

// POS Connection Management
export interface POSConnection {
  id: string;
  posType: string;
  posName: string;
  tenantId: string;
  status: 'connected' | 'error' | 'warning' | 'disconnected';
  lastSync: Date | string;
  locationsCount: number;
  todaysSales: number;
  todaysTax: number;
  errorMessage?: string;
  warningMessage?: string;
  metrics: {
    uptime: number;
    totalTransactions: number;
    averageResponseTime: number;
  };
  configuration?: any;
  credentials?: Record<string, string>;
}

// POS Onboarding Flow
export interface OnboardingProgress {
  step: number;
  totalSteps: number;
  currentStep: string;
  completedSteps: string[];
}

export interface OnboardingSession {
  sessionId: string;
  status: 'initiated' | 'authenticating' | 'configuring' | 'testing' | 'completed' | 'failed';
  progress: OnboardingProgress;
  error?: string;
}

export interface LocationInfo {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface OnboardingResult {
  success: boolean;
  sessionId?: string;
  status: string;
  progress: OnboardingProgress;
  configuration?: any;
  locations?: LocationInfo[];
  sampleData?: any[];
  nextAction?: {
    type: 'oauth_redirect' | 'manual_credentials' | 'complete';
    url?: string;
    data?: any;
  };
  error?: string;
}

// Manual Credentials
export interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email';
  required: boolean;
  placeholder: string;
  helpText?: string;
  validation?: RegExp;
}

export interface POSCredentialConfig {
  posType: string;
  posName: string;
  fields: CredentialField[];
  instructions: string[];
  documentationUrl?: string;
  testEndpoint?: string;
}

// Plugin Management
export interface POSPluginConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  auth: {
    type: 'oauth' | 'api_key' | 'basic';
    clientId?: string;
    scopes?: string[];
    authUrl?: string;
    tokenUrl?: string;
    fields?: CredentialField[];
  };
  endpoints?: {
    baseUrl: string;
    transactions: string;
    locations: string;
    inventory?: string;
  };
  webhooks?: {
    supported: boolean;
    events: string[];
    verificationMethod?: string;
  };
  dataMapping?: {
    transaction: Record<string, string>;
    customer: Record<string, string>;
    product: Record<string, string>;
  };
  features?: string[];
  lastUpdated: string;
  connectionTest?: {
    endpoint: string;
    method: 'GET' | 'POST';
    expectedResponse?: any;
  };
  instructions?: string[];
  documentationUrl?: string;
}

// API Response types
export interface POSApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    apiVersion?: string;
    permissions?: string[];
    rateLimit?: string;
    connectionTime?: number;
  };
}

// Component Props
export interface POSDiscoveryProps {
  onSelectPOS: (posId: string) => void;
  onContributeNew: () => void;
  className?: string;
}

export interface ManualCredentialsProps {
  posType: string;
  onSubmit: (credentials: Record<string, string>) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export interface POSConnectionStatusProps {
  connections: POSConnection[];
  onRefresh: (connectionId: string) => void;
  onReconfigure: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
  isLoading?: boolean;
}

export interface ContributePOSProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Event types for real-time updates
export interface POSProgressEvent {
  type: 'progress' | 'status' | 'error' | 'complete';
  sessionId: string;
  progress?: OnboardingProgress;
  status?: string;
  message?: string;
  error?: string;
  data?: any;
}

// Error types
export interface POSError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

// View modes and states
export type POSViewMode = 'discovery' | 'onboarding' | 'management' | 'manual-credentials' | 'contribute';

export type POSOnboardingStep = 'selection' | 'authentication' | 'progress' | 'completed' | 'error';

export type POSConnectionStatus = 'connected' | 'error' | 'warning' | 'disconnected';

// Search and filtering
export interface POSSearchFilters {
  category?: string;
  verified?: boolean;
  authMethod?: string;
  region?: string;
  query?: string;
}

export interface POSSearchResult extends POSDiscoveryResponse {
  totalResults?: number;
  currentPage?: number;
  totalPages?: number;
  filters?: POSSearchFilters;
}

// Contribution types
export interface POSContribution {
  id: string;
  name: string;
  description: string;
  category: POSSystem['category'];
  website?: string;
  logo?: string;
  supportedRegions?: string[];
  pricing?: POSSystem['pricing'];
  configuration?: POSPluginConfig;
  contributedBy: string;
  submissionDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
}

export interface POSContributionFormData {
  name: string;
  description: string;
  category: POSSystem['category'];
  website?: string;
  logo?: string;
  supportedRegions: string[];
  pricing: POSSystem['pricing'];
  authMethod: 'oauth' | 'api_key' | 'manual';
  hasWebhooks: boolean;
  features: string[];
  apiDocumentation?: string;
}

// Admin types
export interface POSAdminStats {
  totalSystems: number;
  pendingContributions: number;
  activeConnections: number;
  recentActivity: {
    type: 'contribution' | 'connection' | 'error';
    message: string;
    timestamp: string;
  }[];
}

// Base adapter interface
export interface POSAdapter {
  connect(config: POSConfig): Promise<ConnectionStatus>;
  disconnect(): Promise<void>;
  testConnection(): Promise<TestResult>;
  syncTransactions(since?: Date): Promise<POSTransaction[]>;
  processWebhook(data: POSWebhookData): Promise<void>;
}

export interface POSConfig {
  type: string;
  credentials: Record<string, string>;
  settings?: Record<string, any>;
}

export interface POSTransaction {
  id: string;
  externalId: string;
  amount: number;
  taxAmount: number;
  currency: string;
  timestamp: Date;
  items?: POSLineItem[];
  customer?: POSCustomer;
  location?: string;
}

export interface POSLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxAmount: number;
  category?: string;
}

export interface POSCustomer {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  taxExempt?: boolean;
}

export interface POSWebhookData {
  type: string;
  data: any;
  timestamp: Date;
  signature?: string;
}

export type ConnectionStatus = 'pending' | 'connected' | 'error' | 'warning' | 'disconnected';

export interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

// Export all types as a namespace as well
export namespace POS {
  export type System = POSSystem;
  export type Connection = POSConnection;
  export type DiscoveryResponse = POSDiscoveryResponse;
  export type OnboardingResultType = OnboardingResult;
  export type CredentialConfig = POSCredentialConfig;
  export type PluginConfig = POSPluginConfig;
  export type ApiResponse<T = any> = POSApiResponse<T>;
  export type Error = POSError;
  export type ViewMode = POSViewMode;
  export type OnboardingStep = POSOnboardingStep;
  export type ConnectionStatus = POSConnectionStatus;
}
