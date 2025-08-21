import React, { useState, useEffect } from 'react';
import {
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  Activity,
  Users,
  ShoppingCart,
  CreditCard,
  Building,
  Globe,
  Zap,
  Eye,
  Edit3,
  Download,
  Upload,
  Calendar,
  BarChart3
} from 'lucide-react';
import { integrationManager, IntegrationConfig } from '../services/integrations/IntegrationManager';

interface IntegrationsDashboardProps {
  className?: string;
}

interface ConnectionStatus {
  id: string;
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: Date;
  nextSync?: Date;
  syncProgress?: number;
  errorMessage?: string;
}

const integrationIcons: Record<string, React.ReactNode> = {
  ecommerce: <ShoppingCart className="w-5 h-5" />,
  accounting: <BarChart3 className="w-5 h-5" />,
  payment: <CreditCard className="w-5 h-5" />,
  erp: <Building className="w-5 h-5" />,
  marketplace: <Globe className="w-5 h-5" />,
  pos: <Activity className="w-5 h-5" />
};

const integrationColors: Record<string, string> = {
  ecommerce: 'bg-blue-500',
  accounting: 'bg-green-500',
  payment: 'bg-purple-500',
  erp: 'bg-orange-500',
  marketplace: 'bg-yellow-500',
  pos: 'bg-red-500'
};

