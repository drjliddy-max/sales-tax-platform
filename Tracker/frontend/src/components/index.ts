/**
 * Component Exports
 * Complete React component library for POS onboarding, management, and multi-tenant architecture
 */

// Main integrated POS management component
export { default as POSIntegrations } from './POSIntegrations';

// Individual POS components
export { default as POSOnboardingFlow } from './POSOnboarding';
export { default as POSDiscovery } from './POSDiscovery';
export { default as ManualCredentials } from './ManualCredentials';
export { default as POSConnectionStatus } from './POSConnectionStatus';
export { default as ContributePOS } from './ContributePOS';

// Multi-tenant components
export { TenantSelector, TenantSelectorModal } from './TenantSelector';
export { TenantAwareNavigation } from './TenantAwareNavigation';
export { TenantSettings } from './TenantSettings';
export { default as TenantManagementDashboard } from './TenantManagementDashboard';
export { default as TenantMigrationDashboard } from './TenantMigrationDashboard';

// Migration and data management components
export { default as MigrationProgressTracker } from './MigrationProgressTracker';
export { default as ValidationDashboard } from './ValidationDashboard';
export { default as IntegrityRepairTool } from './IntegrityRepairTool';
export { default as MigrationScheduler } from './MigrationScheduler';

// Context exports
export { TenantProvider, useTenant, useTenantPermissions, useTenantRole } from '../contexts/TenantContext';

// Type exports from centralized types file
export type {
  POSSystem,
  OnboardingProgress,
  OnboardingSession,
  LocationInfo,
  OnboardingResult,
  CredentialField,
  POSCredentialConfig,
  ManualCredentialsProps,
  POSConnection,
  POSConnectionStatusProps,
  ContributePOSProps
} from '../types/pos';

export type {
  Tenant,
  TenantUser,
  TenantContext,
  TenantUserRole,
  TenantSettings as ITenantSettings,
  TenantBilling,
  TenantLimits,
  TenantInvitation,
  UserTenantAccess,
  TenantPermissions,
  CreateTenantRequest,
  UpdateTenantRequest,
  TenantApiResponse
} from '../types/tenant';
