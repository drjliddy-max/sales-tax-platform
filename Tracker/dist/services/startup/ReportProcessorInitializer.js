"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportProcessorInitializer = exports.ReportProcessorInitializer = void 0;
const ReportProcessor_1 = require("../reporting/ReportProcessor");
class ReportProcessorInitializer {
    constructor() {
        this.initialized = false;
    }
    static getInstance() {
        if (!ReportProcessorInitializer.instance) {
            ReportProcessorInitializer.instance = new ReportProcessorInitializer();
        }
        return ReportProcessorInitializer.instance;
    }
    async initialize() {
        if (this.initialized) {
            console.log('⚠️ Report processor already initialized');
            return;
        }
        try {
            console.log('🚀 Initializing Report Processor...');
            const isEnabled = process.env.ENABLE_REPORT_PROCESSING !== 'false';
            if (!isEnabled) {
                console.log('ℹ️ Report processing disabled by environment variable');
                return;
            }
            ReportProcessor_1.reportProcessor.start();
            const status = ReportProcessor_1.reportProcessor.getStatus();
            console.log('📊 Report Processor Status:', status);
            this.initialized = true;
            console.log('✅ Report Processor initialized successfully');
            this.setupGracefulShutdown();
        }
        catch (error) {
            console.error('❌ Failed to initialize Report Processor:', error);
            throw error;
        }
    }
    getProcessor() {
        return ReportProcessor_1.reportProcessor;
    }
    isInitialized() {
        return this.initialized;
    }
    async shutdown() {
        if (!this.initialized) {
            return;
        }
        try {
            console.log('🛑 Shutting down Report Processor...');
            ReportProcessor_1.reportProcessor.stop();
            this.initialized = false;
            console.log('✅ Report Processor shutdown completed');
        }
        catch (error) {
            console.error('❌ Error during Report Processor shutdown:', error);
            throw error;
        }
    }
    setupGracefulShutdown() {
        const shutdownHandler = async (signal) => {
            console.log(`📡 Received ${signal}, initiating graceful shutdown...`);
            try {
                await this.shutdown();
                process.exit(0);
            }
            catch (error) {
                console.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
        process.on('SIGINT', () => shutdownHandler('SIGINT'));
        process.on('SIGQUIT', () => shutdownHandler('SIGQUIT'));
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception in Report Processor:', error);
            shutdownHandler('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection in Report Processor:', reason, 'at', promise);
            shutdownHandler('unhandledRejection');
        });
    }
}
exports.ReportProcessorInitializer = ReportProcessorInitializer;
exports.reportProcessorInitializer = ReportProcessorInitializer.getInstance();
//# sourceMappingURL=ReportProcessorInitializer.js.map