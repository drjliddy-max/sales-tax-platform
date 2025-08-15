import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils';
import { sentryService } from '@/services/monitoring/SentryService';

interface RedisConnectionConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  commandTimeout?: number;
  maxRetriesPerRequest?: number;
  lazyConnect?: boolean;
}

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  failedConnections: number;
  lastConnectionTime?: Date;
  lastErrorTime?: Date;
  lastError?: string;
}

export class RedisConnectionService {
  private static instance: RedisConnectionService;
  private redis: Redis | null = null;
  private pubSubClient: Redis | null = null;
  private connectionPool: Map<string, Redis> = new Map();
  private connectionMetrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    failedConnections: 0
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  private constructor() {
    this.initializeConnection();
    this.startHealthChecks();
  }

  public static getInstance(): RedisConnectionService {
    if (!RedisConnectionService.instance) {
      RedisConnectionService.instance = new RedisConnectionService();
    }
    return RedisConnectionService.instance;
  }

  private parseRedisUrl(url: string): RedisConnectionConfig {
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
    } catch (error) {
      logger.error('Invalid Redis URL format:', error);
      throw new Error(`Invalid Redis URL: ${url}`);
    }
  }

  private async initializeConnection(): Promise<void> {
    try {
      const redisConfig = this.parseRedisUrl(config.redis.url);
      
      logger.info('Initializing Redis connection', {
        host: redisConfig.host,
        port: redisConfig.port,
        db: redisConfig.db
      });

      // Main Redis client
      this.redis = new Redis({
        ...redisConfig,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        family: 4
      });

      // Pub/Sub client (separate connection recommended)
      this.pubSubClient = new Redis({
        ...redisConfig,
        enableReadyCheck: true,
        maxRetriesPerRequest: null // Disable retries for pub/sub
      });

      this.setupEventHandlers(this.redis, 'main');
      this.setupEventHandlers(this.pubSubClient, 'pubsub');

      await this.waitForConnection(this.redis);
      await this.waitForConnection(this.pubSubClient);

      this.connectionMetrics.totalConnections += 2;
      this.connectionMetrics.activeConnections += 2;
      this.connectionMetrics.lastConnectionTime = new Date();

      logger.info('Redis connections established successfully');

    } catch (error) {
      this.connectionMetrics.failedConnections++;
      this.connectionMetrics.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.connectionMetrics.lastErrorTime = new Date();
      
      logger.error('Failed to initialize Redis connection:', error);
      throw error;
    }
  }

  private setupEventHandlers(client: Redis, clientName: string): void {
    client.on('connect', () => {
      logger.info(`Redis ${clientName} client connected`);
    });

    client.on('ready', () => {
      logger.info(`Redis ${clientName} client ready`);
    });

    client.on('error', (error) => {
      this.connectionMetrics.lastError = error.message;
      this.connectionMetrics.lastErrorTime = new Date();
      logger.error(`Redis ${clientName} client error:`, error);
    });

    client.on('close', () => {
      if (!this.isShuttingDown) {
        logger.warn(`Redis ${clientName} client connection closed unexpectedly`);
        this.connectionMetrics.activeConnections = Math.max(0, this.connectionMetrics.activeConnections - 1);
      }
    });

    client.on('reconnecting', (delay: number) => {
      logger.info(`Redis ${clientName} client reconnecting in ${delay}ms`);
    });

    client.on('end', () => {
      logger.info(`Redis ${clientName} client connection ended`);
    });
  }

  private async waitForConnection(client: Redis, timeoutMs = 10000): Promise<void> {
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

  public async getClient(): Promise<Redis> {
    const startTime = Date.now();
    
    try {
      if (!this.redis) {
        throw new Error('Redis client not initialized');
      }
      
      if (this.redis.status !== 'ready') {
        logger.warn('Redis client not ready, attempting to connect');
        await this.waitForConnection(this.redis);
      }
      
      // Track successful connection retrieval
      sentryService.trackRedisPerformance({
        operation: 'get',
        latency: Date.now() - startTime,
        success: true
      });
      
      return this.redis;
    } catch (error) {
      // Track connection failure
      sentryService.trackRedisPerformance({
        operation: 'get',
        latency: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error : new Error('Redis client error')
      });
      
      throw error;
    }
  }

  public async getPubSubClient(): Promise<Redis> {
    if (!this.pubSubClient) {
      throw new Error('Redis pub/sub client not initialized');
    }
    
    if (this.pubSubClient.status !== 'ready') {
      logger.warn('Redis pub/sub client not ready, attempting to connect');
      await this.waitForConnection(this.pubSubClient);
    }
    
    return this.pubSubClient;
  }

  public async getPooledConnection(poolName: string): Promise<Redis> {
    if (this.connectionPool.has(poolName)) {
      const client = this.connectionPool.get(poolName)!;
      if (client.status === 'ready') {
        return client;
      }
    }

    // Create new pooled connection
    const redisConfig = this.parseRedisUrl(config.redis.url);
    const pooledClient = new Redis({
      ...redisConfig,
      connectionName: poolName
    });

    this.setupEventHandlers(pooledClient, `pool-${poolName}`);
    await this.waitForConnection(pooledClient);
    
    this.connectionPool.set(poolName, pooledClient);
    this.connectionMetrics.totalConnections++;
    this.connectionMetrics.activeConnections++;

    logger.info(`Created pooled Redis connection: ${poolName}`);
    
    return pooledClient;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.getClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis connection test failed:', error);
      return false;
    }
  }

  public async getConnectionHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    connections: {
      main: string;
      pubsub: string;
      pooled: string[];
    };
    metrics: ConnectionMetrics;
    latency?: number;
  }> {
    try {
      const startTime = Date.now();
      const pingResult = await this.testConnection();
      const latency = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (!pingResult) {
        status = 'unhealthy';
      } else if (latency > 100 || this.connectionMetrics.failedConnections > 0) {
        status = 'degraded';
      }

      return {
        status,
        connections: {
          main: this.redis?.status || 'disconnected',
          pubsub: this.pubSubClient?.status || 'disconnected',
          pooled: Array.from(this.connectionPool.entries()).map(([name, client]) => 
            `${name}:${client.status}`
          )
        },
        metrics: { ...this.connectionMetrics },
        latency: pingResult ? latency : undefined
      };
    } catch (error) {
      logger.error('Health check failed:', error);
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

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getConnectionHealth();
      
      if (health.status !== 'healthy') {
        logger.warn('Redis health check failed:', health);
      }
      
      // Reset failed connections counter if healthy
      if (health.status === 'healthy') {
        this.connectionMetrics.failedConnections = 0;
      }
    }, 30000); // Check every 30 seconds
  }

  public async flushDatabase(confirm = false): Promise<void> {
    if (!confirm) {
      throw new Error('Database flush requires explicit confirmation');
    }
    
    if (config.server.env === 'production') {
      throw new Error('Cannot flush database in production environment');
    }
    
    const client = await this.getClient();
    await client.flushdb();
    logger.warn('Redis database flushed');
  }

  public async getRedisInfo(): Promise<any> {
    try {
      const client = await this.getClient();
      const info = await client.info();
      
      // Parse the info string into an object
      const infoObject: any = {};
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
    } catch (error) {
      logger.error('Failed to get Redis info:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down Redis connections');
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    const disconnectionPromises: Promise<any>[] = [];

    if (this.redis) {
      disconnectionPromises.push(this.redis.quit());
    }

    if (this.pubSubClient) {
      disconnectionPromises.push(this.pubSubClient.quit());
    }

    for (const [name, client] of this.connectionPool) {
      logger.info(`Closing pooled connection: ${name}`);
      disconnectionPromises.push(client.quit());
    }

    try {
      await Promise.all(disconnectionPromises);
      this.connectionMetrics.activeConnections = 0;
      logger.info('All Redis connections closed successfully');
    } catch (error) {
      logger.error('Error during Redis shutdown:', error);
    }
  }
}

// Export singleton instance (temporarily disabled to prevent auto-initialization)
// export const redisConnection = RedisConnectionService.getInstance();