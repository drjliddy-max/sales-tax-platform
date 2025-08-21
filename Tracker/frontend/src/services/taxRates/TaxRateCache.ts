import { TaxRateQuery, TaxRateResponse, TaxRate } from './TaxRateProvider';

export interface CacheEntry {
  key: string;
  data: TaxRateResponse;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  source: string;
  confidence: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTtl: number; // seconds
  maxTtl: number;
  confidenceThreshold: number;
  compressionEnabled: boolean;
  persistToStorage: boolean;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  averageResponseTime: number;
  cacheSize: number;
  evictions: number;
  memoryUsage: number;
}

export class TaxRateCache {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats: CacheStats;
  private requestTimes: number[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 10000,
      defaultTtl: 3600, // 1 hour
      maxTtl: 86400, // 24 hours
      confidenceThreshold: 0.8,
      compressionEnabled: false,
      persistToStorage: true,
      evictionPolicy: 'lru',
      ...config
    };

    this.stats = {
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      averageResponseTime: 0,
      cacheSize: 0,
      evictions: 0,
      memoryUsage: 0
    };

    // Load cache from storage if enabled
    if (this.config.persistToStorage) {
      this.loadFromStorage();
    }

    // Start background cleanup
    this.startBackgroundCleanup();
  }

  async get(query: TaxRateQuery): Promise<TaxRateResponse | null> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    const key = this.generateKey(query);
    const entry = this.cache.get(key);

    if (entry && this.isEntryValid(entry)) {
      // Cache hit
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.stats.totalHits++;
      this.updateHitRate();

      const responseTime = performance.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      // Mark as cached response
      const response = { ...entry.data, cached: true };
      return response;
    }

    // Cache miss
    this.stats.totalMisses++;
    this.updateHitRate();

    return null;
  }

  async set(query: TaxRateQuery, response: TaxRateResponse): Promise<void> {
    const key = this.generateKey(query);
    const ttl = this.calculateTtl(response);
    
    const entry: CacheEntry = {
      key,
      data: response,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      source: response.source,
      confidence: response.confidence
    };

    // Check if we need to evict entries
    if (this.cache.size >= this.config.maxSize) {
      this.evictEntries(1);
    }

    this.cache.set(key, entry);
    this.stats.cacheSize = this.cache.size;

    // Persist to storage if enabled
    if (this.config.persistToStorage) {
      this.saveToStorage(key, entry);
    }
  }

  async invalidate(query: TaxRateQuery): Promise<boolean> {
    const key = this.generateKey(query);
    const existed = this.cache.has(key);
    
    if (existed) {
      this.cache.delete(key);
      this.stats.cacheSize = this.cache.size;
      
      if (this.config.persistToStorage) {
        this.removeFromStorage(key);
      }
    }

    return existed;
  }

  async invalidateByJurisdiction(jurisdiction: string): Promise<number> {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.data.jurisdiction.includes(jurisdiction)) {
        keysToDelete.push(key);
        invalidated++;
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      if (this.config.persistToStorage) {
        this.removeFromStorage(key);
      }
    });

    this.stats.cacheSize = this.cache.size;
    return invalidated;
  }

  async invalidateBySource(source: string): Promise<number> {
    let invalidated = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.source === source) {
        keysToDelete.push(key);
        invalidated++;
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      if (this.config.persistToStorage) {
        this.removeFromStorage(key);
      }
    });

    this.stats.cacheSize = this.cache.size;
    return invalidated;
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.cacheSize = 0;
    
    if (this.config.persistToStorage) {
      localStorage.removeItem('taxRateCache');
    }
  }

  getStats(): CacheStats {
    this.updateMemoryUsage();
    return { ...this.stats };
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // If max size was reduced, evict excess entries
    if (this.cache.size > this.config.maxSize) {
      this.evictEntries(this.cache.size - this.config.maxSize);
    }
  }

  // Get cache entries for debugging/monitoring
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  // Get entries by jurisdiction for analytics
  getEntriesByJurisdiction(jurisdiction: string): CacheEntry[] {
    return Array.from(this.cache.values()).filter(entry =>
      entry.data.jurisdiction.includes(jurisdiction)
    );
  }

  // Preload cache with common addresses
  async preload(commonQueries: TaxRateQuery[], getRatesFn: (query: TaxRateQuery) => Promise<TaxRateResponse>): Promise<void> {
    console.log(`Preloading cache with ${commonQueries.length} common queries...`);
    
    const preloadPromises = commonQueries.map(async (query) => {
      try {
        const response = await getRatesFn(query);
        await this.set(query, response);
      } catch (error) {
        console.warn('Failed to preload query:', query, error);
      }
    });

    await Promise.all(preloadPromises);
    console.log(`Cache preloaded. Size: ${this.cache.size}`);
  }

  private generateKey(query: TaxRateQuery): string {
    // Create a consistent cache key from the query
    const keyParts = [
      query.address.line1?.toLowerCase().trim(),
      query.address.city?.toLowerCase().trim(),
      query.address.state?.toLowerCase().trim(),
      query.address.postalCode?.trim(),
      query.address.country?.toLowerCase().trim() || 'us',
      query.productCategory?.toLowerCase().trim() || 'general',
      query.customerType?.toLowerCase().trim() || 'retail',
      query.transactionDate?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
    ];

    return `tax_rate_${keyParts.join('|')}`;
  }

  private isEntryValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000; // age in seconds
    
    // Check TTL
    if (age > entry.ttl) {
      return false;
    }

    // Check confidence threshold
    if (entry.confidence < this.config.confidenceThreshold) {
      return false;
    }

    return true;
  }

  private calculateTtl(response: TaxRateResponse): number {
    let ttl = this.config.defaultTtl;

    // Increase TTL for high-confidence responses
    if (response.confidence > 0.95) {
      ttl = Math.min(ttl * 2, this.config.maxTtl);
    }

    // Reduce TTL for low-confidence responses
    if (response.confidence < 0.8) {
      ttl = Math.max(ttl / 2, 300); // minimum 5 minutes
    }

    // Increase TTL for Avalara responses (more reliable)
    if (response.source === 'avalara') {
      ttl = Math.min(ttl * 1.5, this.config.maxTtl);
    }

    return ttl;
  }

  private evictEntries(count: number): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort based on eviction policy
    switch (this.config.evictionPolicy) {
      case 'lru':
        entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        break;
      case 'lfu':
        entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
        break;
      case 'fifo':
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
        break;
    }

    // Remove the oldest/least used entries
    for (let i = 0; i < count && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      
      if (this.config.persistToStorage) {
        this.removeFromStorage(key);
      }
    }

    this.stats.evictions += count;
    this.stats.cacheSize = this.cache.size;
  }

  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalHits / this.stats.totalRequests;
    this.stats.missRate = this.stats.totalMisses / this.stats.totalRequests;
  }

  private updateAverageResponseTime(responseTime: number): void {
    this.requestTimes.push(responseTime);
    
    // Keep only last 1000 response times for rolling average
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }

    this.stats.averageResponseTime = this.requestTimes.reduce((sum, time) => sum + time, 0) / this.requestTimes.length;
  }

  private updateMemoryUsage(): void {
    // Estimate memory usage
    let usage = 0;
    for (const entry of this.cache.values()) {
      // Rough estimation: JSON string length * 2 bytes per character
      usage += JSON.stringify(entry).length * 2;
    }
    this.stats.memoryUsage = usage;
  }

  private startBackgroundCleanup(): void {
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);

    // Update memory usage every minute
    setInterval(() => {
      this.updateMemoryUsage();
    }, 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const age = (now - entry.timestamp) / 1000;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      if (this.config.persistToStorage) {
        this.removeFromStorage(key);
      }
    });

    if (keysToDelete.length > 0) {
      this.stats.cacheSize = this.cache.size;
      console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('taxRateCache');
      if (stored) {
        const entries: Array<[string, CacheEntry]> = JSON.parse(stored);
        
        for (const [key, entry] of entries) {
          // Only load non-expired entries
          if (this.isEntryValid(entry)) {
            this.cache.set(key, entry);
          }
        }

        this.stats.cacheSize = this.cache.size;
        console.log(`Loaded ${this.cache.size} entries from storage`);
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error);
    }
  }

  private saveToStorage(key: string, entry: CacheEntry): void {
    try {
      // Save entire cache periodically (every 100 new entries)
      if (this.cache.size % 100 === 0) {
        const entries = Array.from(this.cache.entries());
        localStorage.setItem('taxRateCache', JSON.stringify(entries));
      }
    } catch (error) {
      console.warn('Failed to save cache to storage:', error);
    }
  }

  private removeFromStorage(key: string): void {
    // Individual key removal is expensive, so we'll rely on periodic full saves
    // and startup cleanup of expired entries
  }
}

// Global cache instance
export const taxRateCache = new TaxRateCache({
  maxSize: 5000,
  defaultTtl: 3600,
  maxTtl: 24 * 3600,
  confidenceThreshold: 0.8,
  persistToStorage: true,
  evictionPolicy: 'lru'
});
