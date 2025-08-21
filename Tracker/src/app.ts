import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '@/config';
import { 
  errorHandler, 
  notFoundHandler, 
  securityHeaders, 
  requestId, 
  sanitizeInputMiddleware,
  sqlInjectionProtection,
  xssProtection,
  corsOptions,
  rateLimits,
  healthCheck,
  validateEnvironment
} from '@/api/middleware';
import { logger, loggingMiddleware } from '../backend/src/lib/logging/Logger';
import { monitoringMiddleware } from '../backend/src/lib/monitoring/PerformanceMonitor';
import { alertSystem } from '../backend/src/lib/monitoring/AlertSystem';
import { requireAuth, protectRoute } from '@/middleware/clerk';
import { protectAdminRoute, protectClientRoute } from '@/middleware/auth';
import prisma from '@/lib/prisma';
import { 
  sentryRequestHandler, 
  sentryTracingHandler, 
  sentryErrorHandler,
  businessContextMiddleware,
  performanceMonitoringMiddleware,
  auditMiddleware,
  financialErrorBoundary
} from '@/api/middleware/sentry';
// import transactionRoutes from '@/api/routes/transactions';
// import businessRoutes from '@/api/routes/business';
// import taxRoutes from '@/api/routes/tax';
// import integrationRoutes from '@/api/routes/integrations';
// import taxUpdatesRoutes from '@/api/routes/tax-updates';
// import redisManagementRoutes from '@/api/routes/redis-management';
// import monitoringRoutes from '@/api/routes/monitoring';
// import userRoutes from '@/api/routes/users';
// import auditRoutes from '@/api/routes/audit';
// import { sessionService } from '@/services/redis/SessionService';
import { sentryService } from '@/services/monitoring/SentryService';

// Validate environment before starting
validateEnvironment();

const app = express();

// Initialize Sentry before other middleware (temporarily disabled for development)
// sentryService.initialize();

// Sentry request and tracing handlers must be first (temporarily disabled)
// app.use(sentryRequestHandler());
// app.use(sentryTracingHandler());

// Request tracking
app.use(requestId);
app.use(loggingMiddleware);
app.use(monitoringMiddleware);

// Security middleware
app.use(helmet());
app.use(securityHeaders);
app.use(cors(corsOptions));

// Input sanitization and protection
app.use(sanitizeInputMiddleware);
app.use(sqlInjectionProtection);
app.use(xssProtection);

// Rate limiting
app.use('/api/auth', rateLimits.auth);
app.use('/api/transactions', rateLimits.transactions);
app.use('/api/reports', rateLimits.reports);
app.use('/api/integrations/webhook', rateLimits.webhooks);
app.use('/api/tax/calculate', rateLimits.taxCalculation);
app.use('/api', rateLimits.api);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session middleware (temporarily disabled)
// app.use(sessionService.createSessionMiddleware());

// Sentry middleware for business context and monitoring (temporarily disabled)
// app.use(businessContextMiddleware);
// app.use(performanceMonitoringMiddleware);
// app.use(auditMiddleware);

// Routes
import authRoutes from '@/api/routes/auth';
import transactionRoutes from '@/api/routes/transactions';
import businessRoutes from '@/api/routes/business';
import taxRoutes from '@/api/routes/tax';
import integrationRoutes from '@/api/routes/integrations';
import reportRoutes from '@/api/routes/reports';
import insightsRoutes from '@/api/routes/insights';
import insightsSimpleRoutes from '@/api/routes/insights-simple';
import adminRoutes from '@/api/routes/admin';
import clientRoutes from '@/api/routes/client';
import webRoutes from '@/routes/web';

// POS Integration routes
import posOnboardingRoutes from '@/api/routes/pos-onboarding';
import { pluginRoutes } from '../backend/src/api/pos/pluginRoutes';
import { registryRoutes } from '../backend/src/api/pos/registryRoutes';
import monitoringRoutes from '../backend/src/routes/monitoring';

// Public routes (no auth required)
app.use('/api/auth', authRoutes);
app.use('/health', healthCheck);

// Role-based protected routes
app.use('/api/admin', adminRoutes); // Admin routes have their own protection middleware
app.use('/api/client', clientRoutes); // Client routes have their own protection middleware

// Protected routes (require authentication)
app.use('/api/transactions', protectRoute, transactionRoutes);
app.use('/api/business', protectRoute, businessRoutes);
app.use('/api/tax', protectRoute, taxRoutes);
app.use('/api/integrations', protectRoute, integrationRoutes);
app.use('/api/reports', protectRoute, reportRoutes);
app.use('/api/insights', protectRoute, insightsRoutes);
app.use('/api/insights-simple', protectRoute, insightsSimpleRoutes);

// POS Integration routes
app.use('/api/pos/onboarding', protectRoute, posOnboardingRoutes);
app.use('/api/pos/plugins', pluginRoutes);
app.use('/api/pos/registry', registryRoutes);

// Monitoring routes
app.use('/api/monitoring', monitoringRoutes);

// Web routes
app.use('/', webRoutes);


// Error handling (Sentry handlers temporarily disabled)
app.use(notFoundHandler);
// app.use(financialErrorBoundary);
// app.use(sentryErrorHandler());
app.use(errorHandler);

// Database connections
// PostgreSQL (primary) - connection handled by Prisma

// Test PostgreSQL connection
prisma.$connect()
  .then(() => console.log('Connected to PostgreSQL via Prisma'))
  .catch((err) => console.error('PostgreSQL connection error:', err));

export default app;