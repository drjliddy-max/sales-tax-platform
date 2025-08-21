/**
 * POS System Initializer
 * Sets up POS registry and plugin manager on server startup
 */

import { posAdapter } from '../database/POSAdapter';
import { initializePOSRegistry } from '../../api/pos/registryRoutes';
import { initializePluginManager } from '../../api/pos/pluginRoutes';

export class POSInitializer {
  private static instance: POSInitializer;
  private initialized: boolean = false;

  static getInstance(): POSInitializer {
    if (!POSInitializer.instance) {
      POSInitializer.instance = new POSInitializer();
    }
    return POSInitializer.instance;
  }

  /**
   * Initialize POS systems and registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('POS system already initialized');
      return;
    }

    try {
      console.log('🔧 Initializing POS systems...');

      // Initialize database adapter with default data
      await posAdapter.initializeDefaults();

      // Initialize POS Registry
      initializePOSRegistry(posAdapter);
      console.log('✅ POS Registry initialized');

      // Initialize Plugin Manager
      initializePluginManager(posAdapter);
      console.log('✅ POS Plugin Manager initialized');

      this.initialized = true;
      console.log('🎉 POS system initialization complete');
    } catch (error) {
      console.error('❌ Failed to initialize POS system:', error);
      throw error;
    }
  }

  /**
   * Check if POS system is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Cleanup POS systems on server shutdown
   */
  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up POS systems...');
      // Add any cleanup logic here if needed
      this.initialized = false;
      console.log('✅ POS systems cleaned up');
    } catch (error) {
      console.error('❌ Error during POS cleanup:', error);
    }
  }
}

// Export singleton instance
export const posInitializer = POSInitializer.getInstance();
