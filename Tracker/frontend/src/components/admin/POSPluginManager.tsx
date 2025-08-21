/**
 * POS Plugin Manager - Admin Interface
 * Allows administrators to add, edit, and manage POS plugins without code changes
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  TestTube, 
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';

interface POSPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  lastUpdated: Date;
  authType: 'oauth' | 'api_key' | 'basic_auth';
  features: {
    realTimeSync: boolean;
    historicalSync: boolean;
    webhooksSupported: boolean;
    multiLocationSupport: boolean;
    taxDetailsSupported: boolean;
  };
}

interface PluginFormData {
  id: string;
  name: string;
  description: string;
  marketFocus: string;
  documentationUrl: string;
  version: string;
  authType: 'oauth' | 'api_key' | 'basic_auth';
  // Add other fields as needed
}

export const POSPluginManager: React.FC = () => {
  const [plugins, setPlugins] = useState<POSPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlugin, setSelectedPlugin] = useState<POSPlugin | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PluginFormData>({
    id: '',
    name: '',
    description: '',
    marketFocus: '',
    documentationUrl: '',
    version: '1.0.0',
    authType: 'api_key'
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pos/plugins', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPlugins(data.plugins);
      } else {
        setError('Failed to load plugins');
      }
    } catch (error) {
      setError('Network error while loading plugins');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlugin = () => {
    setFormData({
      id: '',
      name: '',
      description: '',
      marketFocus: '',
      documentationUrl: '',
      version: '1.0.0',
      authType: 'api_key'
    });
    setIsEditing(false);
    setShowForm(true);
  };

  const handleEditPlugin = (plugin: POSPlugin) => {
    // Load full plugin config for editing
    loadPluginForEdit(plugin.id);
  };

  const loadPluginForEdit = async (pluginId: string) => {
    try {
      const response = await fetch(`/api/pos/plugins/${pluginId}/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const plugin = await response.json();
        setFormData({
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          marketFocus: plugin.marketFocus,
          documentationUrl: plugin.documentationUrl || '',
          version: plugin.version,
          authType: plugin.auth.type
        });
        setIsEditing(true);
        setShowForm(true);
      }
    } catch (error) {
      setError('Failed to load plugin for editing');
    }
  };

  const handleDeletePlugin = async (pluginId: string) => {
    if (!window.confirm('Are you sure you want to delete this plugin? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/pos/plugins/${pluginId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setSuccess('Plugin deleted successfully');
        loadPlugins();
      } else {
        setError('Failed to delete plugin');
      }
    } catch (error) {
      setError('Network error while deleting plugin');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.id || !formData.name) {
      setError('Plugin ID and name are required');
      return;
    }

    try {
      // Create a basic plugin configuration
      const pluginConfig = {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        marketFocus: formData.marketFocus,
        documentationUrl: formData.documentationUrl,
        version: formData.version,
        lastUpdated: new Date(),
        auth: {
          type: formData.authType
        },
        fields: [],
        endpoints: {
          baseUrl: '',
          authHeader: 'Authorization',
          endpoints: {
            test: '',
            locations: '',
            transactions: ''
          }
        },
        dataMapping: {
          transaction: {
            id: 'id',
            timestamp: 'timestamp',
            totalAmount: 'amount',
            totalTax: 'tax',
            items: 'items',
            location: 'location'
          },
          location: {
            id: 'id',
            name: 'name',
            address: {
              street: 'address.street',
              city: 'address.city',
              state: 'address.state',
              zipCode: 'address.zip',
              country: 'address.country'
            }
          }
        },
        instructions: [],
        connectionTest: {
          endpoint: '/test',
          method: 'GET',
          expectedStatus: 200
        },
        features: {
          realTimeSync: false,
          historicalSync: true,
          webhooksSupported: false,
          multiLocationSupport: false,
          taxDetailsSupported: false
        }
      };

      const response = await fetch('/api/pos/plugins/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(pluginConfig)
      });

      if (response.ok) {
        setSuccess(`Plugin ${isEditing ? 'updated' : 'created'} successfully`);
        setShowForm(false);
        loadPlugins();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save plugin');
      }
    } catch (error) {
      setError('Network error while saving plugin');
    }
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const config = JSON.parse(event.target?.result as string);
            
            // Validate and register the imported config
            const response = await fetch('/api/pos/plugins/register', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify(config)
            });

            if (response.ok) {
              setSuccess('Plugin imported successfully');
              loadPlugins();
            } else {
              setError('Failed to import plugin configuration');
            }
          } catch (error) {
            setError('Invalid plugin configuration file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleExportPlugin = async (pluginId: string) => {
    try {
      const response = await fetch(`/api/pos/plugins/${pluginId}/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const config = await response.json();
        const blob = new Blob([JSON.stringify(config, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pluginId}-config.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setError('Failed to export plugin configuration');
    }
  };

  const renderPluginList = () => (
    <div className="space-y-4">
      {plugins.map((plugin) => (
        <div key={plugin.id} className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{plugin.name}</h3>
              <p className="text-gray-600">{plugin.description}</p>
              <div className="flex items-center mt-2 text-sm text-gray-500">
                <span>v{plugin.version}</span>
                <span className="mx-2">•</span>
                <span>{plugin.authType.toUpperCase()}</span>
                <span className="mx-2">•</span>
                <span>Updated {new Date(plugin.lastUpdated).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleExportPlugin(plugin.id)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Export Configuration"
              >
                <Download className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setSelectedPlugin(plugin)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="View Details"
              >
                <Eye className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => handleEditPlugin(plugin)}
                className="p-2 text-gray-400 hover:text-blue-600"
                title="Edit Plugin"
              >
                <Edit className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => handleDeletePlugin(plugin.id)}
                className="p-2 text-gray-400 hover:text-red-600"
                title="Delete Plugin"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Feature indicators */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(plugin.features).map(([feature, enabled]) => (
              enabled && (
                <span
                  key={feature}
                  className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                >
                  {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
              )
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderForm = () => (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {isEditing ? 'Edit Plugin' : 'Add New Plugin'}
      </h3>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plugin ID *
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., my-pos-system"
              required
              disabled={isEditing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plugin Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., My POS System"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Brief description of the POS system..."
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Market Focus
            </label>
            <input
              type="text"
              value={formData.marketFocus}
              onChange={(e) => setFormData(prev => ({ ...prev, marketFocus: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Restaurants, Retail, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Authentication Type
            </label>
            <select
              value={formData.authType}
              onChange={(e) => setFormData(prev => ({ ...prev, authType: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="api_key">API Key</option>
              <option value="oauth">OAuth</option>
              <option value="basic_auth">Basic Auth</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Documentation URL
            </label>
            <input
              type="url"
              value={formData.documentationUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, documentationUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Version
            </label>
            <input
              type="text"
              value={formData.version}
              onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1.0.0"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            {isEditing ? 'Update Plugin' : 'Create Plugin'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">POS Plugin Manager</h1>
          <p className="text-gray-600">
            Manage POS system integrations without code changes
          </p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleImportConfig}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Config
          </button>
          
          <button
            onClick={handleAddPlugin}
            className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Plugin
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-800">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
          <span className="text-green-800">{success}</span>
          <button
            onClick={() => setSuccess(null)}
            className="ml-auto text-green-600 hover:text-green-800"
          >
            ×
          </button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading plugins...</p>
        </div>
      ) : showForm ? (
        renderForm()
      ) : (
        renderPluginList()
      )}
    </div>
  );
};

export default POSPluginManager;
