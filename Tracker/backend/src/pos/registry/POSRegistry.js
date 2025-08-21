"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POSRegistry = void 0;
const events_1 = require("events");
class POSRegistry extends events_1.EventEmitter {
    constructor(database) {
        super();
        this.registry = new Map();
        this.popularThreshold = 10;
        this.database = database;
        this.initializeRegistry();
    }
    async initializeRegistry() {
        try {
            const entries = await this.database.collection('pos_registry').find().toArray();
            for (const entry of entries) {
                this.registry.set(entry.id, {
                    ...entry,
                    lastUpdated: new Date(entry.lastUpdated)
                });
            }
            await this.addPopularPOSSystems();
            console.log(`POS Registry initialized with ${this.registry.size} systems`);
            this.emit('registry_initialized', this.registry.size);
        }
        catch (error) {
            console.error('Failed to initialize POS registry:', error);
        }
    }
    async addPopularPOSSystems() {
        const popularSystems = [
            {
                id: 'square',
                name: 'Square POS',
                description: 'Popular POS system for small to medium businesses',
                category: 'popular',
                marketShare: 'high',
                popularity: 1000,
                clientContributed: false,
                verified: true,
                status: 'active',
                logo: 'https://squareup.com/us/en/press/square-logo.png',
                website: 'https://squareup.com',
                supportedRegions: ['US', 'CA', 'AU', 'GB', 'JP'],
                pricing: 'freemium'
            },
            {
                id: 'shopify',
                name: 'Shopify POS',
                description: 'E-commerce and retail POS solution',
                category: 'popular',
                marketShare: 'high',
                popularity: 800,
                clientContributed: false,
                verified: true,
                status: 'active',
                logo: 'https://cdn.shopify.com/assets/images/logos/shopify-bag.png',
                website: 'https://www.shopify.com/pos',
                supportedRegions: ['US', 'CA', 'AU', 'GB', 'DE', 'FR', 'NL', 'BE', 'IE', 'IT', 'ES', 'PT', 'DK', 'SE', 'NO', 'FI'],
                pricing: 'paid'
            },
            {
                id: 'clover',
                name: 'Clover POS',
                description: 'Advanced POS for restaurants and retail',
                category: 'popular',
                marketShare: 'medium',
                popularity: 600,
                clientContributed: false,
                verified: true,
                status: 'active',
                logo: 'https://www.clover.com/assets/images/clover-logo.png',
                website: 'https://www.clover.com',
                supportedRegions: ['US'],
                pricing: 'paid'
            },
            {
                id: 'toast',
                name: 'Toast POS',
                description: 'Restaurant-focused POS system',
                category: 'restaurant',
                marketShare: 'medium',
                popularity: 400,
                clientContributed: false,
                verified: true,
                status: 'active',
                website: 'https://pos.toasttab.com',
                supportedRegions: ['US', 'CA'],
                pricing: 'paid'
            },
            {
                id: 'lightspeed_retail',
                name: 'Lightspeed Retail',
                description: 'Cloud-based retail POS system',
                category: 'retail',
                marketShare: 'medium',
                popularity: 350,
                clientContributed: false,
                verified: false,
                status: 'beta',
                website: 'https://www.lightspeedhq.com/pos/retail/',
                supportedRegions: ['US', 'CA', 'EU'],
                pricing: 'paid'
            },
            {
                id: 'lightspeed_restaurant',
                name: 'Lightspeed Restaurant',
                description: 'Full-service restaurant POS',
                category: 'restaurant',
                marketShare: 'medium',
                popularity: 250,
                clientContributed: false,
                verified: false,
                status: 'beta',
                website: 'https://www.lightspeedhq.com/pos/restaurant/',
                supportedRegions: ['US', 'CA', 'EU'],
                pricing: 'paid'
            },
            {
                id: 'revel',
                name: 'Revel Systems',
                description: 'Enterprise POS for restaurants and retail',
                category: 'enterprise',
                marketShare: 'medium',
                popularity: 200,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://revelsystems.com',
                supportedRegions: ['US', 'CA', 'UK', 'AU'],
                pricing: 'enterprise'
            },
            {
                id: 'micros',
                name: 'Oracle MICROS',
                description: 'Enterprise hospitality POS system',
                category: 'enterprise',
                marketShare: 'medium',
                popularity: 180,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://www.oracle.com/industries/food-beverage/micros/',
                supportedRegions: ['US', 'CA', 'EU', 'APAC'],
                pricing: 'enterprise'
            },
            {
                id: 'aloha',
                name: 'NCR Aloha',
                description: 'Restaurant POS system',
                category: 'restaurant',
                marketShare: 'medium',
                popularity: 150,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://www.ncr.com/restaurants/aloha-pos',
                supportedRegions: ['US', 'CA'],
                pricing: 'paid'
            },
            {
                id: 'vend',
                name: 'Vend POS',
                description: 'Cloud-based retail POS',
                category: 'retail',
                marketShare: 'medium',
                popularity: 120,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://www.vendhq.com',
                supportedRegions: ['US', 'CA', 'AU', 'NZ', 'GB'],
                pricing: 'paid'
            },
            {
                id: 'pos_nation',
                name: 'POS Nation',
                description: 'Retail and restaurant POS',
                category: 'popular',
                marketShare: 'low',
                popularity: 100,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://posnation.com',
                supportedRegions: ['US'],
                pricing: 'paid'
            },
            {
                id: 'quickbooks_pos',
                name: 'QuickBooks POS',
                description: 'Small business POS system',
                category: 'retail',
                marketShare: 'low',
                popularity: 90,
                clientContributed: false,
                verified: false,
                status: 'deprecated',
                website: 'https://quickbooks.intuit.com/pos/',
                supportedRegions: ['US'],
                pricing: 'paid'
            },
            {
                id: 'loyverse',
                name: 'Loyverse POS',
                description: 'Free POS for small businesses',
                category: 'mobile',
                marketShare: 'low',
                popularity: 80,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://loyverse.com',
                supportedRegions: ['GLOBAL'],
                pricing: 'free'
            },
            {
                id: 'stripe_terminal',
                name: 'Stripe Terminal',
                description: 'In-person payment processing',
                category: 'specialty',
                marketShare: 'medium',
                popularity: 75,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://stripe.com/terminal',
                supportedRegions: ['US', 'CA', 'EU', 'AU', 'SG'],
                pricing: 'paid'
            },
            {
                id: 'touchbistro',
                name: 'TouchBistro',
                description: 'iPad POS for restaurants',
                category: 'restaurant',
                marketShare: 'low',
                popularity: 70,
                clientContributed: false,
                verified: false,
                status: 'active',
                website: 'https://www.touchbistro.com',
                supportedRegions: ['US', 'CA'],
                pricing: 'paid'
            }
        ];
        for (const system of popularSystems) {
            if (!this.registry.has(system.id)) {
                const entry = {
                    ...system,
                    lastUpdated: new Date(),
                    usageStats: {
                        activeConnections: 0,
                        monthlyTransactions: 0,
                        clientsUsing: 0
                    }
                };
                await this.addToRegistry(entry);
            }
        }
    }
    async addToRegistry(entry) {
        try {
            await this.database.collection('pos_registry').replaceOne({ id: entry.id }, { ...entry, lastUpdated: new Date() }, { upsert: true });
            this.registry.set(entry.id, entry);
            this.emit('pos_added', entry.id);
            console.log(`Added POS system to registry: ${entry.name}`);
            return true;
        }
        catch (error) {
            console.error(`Failed to add POS system ${entry.id}:`, error);
            return false;
        }
    }
    async registerClientPOS(posData, contributedBy, configuration) {
        if (!posData.id || !posData.name) {
            throw new Error('POS system must have id and name');
        }
        const entry = {
            id: posData.id,
            name: posData.name,
            description: posData.description || `${posData.name} POS system`,
            category: posData.category || 'specialty',
            marketShare: 'low',
            popularity: 1,
            clientContributed: true,
            verified: false,
            status: 'beta',
            logo: posData.logo,
            website: posData.website,
            supportedRegions: posData.supportedRegions || ['US'],
            pricing: posData.pricing || 'paid',
            lastUpdated: new Date(),
            contributedBy,
            configuration,
            usageStats: {
                activeConnections: 1,
                monthlyTransactions: 0,
                clientsUsing: 1
            }
        };
        return await this.addToRegistry(entry);
    }
    getPOSByCategory(category) {
        const systems = Array.from(this.registry.values());
        if (category) {
            return systems.filter(pos => pos.category === category);
        }
        return systems.sort((a, b) => b.popularity - a.popularity);
    }
    getPopularPOS() {
        return Array.from(this.registry.values())
            .filter(pos => pos.usageStats.clientsUsing >= this.popularThreshold)
            .sort((a, b) => b.popularity - a.popularity);
    }
    getRecentlyAdded(limit = 10) {
        return Array.from(this.registry.values())
            .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
            .slice(0, limit);
    }
    getClientContributed() {
        return Array.from(this.registry.values())
            .filter(pos => pos.clientContributed)
            .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
    }
    searchPOS(query) {
        const lowercaseQuery = query.toLowerCase();
        return Array.from(this.registry.values())
            .filter(pos => pos.name.toLowerCase().includes(lowercaseQuery) ||
            pos.description.toLowerCase().includes(lowercaseQuery) ||
            pos.category.toLowerCase().includes(lowercaseQuery))
            .sort((a, b) => b.popularity - a.popularity);
    }
    async updateUsageStats(posId, stats) {
        const entry = this.registry.get(posId);
        if (!entry)
            return false;
        entry.usageStats = { ...entry.usageStats, ...stats };
        entry.popularity = entry.usageStats.clientsUsing * 10 + Math.floor(entry.usageStats.monthlyTransactions / 1000);
        if (entry.usageStats.clientsUsing >= 50) {
            entry.marketShare = 'high';
        }
        else if (entry.usageStats.clientsUsing >= 20) {
            entry.marketShare = 'medium';
        }
        await this.database.collection('pos_registry').updateOne({ id: posId }, { $set: { usageStats: entry.usageStats, popularity: entry.popularity, marketShare: entry.marketShare } });
        return true;
    }
    async verifyPOS(posId) {
        const entry = this.registry.get(posId);
        if (!entry)
            return false;
        entry.verified = true;
        entry.status = 'active';
        await this.database.collection('pos_registry').updateOne({ id: posId }, { $set: { verified: true, status: 'active' } });
        this.emit('pos_verified', posId);
        return true;
    }
    getPOS(posId) {
        return this.registry.get(posId) || null;
    }
    getRegistryStats() {
        const systems = Array.from(this.registry.values());
        return {
            totalSystems: systems.length,
            verifiedSystems: systems.filter(pos => pos.verified).length,
            clientContributed: systems.filter(pos => pos.clientContributed).length,
            popularSystems: systems.filter(pos => pos.usageStats.clientsUsing >= this.popularThreshold).length,
            categories: {
                popular: systems.filter(pos => pos.category === 'popular').length,
                restaurant: systems.filter(pos => pos.category === 'restaurant').length,
                retail: systems.filter(pos => pos.category === 'retail').length,
                enterprise: systems.filter(pos => pos.category === 'enterprise').length,
                mobile: systems.filter(pos => pos.category === 'mobile').length,
                specialty: systems.filter(pos => pos.category === 'specialty').length
            },
            totalActiveConnections: systems.reduce((sum, pos) => sum + pos.usageStats.activeConnections, 0),
            totalMonthlyTransactions: systems.reduce((sum, pos) => sum + pos.usageStats.monthlyTransactions, 0)
        };
    }
    exportRegistry() {
        return Array.from(this.registry.values());
    }
}
exports.POSRegistry = POSRegistry;
exports.default = POSRegistry;
//# sourceMappingURL=POSRegistry.js.map