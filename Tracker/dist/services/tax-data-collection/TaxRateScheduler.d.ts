interface ScheduleConfig {
    dailyUpdates: boolean;
    weeklyUpdates: boolean;
    monthlyUpdates: boolean;
    quarterlyUpdates: boolean;
    complianceChecks: boolean;
    emergencyMode: boolean;
}
export declare class TaxRateScheduler {
    private firecrawlService;
    private complianceMonitor;
    private validator;
    private schedules;
    private config;
    constructor(config?: Partial<ScheduleConfig>);
    startScheduledUpdates(): void;
    private scheduleDailyUpdates;
    private scheduleWeeklyUpdates;
    private scheduleMonthlyUpdates;
    private scheduleQuarterlyUpdates;
    private scheduleComplianceChecks;
    private scheduleEmergencyUpdates;
    private runDailyUpdateCheck;
    private runWeeklyUpdate;
    private runMonthlyFullRefresh;
    private runQuarterlyComplianceCheck;
    private runComplianceCheck;
    private runEmergencyCheck;
    private checkForUrgentUpdates;
    private processUrgentUpdate;
    private markRatesForRefresh;
    stopAllSchedules(): void;
    getScheduleStatus(): any;
    manualUpdate(states?: string[]): Promise<any>;
    enableEmergencyMode(): Promise<void>;
    disableEmergencyMode(): Promise<void>;
    scheduleCustomUpdate(cronExpression: string, description: string): Promise<string>;
    removeCustomSchedule(taskId: string): boolean;
}
export {};
//# sourceMappingURL=TaxRateScheduler.d.ts.map