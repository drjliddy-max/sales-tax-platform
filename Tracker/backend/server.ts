/**
 * POS Integration Server Entry Point
 * Standalone server for POS integration system
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateEnvironment } from './src/config';
import { posInitializer } from './src/lib/pos/POSInitializer';

// Import POS routes
import { pluginRoutes } from './src/api/pos/pluginRoutes';
import { registryRoutes } from './src/api/pos/registryRoutes';

const app = express();
const PORT = config.server.port;

// Validate environment before starting
validateEnvironment();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: config.server.environment,
    posIntegration: {
      initialized: posInitializer.isInitialized(),
      status: 'active'
    }
  });
});

// API Documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Sales Tax Tracker - POS Integration API',
    version: '1.0.0',
    description: 'Comprehensive POS integration system for sales tax automation',
    endpoints: {
      health: '/health',
      pos: {
        registry: '/api/pos/registry/*',
        plugins: '/api/pos/plugins/*'
      }
    },
    documentation: {
      registry: 'POS system discovery, search, and contribution',
      plugins: 'POS plugin configuration and management'
    },
    authentication: 'Bearer token required for protected endpoints'
  });
});

// Mount POS API routes
app.use('/api/pos/plugins', pluginRoutes);
app.use('/api/pos/registry', registryRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: config.server.environment === 'production' 
      ? 'Internal server error' 
      : err.message,
    timestamp: new Date().toISOString(),
    path: req.path
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    available_endpoints: ['/health', '/api', '/api/pos/registry/*', '/api/pos/plugins/*']
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close server
    server.close(() => {
      console.log('✅ HTTP server closed');
    });

    // Cleanup POS system
    await posInitializer.cleanup();
    console.log('✅ POS system cleaned up');

    console.log('🎯 Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Setup graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize server
async function startServer() {
  try {
    console.log('🚀 Starting Sales Tax Tracker - POS Integration API');
    console.log(`Environment: ${config.server.environment}`);
    console.log(`Port: ${PORT}`);

    // Initialize POS system
    console.log('\n🔧 Initializing POS Integration System...');
    await posInitializer.initialize();
    console.log('✅ POS system initialized successfully');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`\n🎉 Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API docs: http://localhost:${PORT}/api`);
      console.log('\n📡 Available endpoints:');
      console.log(`  • GET  /health - Health check`);
      console.log(`  • GET  /api - API documentation`);
      console.log(`  • GET  /api/pos/registry/* - POS registry endpoints`);
      console.log(`  • GET  /api/pos/plugins/* - POS plugin endpoints`);
      console.log('\n🔐 Authentication required for protected endpoints');
      console.log('Ready to accept requests! 🚀\n');
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
const server = startServer();

export default app;
