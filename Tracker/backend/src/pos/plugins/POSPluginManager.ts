/**
 * Dynamic POS Plugin Manager
 * Allows adding new POS systems through configuration without code changes
 */

import { EventEmitter } from 'events';

export interface POSFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'select';
  required: boolean;
  placeholder: string;
  helpText?: string;
  validation?: string; // RegExp pattern as string
  options?: { value: string; label: string; }[]; // For select fields
}

export interface POSAuthConfig {
  type: 'oauth' | 'api_key' | 'basic_auth';
  oauthConfig?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientIdField: string;
    clientSecretField: string;
    redirectUriRequired: boolean;
    additionalParams?: { [key: string]: string };
  };
}

export interface POSWebhookConfig {
  supportedEvents: string[];
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha1' | 'md5';
  secretField?: string; // Field name for webhook secret
  payloadFormat: 'json' | 'form' | 'xml';
}

export interface POSEndpointConfig {
  baseUrl: string;
  authHeader: 'Authorization' | 'X-API-Key' | 'Bearer' | string;
  authPrefix?: string; // e.g., "Bearer ", "Token "
  endpoints: {
    test: string; // Test connection endpoint
    locations: string;
    transactions: string;
    webhooks?: {
      list: string;
      create: string;
      delete: string;
    };
  };
  requestFormat?: {
    dateFormat: string; // e.g., "YYYY-MM-DD", "ISO"
    timeZone?: string;
    pagination?: {
      limitParam: string;
      offsetParam: string;
      maxLimit: number;
    };
  };
}

export interface POSDataMapping {
  transaction: {
    id: string;
    timestamp: string;
    totalAmount: string;
    totalTax: string;
    items: string;
    location: string;
    customer?: string;
  };
  location: {
    id: string;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
}

export interface POSPluginConfig {
  id: string;
  name: string;
  description: string;
  marketFocus: string;
  logo?: string;
  documentationUrl?: string;
  supportUrl?: string;
  version: string;
  lastUpdated: Date;
  
  // Configuration
  auth: POSAuthConfig;
  fields: POSFieldConfig[];
  endpoints: POSEndpointConfig;
  webhooks?: POSWebhookConfig;
  dataMapping: POSDataMapping;
  
  // Setup instructions
  instructions: string[];
  
  // Validation and testing
  connectionTest: {
    endpoint: string;
    method: 'GET' | 'POST';
    expectedStatus: number;
    expectedFields?: string[]; // Fields that should exist in response
  };
  
  // Feature support
  features: {
    realTimeSync: boolean;
    historicalSync: boolean;
    webhooksSupported: boolean;
    multiLocationSupport: boolean;
    taxDetailsSupported: boolean;
  };
}

export class POSPluginManager extends EventEmitter {
  private plugins: Map<string, POSPluginConfig> = new Map();
  private database: any; // Replace with your DB connection

  constructor(database: any) {
    super();
    this.database = database;
    this.loadPluginsFromDatabase();
  }

  /**
   * Load POS plugins from database on startup
   */
  private async loadPluginsFromDatabase() {
    try {
      const plugins = await this.database.collection('pos_plugins').find({ active: true }).toArray();
      
      for (const pluginData of plugins) {
        const plugin: POSPluginConfig = {
          ...pluginData,
          lastUpdated: new Date(pluginData.lastUpdated)
        };
        this.plugins.set(plugin.id, plugin);
      }
      
      console.log(`Loaded ${plugins.length} POS plugins`);
      this.emit('plugins_loaded', Array.from(this.plugins.keys()));
    } catch (error) {
      console.error('Failed to load POS plugins:', error);
    }
  }

  /**
   * Register a new POS plugin (can be done via API)
   */
  async registerPlugin(pluginConfig: POSPluginConfig): Promise<boolean> {
    try {
      // Validate plugin configuration
      this.validatePluginConfig(pluginConfig);
      
      // Save to database
      await this.database.collection('pos_plugins').replaceOne(
        { id: pluginConfig.id },
        { ...pluginConfig, active: true, createdAt: new Date() },
        { upsert: true }
      );
      
      // Add to memory
      this.plugins.set(pluginConfig.id, pluginConfig);
      
      this.emit('plugin_registered', pluginConfig.id);
      console.log(`Registered POS plugin: ${pluginConfig.name}`);
      
      return true;
    } catch (error) {
      console.error(`Failed to register plugin ${pluginConfig.id}:`, error);
      return false;
    }
  }

