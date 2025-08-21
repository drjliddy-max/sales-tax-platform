"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxRateScheduler = void 0;
const cron = __importStar(require("node-cron"));
const FirecrawlService_1 = require("./FirecrawlService");
const ComplianceMonitor_1 = require("./ComplianceMonitor");
const TaxRateValidator_1 = require("./TaxRateValidator");
const utils_1 = require("@/utils");
class TaxRateScheduler {
    constructor(config = {}) {
        this.firecrawlService = new FirecrawlService_1.FirecrawlService();
        this.complianceMonitor = new ComplianceMonitor_1.ComplianceMonitor();
        this.validator = new TaxRateValidator_1.TaxRateValidator();
        this.schedules = new Map();
        this.config = {
            dailyUpdates: true,
            weeklyUpdates: true,
            monthlyUpdates: true,
            quarterlyUpdates: true,
            complianceChecks: true,
            emergencyMode: false,
            ...config
        };
    }
    startScheduledUpdates() {
        utils_1.logger.info('Starting tax rate update schedules');
        if (this.config.dailyUpdates) {
            this.scheduleDailyUpdates();
        }
        if (this.config.weeklyUpdates) {
            this.scheduleWeeklyUpdates();
        }
        if (this.config.monthlyUpdates) {
            this.scheduleMonthlyUpdates();
        }
        if (this.config.quarterlyUpdates) {
            this.scheduleQuarterlyUpdates();
        }
        if (this.config.complianceChecks) {
            this.scheduleComplianceChecks();
        }
        if (this.config.emergencyMode) {
            this.scheduleEmergencyUpdates();
        }
        utils_1.logger.info(`Started ${this.schedules.size} scheduled tasks`);
    }
    scheduleDailyUpdates() {
        const dailyTask = cron.schedule('0 2 * * *', async () => {
            utils_1.logger.info('Running daily tax rate updates');
            try {
                await this.runDailyUpdateCheck();
            }
            catch (error) {
                utils_1.logger.error('Daily update check failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });
        this.schedules.set('daily', dailyTask);
        dailyTask.start();
    }
    scheduleWeeklyUpdates() {
        const weeklyTask = cron.schedule('0 1 * * 0', async () => {
            utils_1.logger.info('Running weekly comprehensive tax rate updates');
            try {
                await this.runWeeklyUpdate();
            }
            catch (error) {
                utils_1.logger.error('Weekly update failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });
        this.schedules.set('weekly', weeklyTask);
        weeklyTask.start();
    }
    scheduleMonthlyUpdates() {
        const monthlyTask = cron.schedule('0 0 1 * *', async () => {
            utils_1.logger.info('Running monthly full tax rate refresh');
            try {
                await this.runMonthlyFullRefresh();
            }
            catch (error) {
                utils_1.logger.error('Monthly refresh failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });
        this.schedules.set('monthly', monthlyTask);
        monthlyTask.start();
    }
    scheduleQuarterlyUpdates() {
        const quarterlyTask = cron.schedule('0 3 1 1,4,7,10 *', async () => {
            utils_1.logger.info('Running quarterly compliance deep check');
            try {
                await this.runQuarterlyComplianceCheck();
            }
            catch (error) {
                utils_1.logger.error('Quarterly compliance check failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });
        this.schedules.set('quarterly', quarterlyTask);
        quarterlyTask.start();
    }
    scheduleComplianceChecks() {
        const complianceTask = cron.schedule('0 */6 * * *', async () => {
            utils_1.logger.info('Running compliance monitoring check');
            try {
                await this.runComplianceCheck();
            }
            catch (error) {
                utils_1.logger.error('Compliance check failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });
        this.schedules.set('compliance', complianceTask);
        complianceTask.start();
    }
    scheduleEmergencyUpdates() {
        const emergencyTask = cron.schedule('0 * * * *', async () => {
            utils_1.logger.info('Running emergency tax rate check');
            try {
                await this.runEmergencyCheck();
            }
            catch (error) {
                utils_1.logger.error('Emergency check failed:', error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });
        this.schedules.set('emergency', emergencyTask);
        emergencyTask.start();
    }
    async runDailyUpdateCheck() {
        const sourcesNeedingUpdate = await this.firecrawlService.getSourcesNeedingUpdate();
        const highFrequencySources = sourcesNeedingUpdate.filter(source => source.updateFrequency === 'daily');
        if (highFrequencySources.length > 0) {
            utils_1.logger.info(`Processing ${highFrequencySources.length} daily update sources`);
            for (const source of highFrequencySources) {
                try {
                    const taxData = await this.firecrawlService.crawlSpecificJurisdiction(source.state, '');
                    const validation = await this.validator.validateBatchData(taxData);
                    if (validation.valid.length > 0) {
                        const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(validation.valid);
                        utils_1.logger.info(`Daily update: ${updateCount} rates updated from ${source.name}`);
                    }
                    if (validation.invalid.length > 0) {
                        utils_1.logger.warn(`Daily update: ${validation.invalid.length} invalid rates from ${source.name}`);
                    }
                }
                catch (error) {
                    utils_1.logger.error(`Daily update failed for ${source.name}:`, error);
                }
            }
        }
    }
    async runWeeklyUpdate() {
        utils_1.logger.info('Starting weekly comprehensive update');
        const allTaxData = await this.firecrawlService.collectTaxRateUpdates();
        const validation = await this.validator.validateBatchData(allTaxData);
        utils_1.logger.info(`Weekly update validation: ${validation.summary.valid} valid, ${validation.summary.invalid} invalid rates`);
        if (validation.valid.length > 0) {
            const crossValidation = await this.validator.crossValidateWithExistingRates(validation.valid);
            utils_1.logger.info(`Cross-validation: ${crossValidation.conflicts.length} conflicts, ${crossValidation.newRates.length} new rates`);
            const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(validation.valid);
            utils_1.logger.info(`Weekly update completed: ${updateCount} rates updated`);
            if (crossValidation.conflicts.length > 0) {
                utils_1.logger.warn('Rate conflicts detected during weekly update:', {
                    conflicts: crossValidation.conflicts.length,
                    details: crossValidation.conflicts.slice(0, 5)
                });
            }
        }
    }
    async runMonthlyFullRefresh() {
        utils_1.logger.info('Starting monthly full refresh');
        try {
            await this.markRatesForRefresh();
            const allTaxData = await this.firecrawlService.collectTaxRateUpdates();
            const validation = await this.validator.validateBatchData(allTaxData);
            utils_1.logger.info(`Monthly refresh validation: ${validation.summary.valid} valid, ${validation.summary.invalid} invalid rates`);
            const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(validation.valid);
            const endDate = new Date();
            const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
            const report = await this.complianceMonitor.generateComplianceReport(startDate, endDate);
            utils_1.logger.info(`Monthly refresh completed: ${updateCount} rates updated`, {
                reportSummary: report.summary
            });
        }
        catch (error) {
            utils_1.logger.error('Monthly full refresh failed:', error);
        }
    }
    async runQuarterlyComplianceCheck() {
        utils_1.logger.info('Starting quarterly compliance deep check');
        try {
            const complianceAlerts = await this.complianceMonitor.performComplianceCheck();
            const criticalAlerts = complianceAlerts.filter(alert => alert.severity === 'critical');
            utils_1.logger.info(`Quarterly compliance check: ${complianceAlerts.length} total alerts, ${criticalAlerts.length} critical`);
            if (criticalAlerts.length > 0) {
                utils_1.logger.warn('CRITICAL compliance alerts detected:', {
                    alerts: criticalAlerts.map(a => ({
                        title: a.title,
                        affectedStates: a.affectedStates,
                        effectiveDate: a.effectiveDate
                    }))
                });
            }
            const states = ['TX', 'CA', 'NY', 'FL', 'CO'];
            const jurisdictionAlerts = await this.complianceMonitor.monitorJurisdictionChanges(states);
            if (jurisdictionAlerts.length > 0) {
                utils_1.logger.info(`Jurisdiction changes detected: ${jurisdictionAlerts.length} updates`);
            }
        }
        catch (error) {
            utils_1.logger.error('Quarterly compliance check failed:', error);
        }
    }
    async runComplianceCheck() {
        try {
            const complianceUpdates = await this.firecrawlService.monitorComplianceChanges();
            if (complianceUpdates.length > 0) {
                utils_1.logger.info(`Compliance monitoring: ${complianceUpdates.length} updates detected`);
                for (const update of complianceUpdates) {
                    if (update.data.announcements && update.data.announcements.length > 0) {
                        utils_1.logger.info(`New announcements from ${update.source}:`, {
                            count: update.data.announcements.length,
                            titles: update.data.announcements.map((a) => a.title).slice(0, 3)
                        });
                    }
                }
            }
        }
        catch (error) {
            utils_1.logger.error('Compliance monitoring check failed:', error);
        }
    }
    async runEmergencyCheck() {
        utils_1.logger.info('Running emergency tax rate check');
        try {
            const urgentUpdates = await this.checkForUrgentUpdates();
            if (urgentUpdates.length > 0) {
                utils_1.logger.warn(`EMERGENCY: ${urgentUpdates.length} urgent tax updates detected`);
                for (const update of urgentUpdates) {
                    await this.processUrgentUpdate(update);
                }
            }
        }
        catch (error) {
            utils_1.logger.error('Emergency check failed:', error);
        }
    }
    async checkForUrgentUpdates() {
        const urgentKeywords = [
            'emergency tax rate change',
            'immediate effect',
            'urgent compliance',
            'critical tax update'
        ];
        const urgentUpdates = [];
        for (const keyword of urgentKeywords) {
            try {
                const searchResults = await this.firecrawlService['firecrawl'].search(keyword, {
                    limit: 3,
                    tbs: 'qdr:d',
                    scrapeOptions: {
                        formats: ['extract'],
                        onlyMainContent: true
                    }
                });
                if (searchResults.data) {
                    for (const result of searchResults.data) {
                        if (result.url?.includes('.gov') && result.extract) {
                            urgentUpdates.push({
                                source: result.url,
                                data: result.extract,
                                keyword,
                                timestamp: new Date()
                            });
                        }
                    }
                }
            }
            catch (error) {
                utils_1.logger.error(`Error searching for urgent updates with keyword "${keyword}":`, error);
            }
        }
        return urgentUpdates;
    }
    async processUrgentUpdate(update) {
        utils_1.logger.warn('Processing urgent tax update:', {
            source: update.source,
            keyword: update.keyword,
            timestamp: update.timestamp
        });
    }
    async markRatesForRefresh() {
        const { TaxRate } = await Promise.resolve().then(() => __importStar(require('@/models')));
        await TaxRate.updateMany({ isActive: true }, {
            $set: {
                needsRefresh: true,
                lastRefreshCheck: new Date()
            }
        });
    }
    stopAllSchedules() {
        utils_1.logger.info('Stopping all scheduled tax rate updates');
        for (const [name, task] of this.schedules) {
            task.stop();
            utils_1.logger.info(`Stopped schedule: ${name}`);
        }
        this.schedules.clear();
    }
    getScheduleStatus() {
        const status = {};
        for (const [name, task] of this.schedules) {
            status[name] = {
                running: true,
                lastRun: null,
                nextRun: null
            };
        }
        return {
            totalSchedules: this.schedules.size,
            config: this.config,
            schedules: status
        };
    }
    async manualUpdate(states) {
        utils_1.logger.info('Running manual tax rate update', { states });
        try {
            const startTime = new Date();
            let taxData;
            if (states && states.length > 0) {
                taxData = [];
                for (const state of states) {
                    const stateData = await this.firecrawlService.crawlSpecificJurisdiction(state, '');
                    taxData.push(...stateData);
                }
            }
            else {
                taxData = await this.firecrawlService.collectTaxRateUpdates();
            }
            const validation = await this.validator.validateBatchData(taxData);
            let updateCount = 0;
            if (validation.valid.length > 0) {
                updateCount = await this.firecrawlService.updateTaxRatesInDatabase(validation.valid);
            }
            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            const result = {
                success: true,
                duration: `${duration}ms`,
                summary: {
                    ...validation.summary,
                    updatedInDb: updateCount
                },
                timestamp: endTime
            };
            utils_1.logger.info('Manual update completed:', result);
            return result;
        }
        catch (error) {
            utils_1.logger.error('Manual update failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date()
            };
        }
    }
    async enableEmergencyMode() {
        utils_1.logger.warn('ENABLING EMERGENCY MODE - Hourly tax rate checks activated');
        this.config.emergencyMode = true;
        if (!this.schedules.has('emergency')) {
            this.scheduleEmergencyUpdates();
        }
    }
    async disableEmergencyMode() {
        utils_1.logger.info('Disabling emergency mode');
        this.config.emergencyMode = false;
        const emergencyTask = this.schedules.get('emergency');
        if (emergencyTask) {
            emergencyTask.stop();
            this.schedules.delete('emergency');
        }
    }
    async scheduleCustomUpdate(cronExpression, description) {
        const taskId = `custom_${Date.now()}`;
        const customTask = cron.schedule(cronExpression, async () => {
            utils_1.logger.info(`Running custom scheduled update: ${description}`);
            try {
                await this.firecrawlService.collectTaxRateUpdates();
            }
            catch (error) {
                utils_1.logger.error(`Custom update "${description}" failed:`, error);
            }
        }, {
            scheduled: false,
            timezone: 'America/New_York'
        });
        this.schedules.set(taskId, customTask);
        customTask.start();
        utils_1.logger.info(`Scheduled custom update: ${description} (${cronExpression})`);
        return taskId;
    }
    removeCustomSchedule(taskId) {
        const task = this.schedules.get(taskId);
        if (task && taskId.startsWith('custom_')) {
            task.stop();
            this.schedules.delete(taskId);
            utils_1.logger.info(`Removed custom schedule: ${taskId}`);
            return true;
        }
        return false;
    }
}
exports.TaxRateScheduler = TaxRateScheduler;
//# sourceMappingURL=TaxRateScheduler.js.map