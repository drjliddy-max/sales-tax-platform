"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registryRoutes = exports.initializePOSRegistry = void 0;
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const POSRegistry_1 = __importDefault(require("../../pos/registry/POSRegistry"));
const POSAdapter_1 = require("../../lib/database/POSAdapter");
const router = express_1.default.Router();
exports.registryRoutes = router;
let posRegistry;
const initializePOSRegistry = (database) => {
    posRegistry = new POSRegistry_1.default(POSAdapter_1.posAdapter);
};
exports.initializePOSRegistry = initializePOSRegistry;
router.get('/popular', async (req, res) => {
    try {
        const popularSystems = posRegistry.getPopularPOS();
        res.json({
            success: true,
            systems: popularSystems.map(pos => ({
                id: pos.id,
                name: pos.name,
                description: pos.description,
                category: pos.category,
                marketShare: pos.marketShare,
                logo: pos.logo,
                website: pos.website,
                pricing: pos.pricing,
                verified: pos.verified,
                status: pos.status,
                usageStats: {
                    clientsUsing: pos.usageStats.clientsUsing,
                    activeConnections: pos.usageStats.activeConnections
                }
            }))
        });
    }
    catch (error) {
        console.error('Error fetching popular POS systems:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch popular POS systems'
        });
    }
});
router.get('/categories', async (req, res) => {
    try {
        const categories = {
            popular: posRegistry.getPOSByCategory('popular'),
            restaurant: posRegistry.getPOSByCategory('restaurant'),
            retail: posRegistry.getPOSByCategory('retail'),
            enterprise: posRegistry.getPOSByCategory('enterprise'),
            mobile: posRegistry.getPOSByCategory('mobile'),
            specialty: posRegistry.getPOSByCategory('specialty')
        };
        const formattedCategories = Object.entries(categories).reduce((acc, [category, systems]) => {
            acc[category] = systems.map(pos => ({
                id: pos.id,
                name: pos.name,
                description: pos.description,
                logo: pos.logo,
                website: pos.website,
                verified: pos.verified,
                status: pos.status,
                pricing: pos.pricing,
                supportedRegions: pos.supportedRegions,
                clientsUsing: pos.usageStats.clientsUsing
            }));
            return acc;
        }, {});
        res.json({
            success: true,
            categories: formattedCategories
        });
    }
    catch (error) {
        console.error('Error fetching POS categories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch POS categories'
        });
    }
});
router.get('/search', async (req, res) => {
    try {
        const { q: query } = req.query;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        const searchResults = posRegistry.searchPOS(query);
        res.json({
            success: true,
            results: searchResults.map(pos => ({
                id: pos.id,
                name: pos.name,
                description: pos.description,
                category: pos.category,
                logo: pos.logo,
                website: pos.website,
                verified: pos.verified,
                status: pos.status,
                pricing: pos.pricing,
                clientsUsing: pos.usageStats.clientsUsing
            }))
        });
    }
    catch (error) {
        console.error('Error searching POS systems:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search POS systems'
        });
    }
});
router.get('/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const recentSystems = posRegistry.getRecentlyAdded(limit);
        res.json({
            success: true,
            systems: recentSystems.map(pos => ({
                id: pos.id,
                name: pos.name,
                description: pos.description,
                category: pos.category,
                logo: pos.logo,
                verified: pos.verified,
                status: pos.status,
                clientContributed: pos.clientContributed,
                contributedBy: pos.contributedBy,
                lastUpdated: pos.lastUpdated
            }))
        });
    }
    catch (error) {
        console.error('Error fetching recent POS systems:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent POS systems'
        });
    }
});
router.get('/client-contributed', auth_1.authenticateToken, async (req, res) => {
    try {
        const clientSystems = posRegistry.getClientContributed();
        res.json({
            success: true,
            systems: clientSystems.map(pos => ({
                id: pos.id,
                name: pos.name,
                description: pos.description,
                category: pos.category,
                verified: pos.verified,
                status: pos.status,
                contributedBy: pos.contributedBy,
                lastUpdated: pos.lastUpdated,
                usageStats: pos.usageStats
            }))
        });
    }
    catch (error) {
        console.error('Error fetching client-contributed POS systems:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch client-contributed POS systems'
        });
    }
});
router.post('/contribute', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id, name, description, category, website, logo, supportedRegions, pricing, configuration } = req.body;
        if (!id || !name) {
            return res.status(400).json({
                success: false,
                error: 'POS system ID and name are required'
            });
        }
        const existing = posRegistry.getPOS(id);
        if (existing) {
            return res.status(409).json({
                success: false,
                error: 'A POS system with this ID already exists'
            });
        }
        const contributedBy = req.user?.email || req.user?.id || 'anonymous';
        const success = await posRegistry.registerClientPOS({
            id,
            name,
            description,
            category,
            website,
            logo,
            supportedRegions,
            pricing
        }, contributedBy, configuration);
        if (success) {
            res.json({
                success: true,
                message: 'POS system contributed successfully',
                posId: id,
                status: 'pending_verification'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to register POS system'
            });
        }
    }
    catch (error) {
        console.error('Error contributing POS system:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to contribute POS system'
        });
    }
});
router.get('/:posId', async (req, res) => {
    try {
        const { posId } = req.params;
        const pos = posRegistry.getPOS(posId);
        if (!pos) {
            return res.status(404).json({
                success: false,
                error: 'POS system not found'
            });
        }
        res.json({
            success: true,
            pos: {
                id: pos.id,
                name: pos.name,
                description: pos.description,
                category: pos.category,
                marketShare: pos.marketShare,
                logo: pos.logo,
                website: pos.website,
                supportedRegions: pos.supportedRegions,
                pricing: pos.pricing,
                verified: pos.verified,
                status: pos.status,
                clientContributed: pos.clientContributed,
                contributedBy: pos.contributedBy,
                lastUpdated: pos.lastUpdated,
                usageStats: pos.usageStats,
                hasConfiguration: !!pos.configuration
            }
        });
    }
    catch (error) {
        console.error(`Error fetching POS system ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch POS system details'
        });
    }
});
router.post('/:posId/verify', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const success = await posRegistry.verifyPOS(posId);
        if (success) {
            res.json({
                success: true,
                message: 'POS system verified successfully'
            });
        }
        else {
            res.status(404).json({
                success: false,
                error: 'POS system not found'
            });
        }
    }
    catch (error) {
        console.error(`Error verifying POS system ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify POS system'
        });
    }
});
router.get('/registry/stats', auth_1.authenticateToken, async (req, res) => {
    try {
        const stats = posRegistry.getRegistryStats();
        res.json({
            success: true,
            stats
        });
    }
    catch (error) {
        console.error('Error fetching registry stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch registry statistics'
        });
    }
});
router.put('/:posId/usage', auth_1.authenticateToken, async (req, res) => {
    try {
        const { posId } = req.params;
        const { activeConnections, monthlyTransactions, clientsUsing } = req.body;
        const success = await posRegistry.updateUsageStats(posId, {
            activeConnections,
            monthlyTransactions,
            clientsUsing
        });
        if (success) {
            res.json({
                success: true,
                message: 'Usage statistics updated successfully'
            });
        }
        else {
            res.status(404).json({
                success: false,
                error: 'POS system not found'
            });
        }
    }
    catch (error) {
        console.error(`Error updating usage stats for ${req.params.posId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to update usage statistics'
        });
    }
});
router.get('/export', auth_1.authenticateToken, async (req, res) => {
    try {
        const registryData = posRegistry.exportRegistry();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="pos-registry.json"');
        res.json(registryData);
    }
    catch (error) {
        console.error('Error exporting registry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export registry'
        });
    }
});
exports.default = router;
//# sourceMappingURL=registryRoutes.js.map