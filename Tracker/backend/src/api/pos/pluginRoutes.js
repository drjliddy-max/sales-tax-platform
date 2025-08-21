"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRoutes = exports.initializePluginManager = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const POSPluginManager_1 = __importDefault(require("../../pos/plugins/POSPluginManager"));
const pluginConfigurations_1 = require("../../pos/plugins/examples/pluginConfigurations");
const POSAdapter_1 = require("../../lib/database/POSAdapter");
const router = express_1.default.Router();
exports.pluginRoutes = router;
let pluginManager;
const initializePluginManager = (database) => {
    pluginManager = new POSPluginManager_1.default(POSAdapter_1.posAdapter);
    Object.values(pluginConfigurations_1.pluginConfigurations).forEach(async (config) => {
        await pluginManager.registerPlugin(config);
    });
};
exports.initializePluginManager = initializePluginManager;
router.get('/supported', auth_1.authenticateToken, async (req, res) => {
    try {
        const supportedSystems = pluginManager.getSupportedPOSSystems();
        res.json({
            success: true,
            supportedPOS: supportedSystems
        });
    }
    catch (error) {
        console.error('Error fetching supported POS systems:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch supported POS systems'
        });
    }
});
router.get('/:posId/config', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const plugin = pluginManager.getPlugin(posId);
        if (!plugin) {
            return res.status(404).json({
                success: false,
                error: 'POS system not found'
            });
        }
        res.json(plugin);
    }
    catch (error) {
        console.error(`Error fetching POS config for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch POS configuration'
        });
    }
});
router.get('/:posId/fields', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const fields = pluginManager.getCredentialFields(posId);
        res.json({
            success: true,
            fields
        });
    }
    catch (error) {
        console.error(`Error fetching fields for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch credential fields'
        });
    }
});
router.get('/:posId/oauth', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const oauthConfig = pluginManager.getOAuthConfig(posId);
        if (!oauthConfig) {
            return res.status(404).json({
                success: false,
                error: 'OAuth configuration not found for this POS system'
            });
        }
        res.json({
            success: true,
            oauthConfig
        });
    }
    catch (error) {
        console.error(`Error fetching OAuth config for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch OAuth configuration'
        });
    }
});
router.post('/:posId/test-connection', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const { credentials } = req.body;
        if (!credentials) {
            return res.status(400).json({
                success: false,
                error: 'Credentials are required'
            });
        }
        const result = await pluginManager.testConnection(posId, credentials);
        res.json(result);
    }
    catch (error) {
        console.error(`Error testing connection for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to test connection'
        });
    }
});
router.post('/register', auth_1.authenticateToken, async (req, res) => {
    try {
        const pluginConfig = req.body;
        if (!pluginConfig.id || !pluginConfig.name) {
            return res.status(400).json({
                success: false,
                error: 'Plugin must have id and name'
            });
        }
        const success = await pluginManager.registerPlugin(pluginConfig);
        if (success) {
            res.json({
                success: true,
                message: 'Plugin registered successfully',
                pluginId: pluginConfig.id
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to register plugin'
            });
        }
    }
    catch (error) {
        console.error('Error registering plugin:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register plugin'
        });
    }
});
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const plugins = pluginManager.getAvailablePlugins();
        res.json({
            success: true,
            plugins: plugins.map(plugin => ({
                id: plugin.id,
                name: plugin.name,
                description: plugin.description,
                version: plugin.version,
                lastUpdated: plugin.lastUpdated,
                authType: plugin.auth.type,
                features: plugin.features
            }))
        });
    }
    catch (error) {
        console.error('Error fetching plugins:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch plugins'
        });
    }
});
router.delete('/:posId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const success = await pluginManager.removePlugin(posId);
        if (success) {
            res.json({
                success: true,
                message: 'Plugin removed successfully'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to remove plugin'
            });
        }
    }
    catch (error) {
        console.error(`Error removing plugin ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove plugin'
        });
    }
});
router.get('/:posId/webhooks', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const webhookConfig = pluginManager.getWebhookConfig(posId);
        res.json({
            success: true,
            webhookConfig: webhookConfig || null
        });
    }
    catch (error) {
        console.error(`Error fetching webhook config for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch webhook configuration'
        });
    }
});
router.get('/:posId/endpoints', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const endpoints = pluginManager.getEndpoints(posId);
        if (!endpoints) {
            return res.status(404).json({
                success: false,
                error: 'Endpoint configuration not found'
            });
        }
        res.json({
            success: true,
            endpoints
        });
    }
    catch (error) {
        console.error(`Error fetching endpoints for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch endpoint configuration'
        });
    }
});
router.get('/:posId/data-mapping', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const dataMapping = pluginManager.getDataMapping(posId);
        if (!dataMapping) {
            return res.status(404).json({
                success: false,
                error: 'Data mapping configuration not found'
            });
        }
        res.json({
            success: true,
            dataMapping
        });
    }
    catch (error) {
        console.error(`Error fetching data mapping for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch data mapping configuration'
        });
    }
});
exports.default = router;
//# sourceMappingURL=pluginRoutes.js.map