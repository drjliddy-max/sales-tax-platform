/**
 * Configuration Management System
 * Handles secure storage, caching, and management of POS configurations
 */

import crypto from 'crypto';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import {
  POSSystemType,
  POSConfiguration,
  AuthCredentials,
  POSIntegrationError
} from './types';

export class ConfigurationManager {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly CACHE_TTL = 3600; // 1 hour
  private static readonly CACHE_PREFIX = 'pos_config:';
  
  private static encryptionKey: Buffer;
  
  static {
    // Initialize encryption key from environment
    const key = process.env.POS_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('POS_ENCRYPTION_KEY environment variable is required');
    }
    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Save POS configuration with encrypted credentials
   */
  public static async saveConfiguration(
    businessId: string, 
    config: POSConfiguration
  ): Promise<void> {
    try {
      // Encrypt sensitive credentials
      const encryptedCredentials = this.encryptCredentials(config.credentials);
      
      // Prepare configuration for database storage
      const configData = {
        businessId,
        posType: config.posType,
        credentials: encryptedCredentials,
        webhookEndpoints: JSON.stringify(config.webhookEndpoints),
        dataSchema: JSON.stringify(config.dataSchema),
        rateLimit: JSON.stringify(config.rateLimit),
        settings: JSON.stringify(config.settings || {}),
        isActive: config.isActive,
        lastSync: config.lastSync,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database with upsert
      await prisma.posConfiguration.upsert({
        where: {
          businessId_posType: {
            businessId,
            posType: config.posType
          }
        },
        update: {
          ...configData,
          updatedAt: new Date()
        },
        create: configData
      });

      // Update cache
      const cacheKey = this.getCacheKey(businessId, config.posType);
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));

      console.log(`POS configuration saved for ${businessId}:${config.posType}`);
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to save configuration: ${error.message}`,
        'CONFIG_SAVE_FAILED',
        config.posType,
        undefined,
        true,
        { businessId, error: error.message }
      );
    }
  }

  /**
   * Load POS configuration with decrypted credentials
   */
  public static async loadConfiguration(
    businessId: string, 
    posType: POSSystemType
  ): Promise<POSConfiguration | null> {
    try {
      // Try cache first
      const cached = await this.loadFromCache(businessId, posType);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const stored = await prisma.posConfiguration.findUnique({
        where: {
          businessId_posType: {
            businessId,
            posType
          }
        }
      });

      if (!stored) {
        return null;
      }

      // Decrypt credentials and reconstruct configuration
      const decryptedCredentials = this.decryptCredentials(stored.credentials);
      
      const config: POSConfiguration = {
        posType: stored.posType as POSSystemType,
        credentials: decryptedCredentials,
        webhookEndpoints: JSON.parse(stored.webhookEndpoints),
        dataSchema: JSON.parse(stored.dataSchema),
        rateLimit: JSON.parse(stored.rateLimit),
        lastSync: stored.lastSync,
        isActive: stored.isActive,
        settings: JSON.parse(stored.settings || '{}')
      };

      // Update cache
      const cacheKey = this.getCacheKey(businessId, posType);
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));

      return config;
    } catch (error) {
      console.error(`Failed to load configuration for ${businessId}:${posType}:`, error);
      return null;
    }
  }

  /**
   * Load all configurations for a business
   */
  public static async loadAllConfigurations(businessId: string): Promise<POSConfiguration[]> {
    try {
      const stored = await prisma.posConfiguration.findMany({
        where: { businessId }
      });

      const configurations = await Promise.all(
        stored.map(async (config) => {
          try {
            const decryptedCredentials = this.decryptCredentials(config.credentials);
            
            return {
              posType: config.posType as POSSystemType,
              credentials: decryptedCredentials,
              webhookEndpoints: JSON.parse(config.webhookEndpoints),
              dataSchema: JSON.parse(config.dataSchema),
              rateLimit: JSON.parse(config.rateLimit),
              lastSync: config.lastSync,
              isActive: config.isActive,
              settings: JSON.parse(config.settings || '{}')
            };
          } catch (error) {
            console.error(`Failed to decrypt configuration for ${config.posType}:`, error);
            return null;
          }
        })
      );

      return configurations.filter(Boolean) as POSConfiguration[];
    } catch (error) {
      console.error(`Failed to load configurations for ${businessId}:`, error);
      return [];
    }
  }

  /**
   * Delete POS configuration
   */
  public static async deleteConfiguration(
    businessId: string, 
    posType: POSSystemType
  ): Promise<void> {
    try {
      // Delete from database
      await prisma.posConfiguration.delete({
        where: {
          businessId_posType: {
            businessId,
            posType
          }
        }
      });

      // Remove from cache
      const cacheKey = this.getCacheKey(businessId, posType);
      await redis.del(cacheKey);

      console.log(`POS configuration deleted for ${businessId}:${posType}`);
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to delete configuration: ${error.message}`,
        'CONFIG_DELETE_FAILED',
        posType,
        undefined,
        true,
        { businessId, error: error.message }
      );
    }
  }

  /**
   * Update last sync timestamp
   */
  public static async updateLastSync(
    businessId: string, 
    posType: POSSystemType, 
    timestamp: Date = new Date()
  ): Promise<void> {
    try {
      await prisma.posConfiguration.update({
        where: {
          businessId_posType: {
            businessId,
            posType
          }
        },
        data: {
          lastSync: timestamp,
          updatedAt: new Date()
        }
      });

      // Update cache
      const config = await this.loadConfiguration(businessId, posType);
      if (config) {
        config.lastSync = timestamp;
        const cacheKey = this.getCacheKey(businessId, posType);
        await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));
      }
    } catch (error) {
      console.error(`Failed to update last sync for ${businessId}:${posType}:`, error);
    }
  }

  /**
   * Toggle configuration active status
   */
  public static async toggleActive(
    businessId: string, 
    posType: POSSystemType, 
    isActive: boolean
  ): Promise<void> {
    try {
      await prisma.posConfiguration.update({
        where: {
          businessId_posType: {
            businessId,
            posType
          }
        },
        data: {
          isActive,
          updatedAt: new Date()
        }
      });

      // Update cache
      const config = await this.loadConfiguration(businessId, posType);
      if (config) {
        config.isActive = isActive;
        const cacheKey = this.getCacheKey(businessId, posType);
        await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));
      }
    } catch (error) {
      throw new POSIntegrationError(
        `Failed to toggle active status: ${error.message}`,
        'CONFIG_UPDATE_FAILED',
        posType,
        undefined,
        true,
        { businessId, isActive, error: error.message }
      );
    }
  }

  /**
   * Get active configurations for a business
   */
  public static async getActiveConfigurations(businessId: string): Promise<POSConfiguration[]> {
    const allConfigs = await this.loadAllConfigurations(businessId);
    return allConfigs.filter(config => config.isActive);
  }

  /**
   * Validate configuration completeness
   */
  public static validateConfiguration(config: POSConfiguration): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.posType) {
      errors.push('POS type is required');
    }

    if (!config.credentials) {
      errors.push('Credentials are required');
    } else {
      // Validate credentials based on POS type
      switch (config.posType) {
        case 'shopify':
          if (!config.credentials.accessToken || !config.credentials.shopDomain) {
            errors.push('Shopify requires accessToken and shopDomain');
          }
          break;
        case 'square':
          if (!config.credentials.accessToken) {
            errors.push('Square requires accessToken');
          }
          break;
        case 'clover':
          if (!config.credentials.accessToken || !config.credentials.merchantId) {
            errors.push('Clover requires accessToken and merchantId');
          }
          break;
        case 'toast':
          if (!config.credentials.accessToken || !config.credentials.restaurantGuid) {
            errors.push('Toast requires accessToken and restaurantGuid');
          }
          break;
        case 'lightspeed':
        case 'paypal_here':
          if (!config.credentials.accessToken) {
            errors.push(`${config.posType} requires accessToken`);
          }
          break;
        case 'ncr':
          if (!config.credentials.apiKey) {
            errors.push('NCR requires apiKey');
          }
          break;
      }
    }

    if (!config.dataSchema) {
      errors.push('Data schema is required');
    }

    if (!config.rateLimit) {
      errors.push('Rate limit configuration is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear all cached configurations for a business
   */
  public static async clearCache(businessId: string): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}${businessId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error(`Failed to clear cache for ${businessId}:`, error);
    }
  }

  /**
   * Load configuration from cache
   */
  private static async loadFromCache(
    businessId: string, 
    posType: POSSystemType
  ): Promise<POSConfiguration | null> {
    try {
      const cacheKey = this.getCacheKey(businessId, posType);
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  /**
   * Generate cache key
   */
  private static getCacheKey(businessId: string, posType: POSSystemType): string {
    return `${this.CACHE_PREFIX}${businessId}:${posType}`;
  }

  /**
   * Encrypt credentials using AES-256-GCM
   */
  private static encryptCredentials(credentials: AuthCredentials): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.ENCRYPTION_ALGORITHM, this.encryptionKey);
      cipher.setAAD(Buffer.from('pos_credentials'));

      const plaintext = JSON.stringify(credentials);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Combine iv, authTag, and encrypted data
      const combined = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted
      };

      return JSON.stringify(combined);
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt credentials using AES-256-GCM
   */
  private static decryptCredentials(encryptedData: string): AuthCredentials {
    try {
      const combined = JSON.parse(encryptedData);
      const iv = Buffer.from(combined.iv, 'hex');
      const authTag = Buffer.from(combined.authTag, 'hex');

      const decipher = crypto.createDecipher(this.ENCRYPTION_ALGORITHM, this.encryptionKey);
      decipher.setAAD(Buffer.from('pos_credentials'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(combined.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Get configuration statistics for monitoring
   */
  public static async getConfigurationStats(): Promise<{
    totalConfigurations: number;
    activeConfigurations: number;
    configurationsByPOS: Record<POSSystemType, number>;
    recentSyncs: number;
  }> {
    try {
      const total = await prisma.posConfiguration.count();
      const active = await prisma.posConfiguration.count({
        where: { isActive: true }
      });

      const byPOS = await prisma.posConfiguration.groupBy({
        by: ['posType'],
        _count: true
      });

      const configurationsByPOS = byPOS.reduce((acc, item) => {
        acc[item.posType as POSSystemType] = item._count;
        return acc;
      }, {} as Record<POSSystemType, number>);

      const recentSyncs = await prisma.posConfiguration.count({
        where: {
          lastSync: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      return {
        totalConfigurations: total,
        activeConfigurations: active,
        configurationsByPOS,
        recentSyncs
      };
    } catch (error) {
      console.error('Failed to get configuration stats:', error);
      return {
        totalConfigurations: 0,
        activeConfigurations: 0,
        configurationsByPOS: {} as Record<POSSystemType, number>,
        recentSyncs: 0
      };
    }
  }
}
