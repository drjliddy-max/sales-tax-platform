"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const POSInitializer_1 = require("@/services/pos/POSInitializer");
const Logger_1 = require("../backend/src/lib/logging/Logger");
const PORT = 3002;
const server = app_1.default.listen(PORT, async () => {
    Logger_1.logger.info('SERVER', `Sales Tax Tracker API running on port ${PORT}`, {
        port: PORT,
        environment: process.env.NODE_ENV || 'development'
    });
    console.log(`Sales Tax Tracker API running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Monitoring enabled at /api/monitoring/health`);
    try {
        Logger_1.logger.info('SERVER', 'Skipping Redis initialization - API running in basic mode');
        console.log('Skipping Redis initialization - API running in basic mode');
        await POSInitializer_1.posInitializer.initialize();
        Logger_1.logger.info('SERVER', 'Basic services started successfully');
        console.log('Basic services started successfully');
    }
    catch (error) {
        Logger_1.logger.error('SERVER', 'Failed to start services', { error: error.message });
        console.error('Failed to start services:', error);
    }
});
process.on('SIGTERM', async () => {
    Logger_1.logger.info('SERVER', 'SIGTERM received, shutting down gracefully');
    console.log('SIGTERM received, shutting down gracefully');
    try {
        await POSInitializer_1.posInitializer.shutdown();
        Logger_1.logger.info('SERVER', 'POS initializer shutdown complete');
    }
    catch (error) {
        Logger_1.logger.error('SERVER', 'Error during shutdown', { error: error.message });
        console.error('Error during shutdown:', error);
    }
    server.close(() => {
        Logger_1.logger.info('SERVER', 'HTTP server closed');
        console.log('HTTP server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    Logger_1.logger.info('SERVER', 'SIGINT received, shutting down gracefully');
    console.log('SIGINT received, shutting down gracefully');
    try {
        await POSInitializer_1.posInitializer.shutdown();
        Logger_1.logger.info('SERVER', 'POS initializer shutdown complete');
    }
    catch (error) {
        Logger_1.logger.error('SERVER', 'Error during shutdown', { error: error.message });
        console.error('Error during shutdown:', error);
    }
    server.close(() => {
        Logger_1.logger.info('SERVER', 'HTTP server closed');
        console.log('HTTP server closed');
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map