interface ComplianceAlert {
    id: string;
    type: 'rate_change' | 'filing_deadline' | 'exemption_change' | 'new_requirement';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    affectedStates: string[];
    affectedJurisdictions: string[];
    effectiveDate: Date;
    actionRequired: string;
    sourceUrl: string;
    createdAt: Date;
    resolved: boolean;
}
export declare class ComplianceMonitor {
    private firecrawlService;
    private validator;
    private monitoringUrls;
    private alertThresholds;
    constructor();
    private initializeMonitoringUrls;
    private initializeAlertThresholds;
    performComplianceCheck(): Promise<ComplianceAlert[]>;
    private checkComplianceSource;
    private parseComplianceContent;
    private categorizeByKeyword;
    private createComplianceAlert;
    private generateAlertId;
    monitorJurisdictionChanges(states: string[]): Promise<ComplianceAlert[]>;
    generateComplianceReport(startDate: Date, endDate: Date): Promise<any>;
    private groupAlertsByState;
    private groupAlertsByType;
    private generateRecommendations;
    private getStatesWithMultipleChanges;
}
export {};
//# sourceMappingURL=ComplianceMonitor.d.ts.map