export const IntegrationsDashboard: React.FC<IntegrationsDashboardProps> = ({ 
  className = '' 
}) => {
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [availableAdapters, setAvailableAdapters] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationConfig | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'all' | 'ecommerce' | 'accounting' | 'payment' | 'erp' | 'marketplace' | 'pos'>('all');

  useEffect(() => {
    loadIntegrations();
    loadAvailableAdapters();
    
    // Set up event listeners for real-time updates
    integrationManager.on('integration:created', handleIntegrationCreated);
    integrationManager.on('integration:deleted', handleIntegrationDeleted);
    integrationManager.on('sync:started', handleSyncStarted);
    integrationManager.on('sync:completed', handleSyncCompleted);
    integrationManager.on('sync:failed', handleSyncFailed);

    return () => {
      integrationManager.removeAllListeners();
    };
  }, []);

  const loadIntegrations = async () => {
    setIsLoading(true);
    try {
      const allIntegrations = integrationManager.getAllIntegrations();
      setIntegrations(allIntegrations);
      
      // Load connection statuses
      const statuses: Record<string, ConnectionStatus> = {};
      for (const integration of allIntegrations) {
        statuses[integration.id] = {
          id: integration.id,
          status: integration.status === 'active' ? 'connected' : 
                  integration.status === 'error' ? 'error' : 'disconnected',
          lastSync: integration.lastSync,
          nextSync: integration.lastSync ? 
            new Date(integration.lastSync.getTime() + 24 * 60 * 60 * 1000) : undefined
        };
      }
      setConnectionStatuses(statuses);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableAdapters = () => {
    const adapters = integrationManager.getAvailableAdapters();
    setAvailableAdapters(adapters);
  };

  const handleIntegrationCreated = ({ config }: { config: IntegrationConfig }) => {
    setIntegrations(prev => [...prev, config]);
    setConnectionStatuses(prev => ({
      ...prev,
      [config.id]: {
        id: config.id,
        status: 'connected',
        lastSync: config.lastSync
      }
    }));
  };

  const handleIntegrationDeleted = ({ integrationId }: { integrationId: string }) => {
    setIntegrations(prev => prev.filter(i => i.id !== integrationId));
    setConnectionStatuses(prev => {
      const { [integrationId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleSyncStarted = ({ integrationId }: { integrationId: string }) => {
    setConnectionStatuses(prev => ({
      ...prev,
      [integrationId]: {
        ...prev[integrationId],
        status: 'syncing',
        syncProgress: 0
      }
    }));
  };

  const handleSyncCompleted = ({ integrationId }: { integrationId: string }) => {
    setConnectionStatuses(prev => ({
      ...prev,
      [integrationId]: {
        ...prev[integrationId],
        status: 'connected',
        lastSync: new Date(),
        syncProgress: undefined
      }
    }));
  };

  const handleSyncFailed = ({ integrationId, error }: { integrationId: string; error: any }) => {
    setConnectionStatuses(prev => ({
      ...prev,
      [integrationId]: {
        ...prev[integrationId],
        status: 'error',
        errorMessage: error.message,
        syncProgress: undefined
      }
    }));
  };

  const handleSync = async (integrationId: string, syncType: 'transactions' | 'products' | 'customers' | 'all') => {
    try {
      await integrationManager.syncIntegration(integrationId, syncType);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  const handleDelete = async (integrationId: string) => {
    if (confirm('Are you sure you want to delete this integration?')) {
      try {
        await integrationManager.deleteIntegration(integrationId);
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  const getStatusIcon = (status: ConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'syncing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: ConnectionStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const filteredIntegrations = integrations.filter(integration => 
    selectedType === 'all' || integration.type === selectedType
  );

  const integrationStats = {
    total: integrations.length,
    connected: integrations.filter(i => connectionStatuses[i.id]?.status === 'connected').length,
    syncing: integrations.filter(i => connectionStatuses[i.id]?.status === 'syncing').length,
    errors: integrations.filter(i => connectionStatuses[i.id]?.status === 'error').length
  };

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center py-12`}>
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading integrations...</span>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-1">Manage your third-party connections and data sync</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Integrations</p>
              <p className="text-2xl font-bold text-gray-900">{integrationStats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Connected</p>
              <p className="text-2xl font-bold text-gray-900">{integrationStats.connected}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <RefreshCw className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Syncing</p>
              <p className="text-2xl font-bold text-gray-900">{integrationStats.syncing}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-gray-900">{integrationStats.errors}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-4 mb-6">
        {['all', 'ecommerce', 'accounting', 'payment', 'erp', 'marketplace', 'pos'].map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type as any)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              selectedType === type
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
            {type !== 'all' && (
              <span className="ml-1 text-xs">
                ({integrations.filter(i => i.type === type).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Integrations Grid */}
      {filteredIntegrations.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No integrations found</h3>
          <p className="text-gray-500 mb-6">
            {selectedType === 'all' 
              ? "Get started by adding your first integration"
              : `No ${selectedType} integrations configured`
            }
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            Add Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((integration) => {
            const status = connectionStatuses[integration.id];
            
            return (
              <div key={integration.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg ${integrationColors[integration.type]} text-white`}>
                        {integrationIcons[integration.type]}
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                        <p className="text-sm text-gray-500 capitalize">{integration.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {getStatusIcon(status?.status || 'disconnected')}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-medium ${
                        status?.status === 'connected' ? 'text-green-600' :
                        status?.status === 'syncing' ? 'text-blue-600' :
                        status?.status === 'error' ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {getStatusText(status?.status || 'disconnected')}
                      </span>
                    </div>
                    
                    {status?.lastSync && (
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-500">Last sync:</span>
                        <span className="text-gray-700">
                          {status.lastSync.toLocaleDateString()} {status.lastSync.toLocaleTimeString()}
                        </span>
                      </div>
                    )}

                    {status?.errorMessage && (
                      <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                        {status.errorMessage}
                      </div>
                    )}

                    {status?.syncProgress !== undefined && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>Syncing...</span>
                          <span>{Math.round(status.syncProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${status.syncProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSync(integration.id, 'all')}
                        disabled={status?.status === 'syncing'}
                        className="btn-secondary-sm flex items-center"
                        title="Sync all data"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedIntegration(integration);
                          setShowSettingsModal(true);
                        }}
                        className="btn-secondary-sm flex items-center"
                        title="Settings"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                      
                      <button
                        onClick={() => handleDelete(integration.id)}
                        className="btn-secondary-sm text-red-600 hover:bg-red-50 flex items-center"
                        title="Delete integration"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedIntegration(integration);
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                    >
                      View Details
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions for selected integrations */}
      {filteredIntegrations.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => filteredIntegrations.forEach(i => handleSync(i.id, 'all'))}
              className="btn-secondary flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync All
            </button>
            
            <button
              onClick={() => filteredIntegrations.forEach(i => handleSync(i.id, 'transactions'))}
              className="btn-secondary flex items-center justify-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Sync Transactions
            </button>
            
            <button
              onClick={() => filteredIntegrations.forEach(i => handleSync(i.id, 'products'))}
              className="btn-secondary flex items-center justify-center"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Sync Products
            </button>
            
            <button
              onClick={() => filteredIntegrations.forEach(i => handleSync(i.id, 'customers'))}
              className="btn-secondary flex items-center justify-center"
            >
              <Users className="w-4 h-4 mr-2" />
              Sync Customers
            </button>
          </div>
        </div>
      )}

      {/* Add Integration Modal would go here */}
      {/* Settings Modal would go here */}
      {/* Integration Details Modal would go here */}
    </div>
  );
};
