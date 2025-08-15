import app from './app';
import { config } from '@/config';
// import { TaxUpdateInitializer } from '@/services/startup/TaxUpdateInitializer';
// import { redisInitializer } from '@/services/redis/RedisInitializer';

const PORT = 3002;

const server = app.listen(PORT, async () => {
  console.log(`Sales Tax Tracker API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    // Skip Redis initialization for now to get API running
    console.log('Skipping Redis initialization - API running in basic mode');
    
    // Initialize tax update services without Redis dependency
    // await taxUpdateInitializer.initialize();
    console.log('Basic services started successfully');
  } catch (error) {
    console.error('Failed to start services:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // await taxUpdateInitializer.shutdown();
  // await redisInitializer.shutdown();
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // await taxUpdateInitializer.shutdown();
  // await redisInitializer.shutdown();
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});