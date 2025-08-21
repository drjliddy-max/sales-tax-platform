"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxUpdateInitializer = void 0;
const tax_data_collection_1 = require("@/services/tax-data-collection");
const utils_1 = require("@/utils");
class TaxUpdateInitializer {
    constructor() {
        this.scheduler = new tax_data_collection_1.TaxRateScheduler({
            dailyUpdates: process.env.NODE_ENV === 'production',
            weeklyUpdates: true,
            monthlyUpdates: true,
            quarterlyUpdates: true,
            complianceChecks: true,
            emergencyMode: false
        });
    }
    async initialize() {
        try {
            utils_1.logger.info('Initializing tax update services');
            this.scheduler.startScheduledUpdates();
            if (process.env.INITIAL_TAX_UPDATE === 'true') {
                utils_1.logger.info('Running initial tax rate update');
                await this.scheduler.manualUpdate();
            }
            utils_1.logger.info('Tax update services initialized successfully');
        }
        catch (error) {
            utils_1.logger.error('Failed to initialize tax update services:', error);
            throw error;
        }
    }
    async shutdown() {
        try {
            utils_1.logger.info('Shutting down tax update services');
            this.scheduler.stopAllSchedules();
            utils_1.logger.info('Tax update services stopped');
        }
        catch (error) {
            utils_1.logger.error('Error during tax update service shutdown:', error);
        }
    }
    getStatus() {
        return this.scheduler.getScheduleStatus();
    }
}
exports.TaxUpdateInitializer = TaxUpdateInitializer;
//# sourceMappingURL=TaxUpdateInitializer.js.map