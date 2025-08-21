"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const redis_1 = require("@/lib/redis");
const prisma_1 = require("@/lib/prisma");
const types_1 = require("./types");
class ConfigurationManager {
    static async saveConfiguration(businessId, config) {
        try {
            const encryptedCredentials = this.encryptCredentials(config.credentials);
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
            await prisma_1.prisma.posConfiguration.upsert({
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
            const cacheKey = this.getCacheKey(businessId, config.posType);
            await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));
            console.log(`POS configuration saved for ${businessId}:${config.posType}`);
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to save configuration: ${error.message}`, 'CONFIG_SAVE_FAILED', config.posType, undefined, true, { businessId, error: error.message });
        }
    }
    static async loadConfiguration(businessId, posType) {
        try {
            const cached = await this.loadFromCache(businessId, posType);
            if (cached) {
                return cached;
            }
            const stored = await prisma_1.prisma.posConfiguration.findUnique({
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
            const decryptedCredentials = this.decryptCredentials(stored.credentials);
            const config = {
                posType: stored.posType,
                credentials: decryptedCredentials,
                webhookEndpoints: JSON.parse(stored.webhookEndpoints),
                dataSchema: JSON.parse(stored.dataSchema),
                rateLimit: JSON.parse(stored.rateLimit),
                lastSync: stored.lastSync,
                isActive: stored.isActive,
                settings: JSON.parse(stored.settings || '{}')
            };
            const cacheKey = this.getCacheKey(businessId, posType);
            await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));
            return config;
        }
        catch (error) {
            console.error(`Failed to load configuration for ${businessId}:${posType}:`, error);
            return null;
        }
    }
    static async loadAllConfigurations(businessId) {
        try {
            const stored = await prisma_1.prisma.posConfiguration.findMany({
                where: { businessId }
            });
            const configurations = await Promise.all(stored.map(async (config) => {
                try {
                    const decryptedCredentials = this.decryptCredentials(config.credentials);
                    return {
                        posType: config.posType,
                        credentials: decryptedCredentials,
                        webhookEndpoints: JSON.parse(config.webhookEndpoints),
                        dataSchema: JSON.parse(config.dataSchema),
                        rateLimit: JSON.parse(config.rateLimit),
                        lastSync: config.lastSync,
                        isActive: config.isActive,
                        settings: JSON.parse(config.settings || '{}')
                    };
                }
                catch (error) {
                    console.error(`Failed to decrypt configuration for ${config.posType}:`, error);
                    return null;
                }
            }));
            return configurations.filter(Boolean);
        }
        catch (error) {
            console.error(`Failed to load configurations for ${businessId}:`, error);
            return [];
        }
    }
    static async deleteConfiguration(businessId, posType) {
        try {
            await prisma_1.prisma.posConfiguration.delete({
                where: {
                    businessId_posType: {
                        businessId,
                        posType
                    }
                }
            });
            const cacheKey = this.getCacheKey(businessId, posType);
            await redis_1.redis.del(cacheKey);
            console.log(`POS configuration deleted for ${businessId}:${posType}`);
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to delete configuration: ${error.message}`, 'CONFIG_DELETE_FAILED', posType, undefined, true, { businessId, error: error.message });
        }
    }
    static async updateLastSync(businessId, posType, timestamp = new Date()) {
        try {
            await prisma_1.prisma.posConfiguration.update({
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
            const config = await this.loadConfiguration(businessId, posType);
            if (config) {
                config.lastSync = timestamp;
                const cacheKey = this.getCacheKey(businessId, posType);
                await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));
            }
        }
        catch (error) {
            console.error(`Failed to update last sync for ${businessId}:${posType}:`, error);
        }
    }
    static async toggleActive(businessId, posType, isActive) {
        try {
            await prisma_1.prisma.posConfiguration.update({
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
            const config = await this.loadConfiguration(businessId, posType);
            if (config) {
                config.isActive = isActive;
                const cacheKey = this.getCacheKey(businessId, posType);
                await redis_1.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(config));
            }
        }
        catch (error) {
            throw new types_1.POSIntegrationError(`Failed to toggle active status: ${error.message}`, 'CONFIG_UPDATE_FAILED', posType, undefined, true, { businessId, isActive, error: error.message });
        }
    }
    static async getActiveConfigurations(businessId) {
        const allConfigs = await this.loadAllConfigurations(businessId);
        return allConfigs.filter(config => config.isActive);
    }
    static validateConfiguration(config) {
        const errors = [];
        if (!config.posType) {
            errors.push('POS type is required');
        }
        if (!config.credentials) {
            errors.push('Credentials are required');
        }
        else {
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
    static async clearCache(businessId) {
        try {
            const pattern = `${this.CACHE_PREFIX}${businessId}:*`;
            const keys = await redis_1.redis.keys(pattern);
            if (keys.length > 0) {
                await redis_1.redis.del(...keys);
            }
        }
        catch (error) {
            console.error(`Failed to clear cache for ${businessId}:`, error);
        }
    }
    static async loadFromCache(businessId, posType) {
        try {
            const cacheKey = this.getCacheKey(businessId, posType);
            const cached = await redis_1.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            return null;
        }
        catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    }
    static getCacheKey(businessId, posType) {
        return `${this.CACHE_PREFIX}${businessId}:${posType}`;
    }
    static encryptCredentials(credentials) {
        try {
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipher(this.ENCRYPTION_ALGORITHM, this.encryptionKey);
            cipher.setAAD(Buffer.from('pos_credentials'));
            const plaintext = JSON.stringify(credentials);
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();
            const combined = {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                encrypted
            };
            return JSON.stringify(combined);
        }
        catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }
    static decryptCredentials(encryptedData) {
        try {
            const combined = JSON.parse(encryptedData);
            const iv = Buffer.from(combined.iv, 'hex');
            const authTag = Buffer.from(combined.authTag, 'hex');
            const decipher = crypto_1.default.createDecipher(this.ENCRYPTION_ALGORITHM, this.encryptionKey);
            decipher.setAAD(Buffer.from('pos_credentials'));
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(combined.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        }
        catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
    static async getConfigurationStats() {
        try {
            const total = await prisma_1.prisma.posConfiguration.count();
            const active = await prisma_1.prisma.posConfiguration.count({
                where: { isActive: true }
            });
            const byPOS = await prisma_1.prisma.posConfiguration.groupBy({
                by: ['posType'],
                _count: true
            });
            const configurationsByPOS = byPOS.reduce((acc, item) => {
                acc[item.posType] = item._count;
                return acc;
            }, {});
            const recentSyncs = await prisma_1.prisma.posConfiguration.count({
                where: {
                    lastSync: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                    }
                }
            });
            return {
                totalConfigurations: total,
                activeConfigurations: active,
                configurationsByPOS,
                recentSyncs
            };
        }
        catch (error) {
            console.error('Failed to get configuration stats:', error);
            return {
                totalConfigurations: 0,
                activeConfigurations: 0,
                configurationsByPOS: {},
                recentSyncs: 0
            };
        }
    }
}
exports.ConfigurationManager = ConfigurationManager;
_a = ConfigurationManager;
ConfigurationManager.ENCRYPTION_ALGORITHM = 'aes-256-gcm';
ConfigurationManager.CACHE_TTL = 3600;
ConfigurationManager.CACHE_PREFIX = 'pos_config:';
(() => {
    const key = process.env.POS_ENCRYPTION_KEY;
    if (!key) {
        throw new Error('POS_ENCRYPTION_KEY environment variable is required');
    }
    _a.encryptionKey = Buffer.from(key, 'hex');
})();
//# sourceMappingURL=configuration.js.map