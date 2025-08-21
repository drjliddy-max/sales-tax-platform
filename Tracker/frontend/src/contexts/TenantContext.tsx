import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Tenant, TenantContext as ITenantContext, TenantUserRole, UserTenantAccess } from '@/types/tenant';
import { authService } from '@/services/auth';
import { apiService } from '@/services/api';

const TenantContext = createContext<ITenantContext | undefined>(undefined);

interface TenantProviderProps {
  children: React.ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [userRole, setUserRole] = useState<TenantUserRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userTenants, setUserTenants] = useState<UserTenantAccess[]>([]);

  const loadTenantFromStorage = useCallback(() => {
    const storedTenantId = localStorage.getItem('selectedTenantId');
    const storedTenant = localStorage.getItem('currentTenant');
    
    if (storedTenantId && storedTenant) {
      try {
        const parsedTenant = JSON.parse(storedTenant);
        setTenant(parsedTenant);
        return storedTenantId;
      } catch (error) {
        console.error('Error parsing stored tenant:', error);
        localStorage.removeItem('selectedTenantId');
        localStorage.removeItem('currentTenant');
      }
    }
    return null;
  }, []);

  const fetchUserTenants = useCallback(async () => {
    try {
      const response = await apiService.get<UserTenantAccess[]>('/tenants/user-access');
      if (response.success && response.data) {
        setUserTenants(response.data);
        return response.data;
      }
    } catch (error) {
      console.error('Error fetching user tenants:', error);
    }
    return [];
  }, []);

  const fetchTenantDetails = useCallback(async (tenantId: string) => {
    try {
      const response = await apiService.get<{
        tenant: Tenant;
        userRole: TenantUserRole;
        permissions: string[];
      }>(`/tenants/${tenantId}/details`);
      
      if (response.success && response.data) {
        const { tenant: tenantData, userRole: role, permissions: perms } = response.data;
        setTenant(tenantData);
        setUserRole(role);
        setPermissions(perms);
        
        localStorage.setItem('selectedTenantId', tenantId);
        localStorage.setItem('currentTenant', JSON.stringify(tenantData));
        localStorage.setItem('userRole', role);
        localStorage.setItem('permissions', JSON.stringify(perms));
        
        return tenantData;
      }
    } catch (error) {
      console.error('Error fetching tenant details:', error);
      throw error;
    }
    return null;
  }, []);

  const switchTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true);
    try {
      const tenantData = await fetchTenantDetails(tenantId);
      if (tenantData) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [fetchTenantDetails]);

  const refreshTenant = useCallback(async () => {
    if (!tenant) return;
    
    setIsLoading(true);
    try {
      await fetchTenantDetails(tenant.id);
    } catch (error) {
      console.error('Error refreshing tenant:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant, fetchTenantDetails]);

  const initializeTenant = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      const storedTenantId = loadTenantFromStorage();
      const availableTenants = await fetchUserTenants();

      if (storedTenantId) {
        const tenantExists = availableTenants.some(t => t.tenantId === storedTenantId);
        if (tenantExists) {
          await fetchTenantDetails(storedTenantId);
        } else {
          localStorage.removeItem('selectedTenantId');
          localStorage.removeItem('currentTenant');
          localStorage.removeItem('userRole');
          localStorage.removeItem('permissions');
        }
      }

      if (!tenant && availableTenants.length > 0) {
        const primaryTenant = availableTenants.find(t => t.isPrimary) || availableTenants[0];
        await fetchTenantDetails(primaryTenant.tenantId);
      }
    } catch (error) {
      console.error('Error initializing tenant:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant, loadTenantFromStorage, fetchUserTenants, fetchTenantDetails]);

  useEffect(() => {
    initializeTenant();
  }, []);

  const value: ITenantContext = {
    tenant,
    userRole,
    permissions,
    isLoading,
    switchTenant,
    refreshTenant,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

export function useTenantPermissions() {
  const { permissions } = useTenant();
  
  const hasPermission = useCallback((permission: string) => {
    return permissions.includes(permission);
  }, [permissions]);

  const hasAnyPermission = useCallback((permissionList: string[]) => {
    return permissionList.some(permission => permissions.includes(permission));
  }, [permissions]);

  const hasAllPermissions = useCallback((permissionList: string[]) => {
    return permissionList.every(permission => permissions.includes(permission));
  }, [permissions]);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}

export function useTenantRole() {
  const { userRole } = useTenant();
  
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin' || isOwner;
  const isManager = userRole === 'manager' || isAdmin;
  const canManageUsers = isAdmin;
  const canManageSettings = isOwner;
  const canViewAuditLogs = isManager;

  return {
    userRole,
    isOwner,
    isAdmin,
    isManager,
    canManageUsers,
    canManageSettings,
    canViewAuditLogs,
  };
}