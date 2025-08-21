import React, { useState, useEffect } from 'react';
import { UserTenantAccess } from '@/types/tenant';
import { tenantApi } from '@/services/api';
import { useTenant } from '@/contexts/TenantContext';

interface TenantSelectorProps {
  onTenantSelected?: (tenantId: string) => void;
  showHeader?: boolean;
  className?: string;
}

export function TenantSelector({ onTenantSelected, showHeader = true, className = '' }: TenantSelectorProps) {
  const [userTenants, setUserTenants] = useState<UserTenantAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { tenant, switchTenant } = useTenant();

  useEffect(() => {
    fetchUserTenants();
  }, []);

  const fetchUserTenants = async () => {
    try {
      const response = await tenantApi.getUserTenants();
      if (response.success && response.data) {
        setUserTenants(response.data);
      } else {
        setError('Failed to load available tenants');
      }
    } catch (err) {
      console.error('Error fetching user tenants:', err);
      setError('Failed to load available tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleTenantSelect = async (tenantId: string) => {
    try {
      setLoading(true);
      await switchTenant(tenantId);
      onTenantSelected?.(tenantId);
    } catch (err) {
      console.error('Error switching tenant:', err);
      setError('Failed to switch tenant');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={fetchUserTenants}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (userTenants.length === 0) {
    return (
      <div className={`p-6 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Tenants Available</h3>
        <p className="text-yellow-700">You don't have access to any tenants. Please contact your administrator.</p>
      </div>
    );
  }

  if (userTenants.length === 1 && tenant) {
    return null;
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Select Organization</h2>
          <p className="text-sm text-gray-600 mt-1">Choose which organization you'd like to access</p>
        </div>
      )}
      
      <div className="p-6">
        <div className="grid gap-4">
          {userTenants.map((tenantAccess) => (
            <div
              key={tenantAccess.tenantId}
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                tenant?.id === tenantAccess.tenantId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleTenantSelect(tenantAccess.tenantId)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{tenantAccess.tenantName}</h3>
                  <p className="text-sm text-gray-600">@{tenantAccess.tenantSlug}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      tenantAccess.role === 'owner' ? 'bg-purple-100 text-purple-800' :
                      tenantAccess.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                      tenantAccess.role === 'manager' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {tenantAccess.role}
                    </span>
                    {tenantAccess.isPrimary && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                        Primary
                      </span>
                    )}
                    {!tenantAccess.isActive && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                {tenant?.id === tenantAccess.tenantId && (
                  <div className="flex items-center text-blue-600">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {tenant && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Currently selected: <span className="font-semibold">{tenant.name}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function TenantSelectorModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Switch Organization</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <TenantSelector 
          showHeader={false}
          onTenantSelected={onClose}
          className="shadow-none"
        />
      </div>
    </div>
  );
}