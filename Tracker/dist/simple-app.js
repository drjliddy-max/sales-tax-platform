"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const web_1 = __importDefault(require("./routes/web"));
const insights_simple_1 = __importDefault(require("./api/routes/insights-simple"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/insights-simple', insights_simple_1.default);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'sales-tax-insights'
    });
});
app.use('/', web_1.default);
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
exports.default = app;
//# sourceMappingURL=simple-app.js.map