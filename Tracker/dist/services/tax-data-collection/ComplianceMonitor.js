"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplianceMonitor = void 0;
const FirecrawlService_1 = require("./FirecrawlService");
const TaxRateValidator_1 = require("./TaxRateValidator");
const utils_1 = require("@/utils");
class ComplianceMonitor {
    constructor() {
        this.monitoringUrls = new Map();
        this.alertThresholds = new Map();
        this.firecrawlService = new FirecrawlService_1.FirecrawlService();
        this.validator = new TaxRateValidator_1.TaxRateValidator();
        this.initializeMonitoringUrls();
        this.initializeAlertThresholds();
    }
    initializeMonitoringUrls() {
        this.monitoringUrls = new Map([
            ['TX', [
                    'https://comptroller.texas.gov/taxes/sales/',
                    'https://comptroller.texas.gov/taxes/sales/quarterly-updates/'
                ]],
            ['CA', [
                    'https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm',
                    'https://cdtfa.ca.gov/taxes-and-fees/explanationoftaxratechanges.htm'
                ]],
            ['CO', [
                    'https://tax.colorado.gov/sales-tax-changes'
                ]]
        ]);
    }
    initializeAlertThresholds() {
        this.alertThresholds = new Map([
            ['rate_change', 0.25],
            ['filing_deadline', 7],
            ['exemption_change', 0],
            ['new_requirement', 0]
        ]);
    }
    async performComplianceCheck() {
        const alerts = [];
        utils_1.logger.info('Starting comprehensive compliance monitoring check');
        for (const [state, urls] of this.monitoringUrls) {
            for (const url of urls) {
                try {
                    const stateAlerts = await this.checkComplianceSource(state, url);
                    alerts.push(...stateAlerts);
                }
                catch (error) {
                    utils_1.logger.error(`Error checking compliance for ${state} at ${url}:`, error);
                }
            }
        }
        return alerts;
    }
    async checkComplianceSource(state, url) {
        const alerts = [];
        try {
            const result = await this.firecrawlService['firecrawl'].scrapeUrl(url, {
                formats: ['markdown'],
                onlyMainContent: true
            });
            if (result.success && result.markdown) {
                const complianceAlerts = this.parseComplianceContent(result.markdown, state, url);
                alerts.push(...complianceAlerts);
            }
        }
        catch (error) {
            utils_1.logger.error(`Error scraping compliance source ${url}:`, error);
        }
        return alerts;
    }
    parseComplianceContent(markdown, state, sourceUrl) {
        const alerts = [];
        const alertKeywords = [
            'rate change',
            'effective date',
            'new requirement',
            'filing deadline',
            'compliance update',
            'tax holiday',
            'exemption change'
        ];
        for (const keyword of alertKeywords) {
            if (markdown.toLowerCase().includes(keyword)) {
                alerts.push(this.createComplianceAlert({
                    type: this.categorizeByKeyword(keyword),
                    severity: 'medium',
                    title: `${keyword} detected in ${state}`,
                    description: `Potential ${keyword} found in government website content`,
                    affectedStates: [state],
                    effectiveDate: new Date(),
                    sourceUrl,
                    actionRequired: `Review ${keyword} for compliance impact`
                }));
            }
        }
        return alerts;
    }
    categorizeByKeyword(keyword) {
        if (keyword.includes('rate'))
            return 'rate_change';
        if (keyword.includes('deadline') || keyword.includes('filing'))
            return 'filing_deadline';
        if (keyword.includes('exemption'))
            return 'exemption_change';
        return 'new_requirement';
    }
    createComplianceAlert(data) {
        return {
            id: this.generateAlertId(),
            type: data.type || 'new_requirement',
            severity: data.severity || 'medium',
            title: data.title || 'Compliance Update',
            description: data.description || '',
            affectedStates: data.affectedStates || [],
            affectedJurisdictions: data.affectedJurisdictions || [],
            effectiveDate: data.effectiveDate || new Date(),
            actionRequired: data.actionRequired || 'Review and take appropriate action',
            sourceUrl: data.sourceUrl || '',
            createdAt: new Date(),
            resolved: false
        };
    }
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async monitorJurisdictionChanges(states) {
        const alerts = [];
        for (const state of states) {
            try {
                const searchResults = await this.firecrawlService['firecrawl'].search(`${state} sales tax jurisdiction boundary changes city annexation 2025`, { limit: 2 });
                if (searchResults.data && searchResults.data.length > 0) {
                    alerts.push(this.createComplianceAlert({
                        type: 'new_requirement',
                        severity: 'medium',
                        title: `Jurisdiction Changes - ${state}`,
                        description: 'Potential boundary changes detected',
                        affectedStates: [state],
                        effectiveDate: new Date(),
                        sourceUrl: searchResults.data[0].url || '',
                        actionRequired: 'Verify jurisdiction mappings'
                    }));
                }
            }
            catch (error) {
                utils_1.logger.error(`Error monitoring jurisdiction changes for ${state}:`, error);
            }
        }
        return alerts;
    }
    async generateComplianceReport(startDate, endDate) {
        const alerts = await this.performComplianceCheck();
        return {
            reportPeriod: { startDate, endDate },
            summary: {
                totalAlerts: alerts.length,
                criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
                unresolvedAlerts: alerts.filter(a => !a.resolved).length
            },
            alertsByState: this.groupAlertsByState(alerts),
            alertsByType: this.groupAlertsByType(alerts),
            recommendations: this.generateRecommendations(alerts)
        };
    }
    groupAlertsByState(alerts) {
        const grouped = {};
        for (const alert of alerts) {
            for (const state of alert.affectedStates) {
                if (!grouped[state]) {
                    grouped[state] = [];
                }
                grouped[state].push(alert);
            }
        }
        return grouped;
    }
    groupAlertsByType(alerts) {
        const grouped = {};
        for (const alert of alerts) {
            if (!grouped[alert.type]) {
                grouped[alert.type] = [];
            }
            grouped[alert.type].push(alert);
        }
        return grouped;
    }
    generateRecommendations(alerts) {
        const recommendations = [];
        if (alerts.filter(a => a.severity === 'critical').length > 0) {
            recommendations.push('Schedule immediate review of critical compliance alerts');
        }
        const statesWithMultipleChanges = this.getStatesWithMultipleChanges(alerts);
        if (statesWithMultipleChanges.length > 0) {
            recommendations.push(`Increase monitoring frequency for: ${statesWithMultipleChanges.join(', ')}`);
        }
        return recommendations;
    }
    getStatesWithMultipleChanges(alerts) {
        const stateCounts = new Map();
        for (const alert of alerts) {
            for (const state of alert.affectedStates) {
                stateCounts.set(state, (stateCounts.get(state) || 0) + 1);
            }
        }
        return Array.from(stateCounts.entries())
            .filter(([_, count]) => count >= 3)
            .map(([state, _]) => state);
    }
}
exports.ComplianceMonitor = ComplianceMonitor;
//# sourceMappingURL=ComplianceMonitor.js.map