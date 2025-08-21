import { TaxRateScheduler } from '@/services/tax-data-collection';
import { logger } from '@/utils';

export class TaxUpdateInitializer {
  private scheduler: TaxRateScheduler;

  constructor() {
    this.scheduler = new TaxRateScheduler({
      dailyUpdates: process.env.NODE_ENV === 'production',
      weeklyUpdates: true,
      monthlyUpdates: true,
      quarterlyUpdates: true,
      complianceChecks: true,
      emergencyMode: false
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing tax update services');
      
      // Start scheduled updates
      this.scheduler.startScheduledUpdates();
      
      // Run initial update check if needed
      if (process.env.INITIAL_TAX_UPDATE === 'true') {
        logger.info('Running initial tax rate update');
        await this.scheduler.manualUpdate();
      }
      
      logger.info('Tax update services initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize tax update services:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down tax update services');
      this.scheduler.stopAllSchedules();
      logger.info('Tax update services stopped');
    } catch (error) {
      logger.error('Error during tax update service shutdown:', error);
    }
  }

  getStatus(): any {
    return this.scheduler.getScheduleStatus();
  }
}