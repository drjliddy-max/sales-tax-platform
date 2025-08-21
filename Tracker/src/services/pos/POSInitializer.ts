/**
 * POS Integration Initializer
 * Initializes POS plugin manager and registry systems with new backend implementation
 */

import { posInitializer as backendPOSInitializer } from '../../../backend/src/lib/pos/POSInitializer';
import { initializePluginManager } from '../../../backend/src/api/pos/pluginRoutes';
import { initializePOSRegistry } from '../../../backend/src/api/pos/registryRoutes';
import { posAdapter } from '../../../backend/src/lib/database/POSAdapter';
import prisma from '@/lib/prisma';

export class POSInitializer {
  private static instance: POSInitializer;
  private pluginManager: POSPluginManager | null = null;
  private registry: POSRegistry | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): POSInitializer {
    if (!POSInitializer.instance) {
      POSInitializer.instance = new POSInitializer();
    }
    return POSInitializer.instance;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔧 Initializing POS integration systems...');

      // Initialize the backend POS system
      await backendPOSInitializer.initialize();
      
      // Initialize plugin manager and registry with the database adapter
      initializePluginManager(posAdapter);
      initializePOSRegistry(posAdapter);

      this.initialized = true;
      console.log('✅ POS integration systems initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize POS integration systems:', error);
      throw error;
    }
  }

  // Simple adapter methods for Prisma
  private async findPOSPlugins(query: any) {
    return {
      toArray: async () => {
        // For now, return empty array - can be extended to use actual database
        return [];
      }
    };
  }

  private async findPOSRegistry(query: any) {
    return {
      toArray: async () => {
        // For now, return empty array - can be extended to use actual database
        return [];
      }
    };
  }

  private async upsertPOSPlugin(filter: any, data: any, options: any) {
    // For now, just log the operation
    console.log('POS Plugin upsert:', filter, data);
    return { acknowledged: true };
  }

  private async upsertPOSRegistry(filter: any, data: any, options: any) {
    // For now, just log the operation
    console.log('POS Registry upsert:', filter, data);
    return { acknowledged: true };
  }

  private async updatePOSPlugin(filter: any, update: any) {
    // For now, just log the operation
    console.log('POS Plugin update:', filter, update);
    return { acknowledged: true };
  }

  private async updatePOSRegistry(filter: any, update: any) {
    // For now, just log the operation
    console.log('POS Registry update:', filter, update);
    return { acknowledged: true };
  }

  async shutdown() {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🛑 Shutting down POS integration systems...');
      
      // Use backend cleanup
      await backendPOSInitializer.cleanup();
      
      this.initialized = false;
      console.log('✅ POS integration systems shut down successfully');
    } catch (error) {
      console.error('❌ Error during POS shutdown:', error);
      this.initialized = false;
    }
  }
}

export const posInitializer = POSInitializer.getInstance();
