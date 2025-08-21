"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posAdapter = exports.POSAdapter = void 0;
class POSAdapter {
    constructor() {
        this.posSystems = new Map();
        this.plugins = new Map();
    }
    async createPOSSystem(data) {
        try {
            const posSystem = {
                id: data.id,
                name: data.name,
                description: data.description || '',
                category: data.category || 'general',
                marketShare: data.marketShare || 0,
                logo: data.logo,
                website: data.website,
                supportedRegions: data.supportedRegions || [],
                pricing: data.pricing,
                verified: data.verified || false,
                status: data.status || 'active',
                clientContributed: data.clientContributed || false,
                contributedBy: data.contributedBy,
                lastUpdated: new Date().toISOString(),
                usageStats: {
                    clientsUsing: 0,
                    activeConnections: 0,
                    monthlyTransactions: 0,
                    ...data.usageStats
                },
                configuration: data.configuration
            };
            this.posSystems.set(data.id, posSystem);
            return true;
        }
        catch (error) {
            console.error('Error creating POS system:', error);
            return false;
        }
    }
    async getPOSSystem(id) {
        return this.posSystems.get(id) || null;
    }
    async getAllPOSSystems() {
        return Array.from(this.posSystems.values());
    }
    async updatePOSSystem(id, data) {
        try {
            const existing = this.posSystems.get(id);
            if (!existing)
                return false;
            const updated = {
                ...existing,
                ...data,
                lastUpdated: new Date().toISOString()
            };
            this.posSystems.set(id, updated);
            return true;
        }
        catch (error) {
            console.error('Error updating POS system:', error);
            return false;
        }
    }
    async deletePOSSystem(id) {
        return this.posSystems.delete(id);
    }
    async searchPOSSystems(query) {
        const searchTerm = query.toLowerCase();
        return Array.from(this.posSystems.values()).filter(pos => pos.name.toLowerCase().includes(searchTerm) ||
            pos.description?.toLowerCase().includes(searchTerm) ||
            pos.category?.toLowerCase().includes(searchTerm));
    }
    async getPOSSystemsByCategory(category) {
        return Array.from(this.posSystems.values()).filter(pos => pos.category === category);
    }
    async getPopularPOSSystems(limit = 20) {
        return Array.from(this.posSystems.values())
            .sort((a, b) => (b.marketShare || 0) - (a.marketShare || 0))
            .slice(0, limit);
    }
    async getRecentlyAddedPOS(limit = 10) {
        return Array.from(this.posSystems.values())
            .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
            .slice(0, limit);
    }
    async getClientContributedPOS() {
        return Array.from(this.posSystems.values()).filter(pos => pos.clientContributed);
    }
    async createPlugin(data) {
        try {
            this.plugins.set(data.id, { ...data, lastUpdated: new Date().toISOString() });
            return true;
        }
        catch (error) {
            console.error('Error creating plugin:', error);
            return false;
        }
    }
    async getPlugin(id) {
        return this.plugins.get(id) || null;
    }
    async getAllPlugins() {
        return Array.from(this.plugins.values());
    }
    async updatePlugin(id, data) {
        try {
            const existing = this.plugins.get(id);
            if (!existing)
                return false;
            const updated = {
                ...existing,
                ...data,
                lastUpdated: new Date().toISOString()
            };
            this.plugins.set(id, updated);
            return true;
        }
        catch (error) {
            console.error('Error updating plugin:', error);
            return false;
        }
    }
    async deletePlugin(id) {
        return this.plugins.delete(id);
    }
    async getRegistryStats() {
        const allSystems = Array.from(this.posSystems.values());
        const allPlugins = Array.from(this.plugins.values());
        return {
            totalSystems: allSystems.length,
            verifiedSystems: allSystems.filter(pos => pos.verified).length,
            clientContributedSystems: allSystems.filter(pos => pos.clientContributed).length,
            totalPlugins: allPlugins.length,
            categories: [...new Set(allSystems.map(pos => pos.category))],
            totalActiveConnections: allSystems.reduce((sum, pos) => sum + pos.usageStats.activeConnections, 0),
            totalClients: allSystems.reduce((sum, pos) => sum + pos.usageStats.clientsUsing, 0)
        };
    }
    async initializeDefaults() {
        const defaultSystems = [
            {
                id: 'square',
                name: 'Square',
                description: 'All-in-one payment and business management platform',
                category: 'popular',
                marketShare: 15.2,
                logo: 'https://logo.clearbit.com/squareup.com',
                website: 'https://squareup.com',
                supportedRegions: ['US', 'CA', 'AU', 'GB'],
                pricing: { model: 'transaction_fee', rate: '2.6% + $0.10' },
                verified: true,
                status: 'active',
                clientContributed: false,
                usageStats: { clientsUsing: 150, activeConnections: 89 }
            },
            {
                id: 'shopify_pos',
                name: 'Shopify POS',
                description: 'Unified commerce platform for online and retail',
                category: 'retail',
                marketShare: 12.8,
                logo: 'https://logo.clearbit.com/shopify.com',
                website: 'https://pos.shopify.com',
                supportedRegions: ['US', 'CA', 'AU', 'GB', 'IE'],
                pricing: { model: 'subscription', starting_at: '$29/month' },
                verified: true,
                status: 'active',
                clientContributed: false,
                usageStats: { clientsUsing: 120, activeConnections: 67 }
            },
            {
                id: 'toast_pos',
                name: 'Toast POS',
                description: 'Restaurant management and POS system',
                category: 'restaurant',
                marketShare: 8.5,
                logo: 'https://logo.clearbit.com/toasttab.com',
                website: 'https://pos.toasttab.com',
                supportedRegions: ['US'],
                pricing: { model: 'subscription', starting_at: '$69/month' },
                verified: true,
                status: 'active',
                clientContributed: false,
                usageStats: { clientsUsing: 85, activeConnections: 54 }
            }
        ];
        for (const system of defaultSystems) {
            if (!this.posSystems.has(system.id)) {
                await this.createPOSSystem(system);
            }
        }
        console.log('✅ POS Registry initialized with default systems');
    }
}
exports.POSAdapter = POSAdapter;
exports.posAdapter = new POSAdapter();
//# sourceMappingURL=POSAdapter.js.map