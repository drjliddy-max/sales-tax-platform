import app from './app';
import { config } from '@/config';
import { posInitializer } from '@/services/pos/POSInitializer';
import { logger } from '../backend/src/lib/logging/Logger';
// import { TaxUpdateInitializer } from '@/services/startup/TaxUpdateInitializer';
// import { redisInitializer } from '@/services/redis/RedisInitializer';

const PORT = 3002;

const server = app.listen(PORT, async () => {
  logger.info('SERVER', `Sales Tax Tracker API running on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
  console.log(`Sales Tax Tracker API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Monitoring enabled at /api/monitoring/health`);
  
  try {
    // Skip Redis initialization for now to get API running
    logger.info('SERVER', 'Skipping Redis initialization - API running in basic mode');
    console.log('Skipping Redis initialization - API running in basic mode');
    
    // Initialize POS integration systems
    await posInitializer.initialize();
    
    // Initialize tax update services without Redis dependency
    // await taxUpdateInitializer.initialize();
    logger.info('SERVER', 'Basic services started successfully');
    console.log('Basic services started successfully');
  } catch (error) {
    logger.error('SERVER', 'Failed to start services', { error: error.message });
    console.error('Failed to start services:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SERVER', 'SIGTERM received, shutting down gracefully');
  console.log('SIGTERM received, shutting down gracefully');
  
  try {
    // await taxUpdateInitializer.shutdown();
    // await redisInitializer.shutdown();
    await posInitializer.shutdown();
    logger.info('SERVER', 'POS initializer shutdown complete');
  } catch (error) {
    logger.error('SERVER', 'Error during shutdown', { error: error.message });
    console.error('Error during shutdown:', error);
  }
  
  server.close(() => {
    logger.info('SERVER', 'HTTP server closed');
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SERVER', 'SIGINT received, shutting down gracefully');
  console.log('SIGINT received, shutting down gracefully');
  
  try {
    // await taxUpdateInitializer.shutdown();
    // await redisInitializer.shutdown();
    await posInitializer.shutdown();
    logger.info('SERVER', 'POS initializer shutdown complete');
  } catch (error) {
    logger.error('SERVER', 'Error during shutdown', { error: error.message });
    console.error('Error during shutdown:', error);
  }
  
  server.close(() => {
    logger.info('SERVER', 'HTTP server closed');
    console.log('HTTP server closed');
    process.exit(0);
  });
});
