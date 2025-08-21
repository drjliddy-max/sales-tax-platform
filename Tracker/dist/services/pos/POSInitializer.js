"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posInitializer = exports.POSInitializer = void 0;
const POSInitializer_1 = require("../../../backend/src/lib/pos/POSInitializer");
const pluginRoutes_1 = require("../../../backend/src/api/pos/pluginRoutes");
const registryRoutes_1 = require("../../../backend/src/api/pos/registryRoutes");
const POSAdapter_1 = require("../../../backend/src/lib/database/POSAdapter");
class POSInitializer {
    constructor() {
        this.pluginManager = null;
        this.registry = null;
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
            return;
        }
        try {
            console.log('🔧 Initializing POS integration systems...');
            await POSInitializer_1.posInitializer.initialize();
            (0, pluginRoutes_1.initializePluginManager)(POSAdapter_1.posAdapter);
            (0, registryRoutes_1.initializePOSRegistry)(POSAdapter_1.posAdapter);
            this.initialized = true;
            console.log('✅ POS integration systems initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize POS integration systems:', error);
            throw error;
        }
    }
    async findPOSPlugins(query) {
        return {
            toArray: async () => {
                return [];
            }
        };
    }
    async findPOSRegistry(query) {
        return {
            toArray: async () => {
                return [];
            }
        };
    }
    async upsertPOSPlugin(filter, data, options) {
        console.log('POS Plugin upsert:', filter, data);
        return { acknowledged: true };
    }
    async upsertPOSRegistry(filter, data, options) {
        console.log('POS Registry upsert:', filter, data);
        return { acknowledged: true };
    }
    async updatePOSPlugin(filter, update) {
        console.log('POS Plugin update:', filter, update);
        return { acknowledged: true };
    }
    async updatePOSRegistry(filter, update) {
        console.log('POS Registry update:', filter, update);
        return { acknowledged: true };
    }
    async shutdown() {
        if (!this.initialized) {
            return;
        }
        try {
            console.log('🛑 Shutting down POS integration systems...');
            await POSInitializer_1.posInitializer.cleanup();
            this.initialized = false;
            console.log('✅ POS integration systems shut down successfully');
        }
        catch (error) {
            console.error('❌ Error during POS shutdown:', error);
            this.initialized = false;
        }
    }
}
exports.POSInitializer = POSInitializer;
exports.posInitializer = POSInitializer.getInstance();
//# sourceMappingURL=POSInitializer.js.map