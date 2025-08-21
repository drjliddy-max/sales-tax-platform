import React, { useState, useEffect } from 'react';
import { Tenant, TenantUser, CreateTenantRequest, UpdateTenantRequest } from '@/types/tenant';
import { tenantApi } from '@/services/api';

interface TenantManagementDashboardProps {
  className?: string;
}

function TenantManagementDashboard({ className = '' }: TenantManagementDashboardProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await tenantApi.getAll();
      if (response.success && response.data) {
        setTenants(response.data);
      }
    } catch (err) {
      setError('Failed to load tenants');
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantUsers = async (tenantId: string) => {
    try {
      const response = await tenantApi.getUsers(tenantId);
      if (response.success && response.data) {
        setTenantUsers(response.data);
      }
    } catch (err) {
      console.error('Error fetching tenant users:', err);
    }
  };

  const handleTenantClick = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    await fetchTenantUsers(tenant.id);
  };

  const handleCreateTenant = async (data: CreateTenantRequest) => {
    try {
      const response = await tenantApi.create(data);
      if (response.success) {
        await fetchTenants();
        setShowCreateModal(false);
      }
    } catch (err) {
      console.error('Error creating tenant:', err);
    }
  };

  const handleUpdateTenant = async (data: UpdateTenantRequest) => {
    if (!selectedTenant) return;
    
    try {
      const response = await tenantApi.update(selectedTenant.id, data);
      if (response.success) {
        await fetchTenants();
        setShowEditModal(false);
        setSelectedTenant(response.data);
      }
    } catch (err) {
      console.error('Error updating tenant:', err);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-600">{error}</p>
        <button onClick={fetchTenants} className="mt-2 btn-primary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`max-w-7xl mx-auto py-6 px-4 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          Create New Tenant
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenants List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">All Tenants ({tenants.length})</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {tenants.map((tenant) => (
              <div
                key={tenant.id}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedTenant?.id === tenant.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => handleTenantClick(tenant)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                    <p className="text-sm text-gray-600">@{tenant.slug}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tenant.plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                        tenant.plan === 'professional' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {tenant.plan}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        tenant.status === 'active' ? 'bg-green-100 text-green-800' :
                        tenant.status === 'trial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {tenant.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tenant Details */}
        <div className="bg-white rounded-lg shadow">
          {selectedTenant ? (
            <>
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold">{selectedTenant.name}</h2>
                <button 
                  onClick={() => setShowEditModal(true)}
                  className="btn-secondary"
                >
                  Edit
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold mb-3">Tenant Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Slug:</span>
                      <p className="font-medium">@{selectedTenant.slug}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Plan:</span>
                      <p className="font-medium capitalize">{selectedTenant.plan}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <p className="font-medium capitalize">{selectedTenant.status}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Timezone:</span>
                      <p className="font-medium">{selectedTenant.timezone}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Usage & Limits</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Users:</span>
                      <span>{tenantUsers.length} / {selectedTenant.limits.maxUsers}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Transactions:</span>
                      <span>{selectedTenant.billing.usage.transactionsThisMonth} / {selectedTenant.limits.maxTransactionsPerMonth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage:</span>
                      <span>{selectedTenant.billing.usage.storageUsedMB}MB / {selectedTenant.limits.maxStorageMB}MB</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Users ({tenantUsers.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {tenantUsers.map((user) => (
                      <div key={user.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-sm">{user.userId}</p>
                          <p className="text-xs text-gray-600">{user.role}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-gray-500">
              Select a tenant to view details
            </div>
          )}
        </div>
      </div>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <CreateTenantModal
          onSubmit={handleCreateTenant}
          onCancel={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Tenant Modal */}
      {showEditModal && selectedTenant && (
        <EditTenantModal
          tenant={selectedTenant}
          onSubmit={handleUpdateTenant}
          onCancel={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}

function CreateTenantModal({ onSubmit, onCancel }: {
  onSubmit: (data: CreateTenantRequest) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CreateTenantRequest>({
    name: '',
    slug: '',
    plan: 'starter',
    timezone: 'UTC',
    currency: 'USD',
    locale: 'en-US',
    ownerId: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Create New Tenant</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="auto-generated if empty"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Plan</label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Owner User ID</label>
              <input
                type="text"
                required
                value={formData.ownerId}
                onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTenantModal({ tenant, onSubmit, onCancel }: {
  tenant: Tenant;
  onSubmit: (data: UpdateTenantRequest) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<UpdateTenantRequest>({
    name: tenant.name,
    slug: tenant.slug,
    domain: tenant.domain || '',
    timezone: tenant.timezone,
    currency: tenant.currency,
    locale: tenant.locale,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Edit Tenant</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Slug</label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Custom Domain</label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="custom.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Timezone</label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Update Tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TenantManagementDashboard;