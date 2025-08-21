/**
 * Complete POS Integration Management Component
 * Manages the entire POS integration workflow including discovery, onboarding, and management
 */

import React, { useState } from 'react';
import { 
  Settings, 
  Plus, 
  Search, 
  Filter,
  ChevronLeft
} from 'lucide-react';
import { ResponsiveLayout, ResponsiveGrid, ResponsiveCard, ResponsiveButton } from './ResponsiveLayout';
import { useTenant } from '@/contexts/TenantContext';

// Import our POS components
import POSDiscovery from './POSDiscovery';
import POSOnboardingFlow from './POSOnboarding';
import POSConnectionStatus from './POSConnectionStatus';
import ManualCredentials from './ManualCredentials';
import ContributePOS from './ContributePOS';

// Types for the POS system we're working with
interface POSConnection {
  id: string;
  posType: string;
  posName: string;
  status: 'connected' | 'error' | 'warning' | 'disconnected';
  lastSync: Date;
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
}

type ViewMode = 'discovery' | 'onboarding' | 'management' | 'manual-credentials' | 'contribute';

interface POSIntegrationsProps {
  className?: string;
}

export const POSIntegrations: React.FC<POSIntegrationsProps> = ({ className = '' }) => {
  const [currentView, setCurrentView] = useState<ViewMode>('management');
  const [selectedPOSType, setSelectedPOSType] = useState<string | null>(null);
  const [connections, setConnections] = useState<POSConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { tenant } = useTenant();

  // Load existing connections when component mounts or tenant changes
  React.useEffect(() => {
    if (tenant) {
      loadConnections();
    }
  }, [tenant]);

  const loadConnections = async () => {
    if (!tenant) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/pos/connections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': tenant.id
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Failed to load POS connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle POS selection from discovery
  const handleSelectPOS = (posId: string) => {
    setSelectedPOSType(posId);
    setCurrentView('onboarding');
  };

  // Handle adding new POS system
  const handleContributeNew = () => {
    setCurrentView('contribute');
  };

  // Handle showing manual credentials
  const handleShowManualCredentials = (posType: string) => {
    setSelectedPOSType(posType);
    setCurrentView('manual-credentials');
  };

  // Handle manual credentials submission
  const handleManualCredentialsSubmit = async (credentials: { [key: string]: string }) => {
    if (!selectedPOSType || !tenant) return;

    try {
      const response = await fetch('/api/pos/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': tenant.id
        },
        body: JSON.stringify({
          posType: selectedPOSType,
          credentials
        })
      });

      if (response.ok) {
        await loadConnections();
        setCurrentView('management');
        setSelectedPOSType(null);
      }
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  };

  // Handle connection management actions
  const handleRefreshConnection = async (connectionId: string) => {
    if (!tenant) return;
    
    try {
      const response = await fetch(`/api/pos/connections/${connectionId}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Tenant-ID': tenant.id
        }
      });
      
      if (response.ok) {
        await loadConnections();
      }
    } catch (error) {
      console.error('Failed to refresh connection:', error);
    }
  };

  const handleReconfigureConnection = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      // For API key based systems, show manual credentials
      if (['clover', 'toast'].includes(connection.posType)) {
        handleShowManualCredentials(connection.posType);
      } else {
        // For OAuth systems, restart onboarding
        handleSelectPOS(connection.posType);
      }
    }
  };

  const handleDisconnectConnection = async (connectionId: string) => {
    if (!tenant) return;
    
    if (window.confirm('Are you sure you want to disconnect this POS system?')) {
      try {
        const response = await fetch(`/api/pos/connections/${connectionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Tenant-ID': tenant.id
          }
        });
        
        if (response.ok) {
          await loadConnections();
        }
      } catch (error) {
        console.error('Failed to disconnect POS:', error);
      }
    }
  };

  // Navigate back to management view
  const goBackToManagement = () => {
    setCurrentView('management');
    setSelectedPOSType(null);
    loadConnections(); // Refresh connections when returning
  };

  // Navigate to discovery view
  const goToDiscovery = () => {
    setCurrentView('discovery');
  };

  // Render the appropriate view based on current state
  const renderCurrentView = () => {
    switch (currentView) {
      case 'discovery':
        return (
          <POSDiscovery
            onSelectPOS={handleSelectPOS}
            onContributeNew={handleContributeNew}
          />
        );

      case 'onboarding':
        return <POSOnboardingFlow />;

      case 'manual-credentials':
        return selectedPOSType ? (
          <ManualCredentials
            posType={selectedPOSType}
            onSubmit={handleManualCredentialsSubmit}
            onCancel={goBackToManagement}
          />
        ) : null;

      case 'contribute':
        return (
          <ContributePOS
            onSuccess={goBackToManagement}
            onCancel={goBackToManagement}
          />
        );

      case 'management':
      default:
        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">POS Integrations</h1>
                <p className="text-gray-600 mt-1">
                  Manage your point-of-sale system connections for automated sales tax tracking
                </p>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={goToDiscovery}
                  className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add POS System
                </button>
              </div>
            </div>

            {/* Connection Status */}
            <POSConnectionStatus
              connections={connections}
              onRefresh={handleRefreshConnection}
              onReconfigure={handleReconfigureConnection}
              onDisconnect={handleDisconnectConnection}
              isLoading={isLoading}
            />

            {/* Quick Stats */}
            {connections.length > 0 && (
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Integration Overview</h3>
                
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {connections.length}
                    </p>
                    <p className="text-sm text-gray-600">Connected Systems</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {connections.filter(c => c.status === 'connected').length}
                    </p>
                    <p className="text-sm text-gray-600">Active</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {connections.reduce((sum, c) => sum + c.locationsCount, 0)}
                    </p>
                    <p className="text-sm text-gray-600">Total Locations</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      ${connections.reduce((sum, c) => sum + c.todaysSales, 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600">Today's Sales</p>
                  </div>
                </div>
              </div>
            )}

            {/* Getting Started Guide */}
            {connections.length === 0 && !isLoading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Get Started with POS Integration</h3>
                <div className="text-blue-800 space-y-2">
                  <p>1. Click "Add POS System" to browse supported systems</p>
                  <p>2. Select your POS system from our registry</p>
                  <p>3. Complete the authentication process</p>
                  <p>4. Start tracking sales tax automatically</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={goToDiscovery}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Browse POS Systems
                  </button>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className={`${className}`}>
      {/* Navigation breadcrumb for non-management views */}
      {currentView !== 'management' && (
        <div className="mb-6">
          <button
            onClick={goBackToManagement}
            className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to POS Management
          </button>
        </div>
      )}

      {/* Current view content */}
      {renderCurrentView()}
    </div>
  );
};

export default POSIntegrations;
