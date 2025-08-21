import React, { useState, useEffect } from 'react';
import { useTenant, useTenantRole } from '@/contexts/TenantContext';
import { Tenant, TenantSettings as ITenantSettings, UpdateTenantRequest } from '@/types/tenant';
import { tenantApi } from '@/services/api';

interface TenantSettingsProps {
  className?: string;
}

export function TenantSettings({ className = '' }: TenantSettingsProps) {
  const { tenant, refreshTenant } = useTenant();
  const { isOwner, isAdmin } = useTenantRole();
  const [settings, setSettings] = useState<ITenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'features' | 'integrations' | 'compliance' | 'branding'>('general');

  useEffect(() => {
    if (tenant) {
      setSettings(tenant.settings);
      setLoading(false);
    }
  }, [tenant]);

  const handleSaveSettings = async () => {
    if (!tenant || !settings || !isAdmin) return;

    setSaving(true);
    setError(null);

    try {
      const updateData: UpdateTenantRequest = {
        settings
      };

      const response = await tenantApi.update(tenant.id, updateData);
      if (response.success) {
        await refreshTenant();
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<ITenantSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
  };

  const updateFeatures = (featureUpdates: Partial<ITenantSettings['features']>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      features: { ...settings.features, ...featureUpdates }
    });
  };

  const updateIntegrations = (integrationUpdates: Partial<ITenantSettings['integrations']>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      integrations: { ...settings.integrations, ...integrationUpdates }
    });
  };

  const updateCompliance = (complianceUpdates: Partial<ITenantSettings['compliance']>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      compliance: { ...settings.compliance, ...complianceUpdates }
    });
  };

  const updateBranding = (brandingUpdates: Partial<ITenantSettings['branding']>) => {
    if (!settings) return;
    setSettings({
      ...settings,
      branding: { ...settings.branding, ...brandingUpdates }
    });
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!tenant || !settings) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <p className="text-red-600">Unable to load tenant settings</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`p-6 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <p className="text-yellow-800">You don't have permission to view or modify tenant settings</p>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'features', label: 'Features', icon: '🎯' },
    { id: 'integrations', label: 'Integrations', icon: '🔗' },
    { id: 'compliance', label: 'Compliance', icon: '📋' },
    { id: 'branding', label: 'Branding', icon: '🎨' },
  ] as const;

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Settings</h1>
          <p className="text-gray-600">{tenant.name} Configuration</p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">General Settings</h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data Retention (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.features.dataRetentionYears}
                    onChange={(e) => updateFeatures({ dataRetentionYears: parseInt(e.target.value) })}
                    className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">How long to retain transaction data</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Feature Access</h3>
              <div className="space-y-4">
                {Object.entries(settings.features).map(([key, value]) => {
                  if (key === 'dataRetentionYears') return null;
                  
                  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">{label}</label>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value as boolean}
                          onChange={(e) => updateFeatures({ [key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Integration Limits</h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max POS Connections</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.integrations.maxPOSConnections}
                    onChange={(e) => updateIntegrations({ maxPOSConnections: parseInt(e.target.value) })}
                    className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Webhooks Enabled</label>
                    <p className="text-sm text-gray-500">Allow real-time data synchronization</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.integrations.webhooksEnabled}
                      onChange={(e) => updateIntegrations({ webhooksEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Require Report Approval</label>
                    <p className="text-sm text-gray-500">All reports must be approved before filing</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.compliance.requireApprovalForReports}
                      onChange={(e) => updateCompliance({ requireApprovalForReports: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Data Residency Region</label>
                  <select
                    value={settings.compliance.dataResidencyRegion}
                    onChange={(e) => updateCompliance({ dataResidencyRegion: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="us">United States</option>
                    <option value="eu">European Union</option>
                    <option value="ca">Canada</option>
                    <option value="au">Australia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Encryption Level</label>
                  <select
                    value={settings.compliance.encryptionLevel}
                    onChange={(e) => updateCompliance({ encryptionLevel: e.target.value as 'standard' | 'enhanced' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="standard">Standard</option>
                    <option value="enhanced">Enhanced</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Branding Options</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Custom Logo</label>
                    <p className="text-sm text-gray-500">Allow uploading custom organization logo</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.branding.allowCustomLogo}
                      onChange={(e) => updateBranding({ allowCustomLogo: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Custom Colors</label>
                    <p className="text-sm text-gray-500">Allow customizing brand colors</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.branding.allowCustomColors}
                      onChange={(e) => updateBranding({ allowCustomColors: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Custom Domain</label>
                    <p className="text-sm text-gray-500">Allow using custom domain for the application</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.branding.allowCustomDomain}
                      onChange={(e) => updateBranding({ allowCustomDomain: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {tenant.domain && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Current Domain:</span> {tenant.domain}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving || !isAdmin}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}