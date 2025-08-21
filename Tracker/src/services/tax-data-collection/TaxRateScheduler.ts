import * as cron from 'node-cron';
import { FirecrawlService } from './FirecrawlService';
import { ComplianceMonitor } from './ComplianceMonitor';
import { TaxRateValidator } from './TaxRateValidator';
import { logger } from '@/utils';

interface ScheduleConfig {
  dailyUpdates: boolean;
  weeklyUpdates: boolean;
  monthlyUpdates: boolean;
  quarterlyUpdates: boolean;
  complianceChecks: boolean;
  emergencyMode: boolean;
}

export class TaxRateScheduler {
  private firecrawlService: FirecrawlService;
  private complianceMonitor: ComplianceMonitor;
  private validator: TaxRateValidator;
  private schedules: Map<string, cron.ScheduledTask>;
  private config: ScheduleConfig;

  constructor(config: Partial<ScheduleConfig> = {}) {
    this.firecrawlService = new FirecrawlService();
    this.complianceMonitor = new ComplianceMonitor();
    this.validator = new TaxRateValidator();
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

  startScheduledUpdates(): void {
    logger.info('Starting tax rate update schedules');

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

    logger.info(`Started ${this.schedules.size} scheduled tasks`);
  }

  private scheduleDailyUpdates(): void {
    // Daily check for high-frequency jurisdictions (every day at 2 AM)
    const dailyTask = cron.schedule('0 2 * * *', async () => {
      logger.info('Running daily tax rate updates');
      try {
        await this.runDailyUpdateCheck();
      } catch (error) {
        logger.error('Daily update check failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.schedules.set('daily', dailyTask);
    dailyTask.start();
  }

  private scheduleWeeklyUpdates(): void {
    // Weekly comprehensive update (Sundays at 1 AM)
    const weeklyTask = cron.schedule('0 1 * * 0', async () => {
      logger.info('Running weekly comprehensive tax rate updates');
      try {
        await this.runWeeklyUpdate();
      } catch (error) {
        logger.error('Weekly update failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.schedules.set('weekly', weeklyTask);
    weeklyTask.start();
  }

  private scheduleMonthlyUpdates(): void {
    // Monthly full refresh (1st day of month at midnight)
    const monthlyTask = cron.schedule('0 0 1 * *', async () => {
      logger.info('Running monthly full tax rate refresh');
      try {
        await this.runMonthlyFullRefresh();
      } catch (error) {
        logger.error('Monthly refresh failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.schedules.set('monthly', monthlyTask);
    monthlyTask.start();
  }

  private scheduleQuarterlyUpdates(): void {
    // Quarterly deep compliance check (1st day of quarter at 3 AM)
    const quarterlyTask = cron.schedule('0 3 1 1,4,7,10 *', async () => {
      logger.info('Running quarterly compliance deep check');
      try {
        await this.runQuarterlyComplianceCheck();
      } catch (error) {
        logger.error('Quarterly compliance check failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.schedules.set('quarterly', quarterlyTask);
    quarterlyTask.start();
  }

  private scheduleComplianceChecks(): void {
    // Compliance monitoring (every 6 hours)
    const complianceTask = cron.schedule('0 */6 * * *', async () => {
      logger.info('Running compliance monitoring check');
      try {
        await this.runComplianceCheck();
      } catch (error) {
        logger.error('Compliance check failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.schedules.set('compliance', complianceTask);
    complianceTask.start();
  }

  private scheduleEmergencyUpdates(): void {
    // Emergency mode: check every hour
    const emergencyTask = cron.schedule('0 * * * *', async () => {
      logger.info('Running emergency tax rate check');
      try {
        await this.runEmergencyCheck();
      } catch (error) {
        logger.error('Emergency check failed:', error);
      }
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.schedules.set('emergency', emergencyTask);
    emergencyTask.start();
  }

  private async runDailyUpdateCheck(): Promise<void> {
    const sourcesNeedingUpdate = await this.firecrawlService.getSourcesNeedingUpdate();
    const highFrequencySources = sourcesNeedingUpdate.filter(
      source => source.updateFrequency === 'daily'
    );

    if (highFrequencySources.length > 0) {
      logger.info(`Processing ${highFrequencySources.length} daily update sources`);
      
      for (const source of highFrequencySources) {
        try {
          const taxData = await this.firecrawlService.crawlSpecificJurisdiction(source.state, '');
          const validation = await this.validator.validateBatchData(taxData);
          
          if (validation.valid.length > 0) {
            const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(validation.valid);
            logger.info(`Daily update: ${updateCount} rates updated from ${source.name}`);
          }
          
          if (validation.invalid.length > 0) {
            logger.warn(`Daily update: ${validation.invalid.length} invalid rates from ${source.name}`);
          }
        } catch (error) {
          logger.error(`Daily update failed for ${source.name}:`, error);
        }
      }
    }
  }

  private async runWeeklyUpdate(): Promise<void> {
    logger.info('Starting weekly comprehensive update');
    
    const allTaxData = await this.firecrawlService.collectTaxRateUpdates();
    const validation = await this.validator.validateBatchData(allTaxData);
    
    logger.info(`Weekly update validation: ${validation.summary.valid} valid, ${validation.summary.invalid} invalid rates`);
    
    if (validation.valid.length > 0) {
      const crossValidation = await this.validator.crossValidateWithExistingRates(validation.valid);
      
      logger.info(`Cross-validation: ${crossValidation.conflicts.length} conflicts, ${crossValidation.newRates.length} new rates`);
      
      // Update all valid rates
      const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(validation.valid);
      logger.info(`Weekly update completed: ${updateCount} rates updated`);
      
      // Log conflicts for manual review
      if (crossValidation.conflicts.length > 0) {
        logger.warn('Rate conflicts detected during weekly update:', {
          conflicts: crossValidation.conflicts.length,
          details: crossValidation.conflicts.slice(0, 5) // Log first 5 conflicts
        });
      }
    }
  }

  private async runMonthlyFullRefresh(): Promise<void> {
    logger.info('Starting monthly full refresh');
    
    try {
      // Mark all current rates as potentially stale
      await this.markRatesForRefresh();
      
      // Collect all available tax data
      const allTaxData = await this.firecrawlService.collectTaxRateUpdates();
      
      // Validate everything
      const validation = await this.validator.validateBatchData(allTaxData);
      
      logger.info(`Monthly refresh validation: ${validation.summary.valid} valid, ${validation.summary.invalid} invalid rates`);
      
      // Update database
      const updateCount = await this.firecrawlService.updateTaxRatesInDatabase(validation.valid);
      
      // Generate monthly report
      const endDate = new Date();
      const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
      const report = await this.complianceMonitor.generateComplianceReport(startDate, endDate);
      
      logger.info(`Monthly refresh completed: ${updateCount} rates updated`, {
        reportSummary: report.summary
      });
      
    } catch (error) {
      logger.error('Monthly full refresh failed:', error);
    }
  }

  private async runQuarterlyComplianceCheck(): Promise<void> {
    logger.info('Starting quarterly compliance deep check');
    
    try {
      const complianceAlerts = await this.complianceMonitor.performComplianceCheck();
      const criticalAlerts = complianceAlerts.filter(alert => alert.severity === 'critical');
      
      logger.info(`Quarterly compliance check: ${complianceAlerts.length} total alerts, ${criticalAlerts.length} critical`);
      
      if (criticalAlerts.length > 0) {
        logger.warn('CRITICAL compliance alerts detected:', {
          alerts: criticalAlerts.map(a => ({
            title: a.title,
            affectedStates: a.affectedStates,
            effectiveDate: a.effectiveDate
          }))
        });
      }
      
      // Monitor jurisdiction boundary changes
      const states = ['TX', 'CA', 'NY', 'FL', 'CO'];
      const jurisdictionAlerts = await this.complianceMonitor.monitorJurisdictionChanges(states);
      
      if (jurisdictionAlerts.length > 0) {
        logger.info(`Jurisdiction changes detected: ${jurisdictionAlerts.length} updates`);
      }
      
    } catch (error) {
      logger.error('Quarterly compliance check failed:', error);
    }
  }

  private async runComplianceCheck(): Promise<void> {
    try {
      const complianceUpdates = await this.firecrawlService.monitorComplianceChanges();
      
      if (complianceUpdates.length > 0) {
        logger.info(`Compliance monitoring: ${complianceUpdates.length} updates detected`);
        
        for (const update of complianceUpdates) {
          if (update.data.announcements && update.data.announcements.length > 0) {
            logger.info(`New announcements from ${update.source}:`, {
              count: update.data.announcements.length,
              titles: update.data.announcements.map((a: any) => a.title).slice(0, 3)
            });
          }
        }
      }
    } catch (error) {
      logger.error('Compliance monitoring check failed:', error);
    }
  }

  private async runEmergencyCheck(): Promise<void> {
    logger.info('Running emergency tax rate check');
    
    try {
      const urgentUpdates = await this.checkForUrgentUpdates();
      
      if (urgentUpdates.length > 0) {
        logger.warn(`EMERGENCY: ${urgentUpdates.length} urgent tax updates detected`);
        
        for (const update of urgentUpdates) {
          await this.processUrgentUpdate(update);
        }
      }
    } catch (error) {
      logger.error('Emergency check failed:', error);
    }
  }

  private async checkForUrgentUpdates(): Promise<any[]> {
    const urgentKeywords = [
      'emergency tax rate change',
      'immediate effect',
      'urgent compliance',
      'critical tax update'
    ];
    
    const urgentUpdates: any[] = [];
    
    for (const keyword of urgentKeywords) {
      try {
        const searchResults = await this.firecrawlService['firecrawl'].search(keyword, {
          limit: 3,
          tbs: 'qdr:d', // Last day only
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
      } catch (error) {
        logger.error(`Error searching for urgent updates with keyword "${keyword}":`, error);
      }
    }
    
    return urgentUpdates;
  }

  private async processUrgentUpdate(update: any): Promise<void> {
    logger.warn('Processing urgent tax update:', {
      source: update.source,
      keyword: update.keyword,
      timestamp: update.timestamp
    });
    
    // Immediate processing for urgent updates
    // This would trigger immediate notifications and priority processing
  }

  private async markRatesForRefresh(): Promise<void> {
    const { TaxRate } = await import('@/models');
    
    await TaxRate.updateMany(
      { isActive: true },
      { 
        $set: { 
          needsRefresh: true,
          lastRefreshCheck: new Date()
        }
      }
    );
  }

  stopAllSchedules(): void {
    logger.info('Stopping all scheduled tax rate updates');
    
    for (const [name, task] of this.schedules) {
      task.stop();
      logger.info(`Stopped schedule: ${name}`);
    }
    
    this.schedules.clear();
  }

  getScheduleStatus(): any {
    const status: any = {};
    
    for (const [name, task] of this.schedules) {
      status[name] = {
        running: true, // Simplified since cron tasks don't expose these properties
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

  async manualUpdate(states?: string[]): Promise<any> {
    logger.info('Running manual tax rate update', { states });
    
    try {
      const startTime = new Date();
      
      let taxData;
      if (states && states.length > 0) {
        // Update specific states only
        taxData = [];
        for (const state of states) {
          const stateData = await this.firecrawlService.crawlSpecificJurisdiction(state, '');
          taxData.push(...stateData);
        }
      } else {
        // Update all available sources
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
      
      logger.info('Manual update completed:', result);
      
      return result;
    } catch (error) {
      logger.error('Manual update failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  async enableEmergencyMode(): Promise<void> {
    logger.warn('ENABLING EMERGENCY MODE - Hourly tax rate checks activated');
    
    this.config.emergencyMode = true;
    
    if (!this.schedules.has('emergency')) {
      this.scheduleEmergencyUpdates();
    }
  }

  async disableEmergencyMode(): Promise<void> {
    logger.info('Disabling emergency mode');
    
    this.config.emergencyMode = false;
    
    const emergencyTask = this.schedules.get('emergency');
    if (emergencyTask) {
      emergencyTask.stop();
      this.schedules.delete('emergency');
    }
  }

  async scheduleCustomUpdate(cronExpression: string, description: string): Promise<string> {
    const taskId = `custom_${Date.now()}`;
    
    const customTask = cron.schedule(cronExpression, async () => {
      logger.info(`Running custom scheduled update: ${description}`);
      try {
        await this.firecrawlService.collectTaxRateUpdates();
      } catch (error) {
        logger.error(`Custom update "${description}" failed:`, error);
      }
    }, { 
      scheduled: false,
      timezone: 'America/New_York'
    });

    this.schedules.set(taskId, customTask);
    customTask.start();
    
    logger.info(`Scheduled custom update: ${description} (${cronExpression})`);
    
    return taskId;
  }

  removeCustomSchedule(taskId: string): boolean {
    const task = this.schedules.get(taskId);
    
    if (task && taskId.startsWith('custom_')) {
      task.stop();
      this.schedules.delete(taskId);
      logger.info(`Removed custom schedule: ${taskId}`);
      return true;
    }
    
    return false;
  }
}