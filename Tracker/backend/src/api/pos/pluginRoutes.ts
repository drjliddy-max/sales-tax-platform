/**
 * Dynamic POS Plugin API Routes
 * Serves POS configurations and handles plugin management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth';
import POSPluginManager from '../../pos/plugins/POSPluginManager';
import { pluginConfigurations } from '../../pos/plugins/examples/pluginConfigurations';
import { posAdapter } from '../../lib/database/POSAdapter';

const router = express.Router();

// Initialize plugin manager (you'll need to pass your actual database connection)
let pluginManager: POSPluginManager;

// Initialize plugin manager with database
export const initializePluginManager = (database: any) => {
  pluginManager = new POSPluginManager(posAdapter);
  
  // Auto-register default plugins on startup
  Object.values(pluginConfigurations).forEach(async (config) => {
    await pluginManager.registerPlugin(config);
  });
};

/**
 * GET /api/pos/plugins/supported
 * Get all supported POS systems for frontend selection
 */
router.get('/supported', authenticateToken, async (req, res) => {
  try {
    const supportedSystems = pluginManager.getSupportedPOSSystems();
    
    res.json({
      success: true,
      supportedPOS: supportedSystems
    });
  } catch (error) {
    console.error('Error fetching supported POS systems:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch supported POS systems'
    });
  }
});

/**
 * GET /api/pos/plugins/:posId/config
 * Get configuration for a specific POS system
 */
router.get('/:posId/config', authenticateToken, async (req, res) => {
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
  } catch (error) {
    console.error(`Error fetching POS config for ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch POS configuration'
    });
  }
});

/**
 * GET /api/pos/plugins/:posId/fields
 * Get credential fields for a specific POS system
 */
router.get('/:posId/fields', authenticateToken, async (req, res) => {
  try {
    const { posId } = req.params;
    const fields = pluginManager.getCredentialFields(posId);
    
    res.json({
      success: true,
      fields
    });
  } catch (error) {
    console.error(`Error fetching fields for ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credential fields'
    });
  }
});

/**
 * GET /api/pos/plugins/:posId/oauth
 * Get OAuth configuration for a specific POS system
 */
router.get('/:posId/oauth', authenticateToken, async (req, res) => {
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
  } catch (error) {
    console.error(`Error fetching OAuth config for ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch OAuth configuration'
    });
  }
});

/**
 * POST /api/pos/plugins/:posId/test-connection
 * Test connection to a POS system with provided credentials
 */
router.post('/:posId/test-connection', authenticateToken, async (req, res) => {
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
  } catch (error) {
    console.error(`Error testing connection for ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connection'
    });
  }
});

/**
 * POST /api/pos/plugins/register
 * Register a new POS plugin (admin only)
 */
router.post('/register', authenticateToken, async (req, res) => {
  try {
    // Add admin check here
    // if (!req.user.isAdmin) { return res.status(403).json({ success: false, error: 'Admin access required' }); }
    
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
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to register plugin'
      });
    }
  } catch (error) {
    console.error('Error registering plugin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register plugin'
    });
  }
});

/**
 * GET /api/pos/plugins
 * Get all available plugins (admin only)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Add admin check here if needed
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
  } catch (error) {
    console.error('Error fetching plugins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch plugins'
    });
  }
});

/**
 * DELETE /api/pos/plugins/:posId
 * Remove a POS plugin (admin only)
 */
router.delete('/:posId', authenticateToken, async (req, res) => {
  try {
    // Add admin check here
    // if (!req.user.isAdmin) { return res.status(403).json({ success: false, error: 'Admin access required' }); }
    
    const { posId } = req.params;
    const success = await pluginManager.removePlugin(posId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Plugin removed successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to remove plugin'
      });
    }
  } catch (error) {
    console.error(`Error removing plugin ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove plugin'
    });
  }
});

/**
 * GET /api/pos/plugins/:posId/webhooks
 * Get webhook configuration for a POS system
 */
router.get('/:posId/webhooks', authenticateToken, async (req, res) => {
  try {
    const { posId } = req.params;
    const webhookConfig = pluginManager.getWebhookConfig(posId);
    
    res.json({
      success: true,
      webhookConfig: webhookConfig || null
    });
  } catch (error) {
    console.error(`Error fetching webhook config for ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch webhook configuration'
    });
  }
});

/**
 * GET /api/pos/plugins/:posId/endpoints
 * Get API endpoint configuration for a POS system
 */
router.get('/:posId/endpoints', authenticateToken, async (req, res) => {
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
  } catch (error) {
    console.error(`Error fetching endpoints for ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch endpoint configuration'
    });
  }
});

/**
 * GET /api/pos/plugins/:posId/data-mapping
 * Get data mapping configuration for a POS system
 */
router.get('/:posId/data-mapping', authenticateToken, async (req, res) => {
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
  } catch (error) {
    console.error(`Error fetching data mapping for ${req.params.posId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data mapping configuration'
    });
  }
});

export { router as pluginRoutes };
export default router;
