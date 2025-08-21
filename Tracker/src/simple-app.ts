import express from 'express';
import cors from 'cors';
import frontendRoutes from './routes/web';
import insightsRoutes from './api/routes/insights-simple'; // Your existing insights routes

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes (existing)
app.use('/api/insights-simple', insightsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'sales-tax-insights'
  });
});

// Frontend Routes (new)
app.use('/', frontendRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /',
      'GET /login',
      'GET /insights/demo',
      'GET /health',
      'POST /api/insights-simple/generate/:businessId'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Sales Tax Insights Platform running on http://localhost:${PORT}`);
  console.log(`📊 Available routes:`);
  console.log(`   GET  http://localhost:${PORT}/           - Landing page`);
  console.log(`   GET  http://localhost:${PORT}/login      - Login page`);
  console.log(`   GET  http://localhost:${PORT}/insights/demo - Demo insights`);
  console.log(`   GET  http://localhost:${PORT}/health     - Health check`);
  console.log(`   POST http://localhost:${PORT}/api/insights-simple/generate/:id - Generate insights`);
});

export default app;