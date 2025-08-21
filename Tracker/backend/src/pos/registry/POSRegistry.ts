/**
 * POS System Registry
 * Maintains a comprehensive list of known POS systems with their configurations
 * Supports both built-in and client-contributed POS systems
 */

import { EventEmitter } from 'events';
import { POSPluginConfig } from '../plugins/POSPluginManager';

export interface POSRegistryEntry {
  id: string;
  name: string;
  description: string;
  category: 'popular' | 'restaurant' | 'retail' | 'enterprise' | 'mobile' | 'specialty';
  marketShare: 'high' | 'medium' | 'low';
  popularity: number; // Usage count by clients
  clientContributed: boolean;
  verified: boolean; // Verified by our team
  status: 'active' | 'deprecated' | 'beta';
  logo?: string;
  website?: string;
  supportedRegions: string[]; // ISO country codes
  pricing: 'free' | 'paid' | 'freemium' | 'enterprise';
  lastUpdated: Date;
  contributedBy?: string; // Client/user who contributed
  configuration?: POSPluginConfig;
  usageStats: {
    activeConnections: number;
    monthlyTransactions: number;
    clientsUsing: number;
  };
}

export class POSRegistry extends EventEmitter {
  private registry: Map<string, POSRegistryEntry> = new Map();
  private database: any;
  private popularThreshold = 10; // Minimum clients to be considered popular

  constructor(database: any) {
    super();
    this.database = database;
    this.initializeRegistry();
  }

  /**
   * Initialize registry with popular POS systems
   */
  private async initializeRegistry() {
    try {
      // Load existing entries from database
      const entries = await this.database.collection('pos_registry').find().toArray();
      
      for (const entry of entries) {
        this.registry.set(entry.id, {
          ...entry,
          lastUpdated: new Date(entry.lastUpdated)
        });
      }

      // Add popular POS systems if not already present
      await this.addPopularPOSSystems();
      
      console.log(`POS Registry initialized with ${this.registry.size} systems`);
      this.emit('registry_initialized', this.registry.size);
    } catch (error) {
      console.error('Failed to initialize POS registry:', error);
    }
  }

  /**
   * Add popular/common POS systems to registry
   */
  private async addPopularPOSSystems() {
    const popularSystems: Omit<POSRegistryEntry, 'lastUpdated' | 'usageStats'>[] = [
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
        const entry: POSRegistryEntry = {
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

  /**
   * Add a new POS system to the registry
   */
  async addToRegistry(entry: POSRegistryEntry): Promise<boolean> {
    try {
      // Save to database
      await this.database.collection('pos_registry').replaceOne(
        { id: entry.id },
        { ...entry, lastUpdated: new Date() },
        { upsert: true }
      );

      // Add to memory
      this.registry.set(entry.id, entry);
      
      this.emit('pos_added', entry.id);
      console.log(`Added POS system to registry: ${entry.name}`);
      
      return true;
    } catch (error) {
      console.error(`Failed to add POS system ${entry.id}:`, error);
      return false;
    }
  }

  /**
   * Register a client-contributed POS system
   */
  async registerClientPOS(
    posData: Partial<POSRegistryEntry>,
    contributedBy: string,
    configuration?: POSPluginConfig
  ): Promise<boolean> {
    if (!posData.id || !posData.name) {
      throw new Error('POS system must have id and name');
    }

    const entry: POSRegistryEntry = {
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

  /**
   * Get all POS systems by category
   */
  getPOSByCategory(category?: string): POSRegistryEntry[] {
    const systems = Array.from(this.registry.values());
    
    if (category) {
      return systems.filter(pos => pos.category === category);
    }
    
    return systems.sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Get popular POS systems (high usage)
   */
  getPopularPOS(): POSRegistryEntry[] {
    return Array.from(this.registry.values())
      .filter(pos => pos.usageStats.clientsUsing >= this.popularThreshold)
      .sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Get recently added POS systems
   */
  getRecentlyAdded(limit = 10): POSRegistryEntry[] {
    return Array.from(this.registry.values())
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
      .slice(0, limit);
  }

  /**
   * Get client-contributed POS systems
   */
  getClientContributed(): POSRegistryEntry[] {
    return Array.from(this.registry.values())
      .filter(pos => pos.clientContributed)
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime());
  }

  /**
   * Search POS systems
   */
  searchPOS(query: string): POSRegistryEntry[] {
    const lowercaseQuery = query.toLowerCase();
    
    return Array.from(this.registry.values())
      .filter(pos => 
        pos.name.toLowerCase().includes(lowercaseQuery) ||
        pos.description.toLowerCase().includes(lowercaseQuery) ||
        pos.category.toLowerCase().includes(lowercaseQuery)
      )
      .sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Update usage statistics
   */
  async updateUsageStats(posId: string, stats: Partial<POSRegistryEntry['usageStats']>) {
    const entry = this.registry.get(posId);
    if (!entry) return false;

    entry.usageStats = { ...entry.usageStats, ...stats };
    entry.popularity = entry.usageStats.clientsUsing * 10 + Math.floor(entry.usageStats.monthlyTransactions / 1000);
    
    // Update category based on usage
    if (entry.usageStats.clientsUsing >= 50) {
      entry.marketShare = 'high';
    } else if (entry.usageStats.clientsUsing >= 20) {
      entry.marketShare = 'medium';
    }

    await this.database.collection('pos_registry').updateOne(
      { id: posId },
      { $set: { usageStats: entry.usageStats, popularity: entry.popularity, marketShare: entry.marketShare } }
    );

    return true;
  }

  /**
   * Verify a client-contributed POS system
   */
  async verifyPOS(posId: string): Promise<boolean> {
    const entry = this.registry.get(posId);
    if (!entry) return false;

    entry.verified = true;
    entry.status = 'active';
    
    await this.database.collection('pos_registry').updateOne(
      { id: posId },
      { $set: { verified: true, status: 'active' } }
    );

    this.emit('pos_verified', posId);
    return true;
  }

  /**
   * Get POS system by ID
   */
  getPOS(posId: string): POSRegistryEntry | null {
    return this.registry.get(posId) || null;
  }

  /**
   * Get registry statistics
   */
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

  /**
   * Export registry data
   */
  exportRegistry(): POSRegistryEntry[] {
    return Array.from(this.registry.values());
  }
}

export default POSRegistry;
