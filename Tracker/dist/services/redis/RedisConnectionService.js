"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisConnectionService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("@/config");
const utils_1 = require("@/utils");
const SentryService_1 = require("@/services/monitoring/SentryService");
class RedisConnectionService {
    constructor() {
        this.redis = null;
        this.pubSubClient = null;
        this.connectionPool = new Map();
        this.connectionMetrics = {
            totalConnections: 0,
            activeConnections: 0,
            failedConnections: 0
        };
        this.healthCheckInterval = null;
        this.isShuttingDown = false;
        this.initializeConnection();
        this.startHealthChecks();
    }
    static getInstance() {
        if (!RedisConnectionService.instance) {
            RedisConnectionService.instance = new RedisConnectionService();
        }
        return RedisConnectionService.instance;
    }
    parseRedisUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return {
                host: parsedUrl.hostname,
                port: parseInt(parsedUrl.port) || 6379,
                password: parsedUrl.password || undefined,
                db: parseInt(parsedUrl.pathname.slice(1)) || 0,
                keyPrefix: 'sales-tax:',
                connectTimeout: 10000,
                commandTimeout: 5000,
                maxRetriesPerRequest: 3,
                lazyConnect: false
            };
        }
        catch (error) {
            utils_1.logger.error('Invalid Redis URL format:', error);
            throw new Error(`Invalid Redis URL: ${url}`);
        }
    }
    async initializeConnection() {
        try {
            const redisConfig = this.parseRedisUrl(config_1.config.redis.url);
            utils_1.logger.info('Initializing Redis connection', {
                host: redisConfig.host,
                port: redisConfig.port,
                db: redisConfig.db
            });
            this.redis = new ioredis_1.default({
                ...redisConfig,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3,
                family: 4
            });
            this.pubSubClient = new ioredis_1.default({
                ...redisConfig,
                enableReadyCheck: true,
                maxRetriesPerRequest: null
            });
            this.setupEventHandlers(this.redis, 'main');
            this.setupEventHandlers(this.pubSubClient, 'pubsub');
            await this.waitForConnection(this.redis);
            await this.waitForConnection(this.pubSubClient);
            this.connectionMetrics.totalConnections += 2;
            this.connectionMetrics.activeConnections += 2;
            this.connectionMetrics.lastConnectionTime = new Date();
            utils_1.logger.info('Redis connections established successfully');
        }
        catch (error) {
            this.connectionMetrics.failedConnections++;
            this.connectionMetrics.lastError = error instanceof Error ? error.message : 'Unknown error';
            this.connectionMetrics.lastErrorTime = new Date();
            utils_1.logger.error('Failed to initialize Redis connection:', error);
            throw error;
        }
    }
    setupEventHandlers(client, clientName) {
        client.on('connect', () => {
            utils_1.logger.info(`Redis ${clientName} client connected`);
        });
        client.on('ready', () => {
            utils_1.logger.info(`Redis ${clientName} client ready`);
        });
        client.on('error', (error) => {
            this.connectionMetrics.lastError = error.message;
            this.connectionMetrics.lastErrorTime = new Date();
            utils_1.logger.error(`Redis ${clientName} client error:`, error);
        });
        client.on('close', () => {
            if (!this.isShuttingDown) {
                utils_1.logger.warn(`Redis ${clientName} client connection closed unexpectedly`);
                this.connectionMetrics.activeConnections = Math.max(0, this.connectionMetrics.activeConnections - 1);
            }
        });
        client.on('reconnecting', (delay) => {
            utils_1.logger.info(`Redis ${clientName} client reconnecting in ${delay}ms`);
        });
        client.on('end', () => {
            utils_1.logger.info(`Redis ${clientName} client connection ended`);
        });
    }
    async waitForConnection(client, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Redis connection timeout after ${timeoutMs}ms`));
            }, timeoutMs);
            client.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
            client.once('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    }
    async getClient() {
        const startTime = Date.now();
        try {
            if (!this.redis) {
                throw new Error('Redis client not initialized');
            }
            if (this.redis.status !== 'ready') {
                utils_1.logger.warn('Redis client not ready, attempting to connect');
                await this.waitForConnection(this.redis);
            }
            SentryService_1.sentryService.trackRedisPerformance({
                operation: 'get',
                latency: Date.now() - startTime,
                success: true
            });
            return this.redis;
        }
        catch (error) {
            SentryService_1.sentryService.trackRedisPerformance({
                operation: 'get',
                latency: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error : new Error('Redis client error')
            });
            throw error;
        }
    }
    async getPubSubClient() {
        if (!this.pubSubClient) {
            throw new Error('Redis pub/sub client not initialized');
        }
        if (this.pubSubClient.status !== 'ready') {
            utils_1.logger.warn('Redis pub/sub client not ready, attempting to connect');
            await this.waitForConnection(this.pubSubClient);
        }
        return this.pubSubClient;
    }
    async getPooledConnection(poolName) {
        if (this.connectionPool.has(poolName)) {
            const client = this.connectionPool.get(poolName);
            if (client.status === 'ready') {
                return client;
            }
        }
        const redisConfig = this.parseRedisUrl(config_1.config.redis.url);
        const pooledClient = new ioredis_1.default({
            ...redisConfig,
            connectionName: poolName
        });
        this.setupEventHandlers(pooledClient, `pool-${poolName}`);
        await this.waitForConnection(pooledClient);
        this.connectionPool.set(poolName, pooledClient);
        this.connectionMetrics.totalConnections++;
        this.connectionMetrics.activeConnections++;
        utils_1.logger.info(`Created pooled Redis connection: ${poolName}`);
        return pooledClient;
    }
    async testConnection() {
        try {
            const client = await this.getClient();
            const result = await client.ping();
            return result === 'PONG';
        }
        catch (error) {
            utils_1.logger.error('Redis connection test failed:', error);
            return false;
        }
    }
    async getConnectionHealth() {
        try {
            const startTime = Date.now();
            const pingResult = await this.testConnection();
            const latency = Date.now() - startTime;
            let status = 'healthy';
            if (!pingResult) {
                status = 'unhealthy';
            }
            else if (latency > 100 || this.connectionMetrics.failedConnections > 0) {
                status = 'degraded';
            }
            return {
                status,
                connections: {
                    main: this.redis?.status || 'disconnected',
                    pubsub: this.pubSubClient?.status || 'disconnected',
                    pooled: Array.from(this.connectionPool.entries()).map(([name, client]) => `${name}:${client.status}`)
                },
                metrics: { ...this.connectionMetrics },
                latency: pingResult ? latency : undefined
            };
        }
        catch (error) {
            utils_1.logger.error('Health check failed:', error);
            return {
                status: 'unhealthy',
                connections: {
                    main: 'error',
                    pubsub: 'error',
                    pooled: []
                },
                metrics: { ...this.connectionMetrics }
            };
        }
    }
    startHealthChecks() {
        this.healthCheckInterval = setInterval(async () => {
            const health = await this.getConnectionHealth();
            if (health.status !== 'healthy') {
                utils_1.logger.warn('Redis health check failed:', health);
            }
            if (health.status === 'healthy') {
                this.connectionMetrics.failedConnections = 0;
            }
        }, 30000);
    }
    async flushDatabase(confirm = false) {
        if (!confirm) {
            throw new Error('Database flush requires explicit confirmation');
        }
        if (config_1.config.server.env === 'production') {
            throw new Error('Cannot flush database in production environment');
        }
        const client = await this.getClient();
        await client.flushdb();
        utils_1.logger.warn('Redis database flushed');
    }
    async getRedisInfo() {
        try {
            const client = await this.getClient();
            const info = await client.info();
            const infoObject = {};
            const sections = info.split('\r\n\r\n');
            for (const section of sections) {
                const lines = section.split('\r\n');
                const sectionName = lines[0].replace('# ', '');
                infoObject[sectionName] = {};
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i];
                    if (line && line.includes(':')) {
                        const [key, value] = line.split(':');
                        infoObject[sectionName][key] = value;
                    }
                }
            }
            return infoObject;
        }
        catch (error) {
            utils_1.logger.error('Failed to get Redis info:', error);
            throw error;
        }
    }
    async shutdown() {
        utils_1.logger.info('Shutting down Redis connections');
        this.isShuttingDown = true;
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        const disconnectionPromises = [];
        if (this.redis) {
            disconnectionPromises.push(this.redis.quit());
        }
        if (this.pubSubClient) {
            disconnectionPromises.push(this.pubSubClient.quit());
        }
        for (const [name, client] of this.connectionPool) {
            utils_1.logger.info(`Closing pooled connection: ${name}`);
            disconnectionPromises.push(client.quit());
        }
        try {
            await Promise.all(disconnectionPromises);
            this.connectionMetrics.activeConnections = 0;
            utils_1.logger.info('All Redis connections closed successfully');
        }
        catch (error) {
            utils_1.logger.error('Error during Redis shutdown:', error);
        }
    }
}
exports.RedisConnectionService = RedisConnectionService;
//# sourceMappingURL=RedisConnectionService.js.map