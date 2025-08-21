"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSPluginManager = void 0;
const events_1 = require("events");
class POSPluginManager extends events_1.EventEmitter {
    constructor(database) {
        super();
        this.plugins = new Map();
        this.database = database;
        this.loadPluginsFromDatabase();
    }
    async loadPluginsFromDatabase() {
        try {
            const plugins = await this.database.collection('pos_plugins').find({ active: true }).toArray();
            for (const pluginData of plugins) {
                const plugin = {
                    ...pluginData,
                    lastUpdated: new Date(pluginData.lastUpdated)
                };
                this.plugins.set(plugin.id, plugin);
            }
            console.log(`Loaded ${plugins.length} POS plugins`);
            this.emit('plugins_loaded', Array.from(this.plugins.keys()));
        }
        catch (error) {
            console.error('Failed to load POS plugins:', error);
        }
    }
    async registerPlugin(pluginConfig) {
        try {
            this.validatePluginConfig(pluginConfig);
            await this.database.collection('pos_plugins').replaceOne({ id: pluginConfig.id }, { ...pluginConfig, active: true, createdAt: new Date() }, { upsert: true });
            this.plugins.set(pluginConfig.id, pluginConfig);
            this.emit('plugin_registered', pluginConfig.id);
            console.log(`Registered POS plugin: ${pluginConfig.name}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to register plugin ${pluginConfig.id}:`, error);
            return false;
        }
    }
    getAvailablePlugins() {
        return Array.from(this.plugins.values());
    }
    getPlugin(posId) {
        return this.plugins.get(posId) || null;
    }
    getSupportedPOSSystems() {
        return Array.from(this.plugins.values()).map(plugin => ({
            id: plugin.id,
            name: plugin.name,
            description: plugin.description,
            authMethod: plugin.auth.type,
            features: Object.keys(plugin.features).filter(key => plugin.features[key]),
            marketFocus: plugin.marketFocus,
            logo: plugin.logo
        }));
    }
    getCredentialFields(posId) {
        const plugin = this.plugins.get(posId);
        return plugin ? plugin.fields : [];
    }
    getOAuthConfig(posId) {
        const plugin = this.plugins.get(posId);
        return plugin?.auth.type === 'oauth' ? plugin.auth.oauthConfig : null;
    }
    getWebhookConfig(posId) {
        const plugin = this.plugins.get(posId);
        return plugin?.webhooks || null;
    }
    getEndpoints(posId) {
        const plugin = this.plugins.get(posId);
        return plugin?.endpoints || null;
    }
    getDataMapping(posId) {
        const plugin = this.plugins.get(posId);
        return plugin?.dataMapping || null;
    }
    async testConnection(posId, credentials) {
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
        }
        catch (error) {
            return {
                success: false,
                message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async removePlugin(posId) {
        try {
            await this.database.collection('pos_plugins').updateOne({ id: posId }, { $set: { active: false, deletedAt: new Date() } });
            this.plugins.delete(posId);
            this.emit('plugin_removed', posId);
            return true;
        }
        catch (error) {
            console.error(`Failed to remove plugin ${posId}:`, error);
            return false;
        }
    }
    validatePluginConfig(config) {
        if (!config.id || !config.name) {
            throw new Error('Plugin must have id and name');
        }
        if (!config.auth || !config.endpoints || !config.dataMapping) {
            throw new Error('Plugin must have auth, endpoints, and dataMapping configuration');
        }
    }
    buildEndpointUrl(baseUrl, endpoint, credentials) {
        let url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
        Object.keys(credentials).forEach(key => {
            url = url.replace(`{${key}}`, encodeURIComponent(credentials[key]));
        });
        return url;
    }
    buildHeaders(plugin, credentials) {
        const headers = {
            'Content-Type': 'application/json'
        };
        const authValue = this.buildAuthValue(plugin, credentials);
        if (authValue) {
            headers[plugin.endpoints.authHeader] = authValue;
        }
        return headers;
    }
    buildAuthValue(plugin, credentials) {
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
exports.POSPluginManager = POSPluginManager;
exports.default = POSPluginManager;
//# sourceMappingURL=POSPluginManager.js.map