  /**
   * Get all available POS plugins
   */
  getAvailablePlugins(): POSPluginConfig[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get specific POS plugin by ID
   */
  getPlugin(posId: string): POSPluginConfig | null {
    return this.plugins.get(posId) || null;
  }

  /**
   * Get supported POS systems for frontend
   */
  getSupportedPOSSystems() {
    return Array.from(this.plugins.values()).map(plugin => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.description,
      authMethod: plugin.auth.type,
      features: Object.keys(plugin.features).filter(key => plugin.features[key as keyof typeof plugin.features]),
      marketFocus: plugin.marketFocus,
      logo: plugin.logo
    }));
  }

  /**
   * Get credential fields for a specific POS system
   */
  getCredentialFields(posId: string): POSFieldConfig[] {
    const plugin = this.plugins.get(posId);
    return plugin ? plugin.fields : [];
  }

  /**
   * Get OAuth configuration for a POS system
   */
  getOAuthConfig(posId: string) {
    const plugin = this.plugins.get(posId);
    return plugin?.auth.type === 'oauth' ? plugin.auth.oauthConfig : null;
  }

  /**
   * Get webhook configuration for a POS system
   */
  getWebhookConfig(posId: string) {
    const plugin = this.plugins.get(posId);
    return plugin?.webhooks || null;
  }

  /**
   * Get API endpoints for a POS system
   */
  getEndpoints(posId: string) {
    const plugin = this.plugins.get(posId);
    return plugin?.endpoints || null;
  }

  /**
   * Get data mapping configuration for a POS system
   */
  getDataMapping(posId: string) {
    const plugin = this.plugins.get(posId);
    return plugin?.dataMapping || null;
  }

  /**
   * Test connection to a POS system
   */
  async testConnection(posId: string, credentials: { [key: string]: string }): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const plugin = this.plugins.get(posId);
    if (!plugin) {
      return { success: false, message: 'POS system not found' };
    }

    try {
      const endpoint = this.buildEndpointUrl(plugin.endpoints.baseUrl, plugin.connectionTest.endpoint, credentials);
      const headers = this.buildHeaders(plugin, credentials);

      const response = await fetch(endpoint, {
        method: plugin.connectionTest.method,
        headers
      });

      const success = response.status === plugin.connectionTest.expectedStatus;
      const responseData = await response.json().catch(() => ({}));

      return {
        success,
        message: success ? 'Connection successful' : `Connection failed (Status: ${response.status})`,
        details: responseData
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Remove a plugin
   */
  async removePlugin(posId: string): Promise<boolean> {
    try {
      await this.database.collection('pos_plugins').updateOne(
        { id: posId },
        { $set: { active: false, deletedAt: new Date() } }
      );
      
      this.plugins.delete(posId);
      this.emit('plugin_removed', posId);
      
      return true;
    } catch (error) {
      console.error(`Failed to remove plugin ${posId}:`, error);
      return false;
    }
  }

  private validatePluginConfig(config: POSPluginConfig) {
    if (!config.id || !config.name) {
      throw new Error('Plugin must have id and name');
    }

    if (!config.auth || !config.endpoints || !config.dataMapping) {
      throw new Error('Plugin must have auth, endpoints, and dataMapping configuration');
    }

    // Additional validation logic...
  }

  private buildEndpointUrl(baseUrl: string, endpoint: string, credentials: { [key: string]: string }): string {
    let url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
    
    // Replace placeholders in URL
    Object.keys(credentials).forEach(key => {
      url = url.replace(`{${key}}`, encodeURIComponent(credentials[key]));
    });
    
    return url;
  }

  private buildHeaders(plugin: POSPluginConfig, credentials: { [key: string]: string }): { [key: string]: string } {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json'
    };

    // Add authentication header
    const authValue = this.buildAuthValue(plugin, credentials);
    if (authValue) {
      headers[plugin.endpoints.authHeader] = authValue;
    }

    return headers;
  }

  private buildAuthValue(plugin: POSPluginConfig, credentials: { [key: string]: string }): string {
    const prefix = plugin.endpoints.authPrefix || '';
    
    switch (plugin.auth.type) {
      case 'api_key':
        const apiKeyField = plugin.fields.find(f => f.type === 'password' || f.name === 'apiKey');
        return apiKeyField ? `${prefix}${credentials[apiKeyField.name]}` : '';
        
      case 'basic_auth':
        const username = credentials.username || '';
        const password = credentials.password || '';
        return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        
      case 'oauth':
        return `${prefix}${credentials.accessToken || ''}`;
        
      default:
        return '';
    }
  }
}

export default POSPluginManager;
