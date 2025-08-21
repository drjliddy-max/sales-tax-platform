"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posInitializer = exports.POSInitializer = void 0;
const POSAdapter_1 = require("../database/POSAdapter");
const registryRoutes_1 = require("../../api/pos/registryRoutes");
const pluginRoutes_1 = require("../../api/pos/pluginRoutes");
class POSInitializer {
    constructor() {
        this.initialized = false;
    }
    static getInstance() {
        if (!POSInitializer.instance) {
            POSInitializer.instance = new POSInitializer();
        }
        return POSInitializer.instance;
    }
    async initialize() {
        if (this.initialized) {
            console.log('POS system already initialized');
            return;
        }
        try {
            console.log('🔧 Initializing POS systems...');
            await POSAdapter_1.posAdapter.initializeDefaults();
            (0, registryRoutes_1.initializePOSRegistry)(POSAdapter_1.posAdapter);
            console.log('✅ POS Registry initialized');
            (0, pluginRoutes_1.initializePluginManager)(POSAdapter_1.posAdapter);
            console.log('✅ POS Plugin Manager initialized');
            this.initialized = true;
            console.log('🎉 POS system initialization complete');
        }
        catch (error) {
            console.error('❌ Failed to initialize POS system:', error);
            throw error;
        }
    }
    isInitialized() {
        return this.initialized;
    }
    async cleanup() {
        try {
            console.log('🧹 Cleaning up POS systems...');
            this.initialized = false;
            console.log('✅ POS systems cleaned up');
        }
        catch (error) {
            console.error('❌ Error during POS cleanup:', error);
        }
    }
}
exports.POSInitializer = POSInitializer;
exports.posInitializer = POSInitializer.getInstance();
//# sourceMappingURL=POSInitializer.js.map