/**
 * POS Integration Example
 * Demonstrates how to use the complete POS onboarding and management system
 */

import React, { useState, useEffect } from 'react';
import { 
  POSOnboardingFlow, 
  POSConnectionStatus, 
  ManualCredentials,
  type POSConnection
} from '../components';
import { Plus, Settings } from 'lucide-react';

type ViewMode = 'dashboard' | 'onboarding' | 'manual_credentials';

interface POSIntegrationExampleState {
  currentView: ViewMode;
  connections: POSConnection[];
  selectedPOSForManualConfig: string | null;
  isLoading: boolean;
}

export const POSIntegrationExample: React.FC = () => {
  const [state, setState] = useState<POSIntegrationExampleState>({
    currentView: 'dashboard',
    connections: [],
    selectedPOSForManualConfig: null,
    isLoading: false
  });

  // Load existing POS connections on mount
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch('/api/pos/connections', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setState(prev => ({ 
          ...prev, 
          connections: data.connections,
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Failed to load POS connections:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRefreshConnection = async (connectionId: string) => {
    try {
      const response = await fetch(`/api/pos/connections/${connectionId}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await loadConnections(); // Reload connections after refresh
      }
    } catch (error) {
      console.error('Failed to refresh connection:', error);
    }
  };

  const handleReconfigureConnection = async (connectionId: string) => {
    // Find the connection and determine if it needs manual credentials
    const connection = state.connections.find(c => c.id === connectionId);
    
    if (connection) {
      if (['clover', 'toast'].includes(connection.posType)) {
        // Show manual credentials form
        setState(prev => ({
          ...prev,
          currentView: 'manual_credentials',
          selectedPOSForManualConfig: connection.posType
        }));
      } else {
        // Redirect to OAuth re-authentication
        setState(prev => ({ ...prev, currentView: 'onboarding' }));
      }
    }
  };

  const handleDisconnectConnection = async (connectionId: string) => {
    if (window.confirm('Are you sure you want to disconnect this POS system?')) {
      try {
        const response = await fetch(`/api/pos/connections/${connectionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          await loadConnections(); // Reload connections after disconnect
        }
      } catch (error) {
        console.error('Failed to disconnect POS:', error);
      }
    }
  };

  const handleManualCredentialsSubmit = async (credentials: { [key: string]: string }) => {
    if (!state.selectedPOSForManualConfig) return;

    try {
      const response = await fetch('/api/pos/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          posType: state.selectedPOSForManualConfig,
          credentials
        })
      });

      if (response.ok) {
        setState(prev => ({ 
          ...prev, 
          currentView: 'dashboard',
          selectedPOSForManualConfig: null
        }));
        await loadConnections();
      }
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  };

  const handleManualCredentialsCancel = () => {
    setState(prev => ({
      ...prev,
      currentView: 'dashboard',
      selectedPOSForManualConfig: null
    }));
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Integrations</h1>
          <p className="text-gray-600">
            Manage your point-of-sale system connections for automatic sales tax tracking.
          </p>
        </div>
        
        <button
          onClick={() => setState(prev => ({ ...prev, currentView: 'onboarding' }))}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-600 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add POS System
        </button>
      </div>

      {/* Connection Status */}
      <POSConnectionStatus
        connections={state.connections.map(conn => ({
          ...conn,
          lastSync: typeof conn.lastSync === 'string' ? new Date(conn.lastSync) : conn.lastSync
        }))}
        onRefresh={handleRefreshConnection}
        onReconfigure={handleReconfigureConnection}
        onDisconnect={handleDisconnectConnection}
        isLoading={state.isLoading}
      />

      {/* Quick Stats */}
      {state.connections.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Integration Overview</h3>
          
          <div className="grid md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {state.connections.length}
              </p>
              <p className="text-sm text-gray-600">Connected Systems</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {state.connections.filter(c => c.status === 'connected').length}
              </p>
              <p className="text-sm text-gray-600">Active</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {state.connections.reduce((sum, c) => sum + c.locationsCount, 0)}
              </p>
              <p className="text-sm text-gray-600">Total Locations</p>
            </div>
            
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                ${state.connections.reduce((sum, c) => sum + c.todaysSales, 0).toFixed(2)}
              </p>
              <p className="text-sm text-gray-600">Today's Sales</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderOnboarding = () => (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setState(prev => ({ ...prev, currentView: 'dashboard' }))}
          className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-medium"
        >
          ← Back to Dashboard
        </button>
      </div>
      
      <POSOnboardingFlow />
    </div>
  );

  const renderManualCredentials = () => (
    <div>
      <div className="mb-6">
        <button
          onClick={handleManualCredentialsCancel}
          className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-medium"
        >
          ← Back to Dashboard
        </button>
      </div>
      
      {state.selectedPOSForManualConfig && (
        <ManualCredentials
          posType={state.selectedPOSForManualConfig}
          onSubmit={handleManualCredentialsSubmit}
          onCancel={handleManualCredentialsCancel}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {state.currentView === 'dashboard' && renderDashboard()}
        {state.currentView === 'onboarding' && renderOnboarding()}
        {state.currentView === 'manual_credentials' && renderManualCredentials()}
      </div>
    </div>
  );
};

export default POSIntegrationExample;
