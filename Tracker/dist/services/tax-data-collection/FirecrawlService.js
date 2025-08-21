"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirecrawlService = void 0;
const firecrawl_js_1 = __importDefault(require("@mendable/firecrawl-js"));
const utils_1 = require("@/utils");
const models_1 = require("@/models");
class FirecrawlService {
    constructor() {
        this.taxRateSources = [];
        if (!process.env.FIRECRAWL_API_KEY) {
            utils_1.logger.warn('FIRECRAWL_API_KEY not set - Firecrawl features will be disabled');
            this.firecrawl = null;
        }
        else {
            this.firecrawl = new firecrawl_js_1.default({ apiKey: process.env.FIRECRAWL_API_KEY });
        }
        this.initializeTaxRateSources();
    }
    initializeTaxRateSources() {
        this.taxRateSources = [
            {
                name: 'Texas Comptroller',
                url: 'https://comptroller.texas.gov/taxes/sales/',
                state: 'TX',
                extractionPattern: 'sales tax rates, local tax rates, quarterly updates',
                updateFrequency: 'quarterly'
            },
            {
                name: 'California CDTFA',
                url: 'https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm',
                state: 'CA',
                extractionPattern: 'tax rates, effective dates, district taxes',
                apiEndpoint: 'https://services.maps.cdtfa.ca.gov/api/taxrate/',
                updateFrequency: 'monthly'
            },
            {
                name: 'Colorado Department of Revenue',
                url: 'https://tax.colorado.gov/sales-tax-changes',
                state: 'CO',
                extractionPattern: 'sales tax rate changes, effective dates',
                updateFrequency: 'monthly'
            }
        ];
    }
    async collectTaxRateUpdates() {
        if (!this.firecrawl) {
            utils_1.logger.warn('Firecrawl not available - returning empty tax data');
            return [];
        }
        const allTaxData = [];
        for (const source of this.taxRateSources) {
            try {
                utils_1.logger.info(`Collecting tax rate updates from ${source.name}`);
                const scrapedData = await this.collectFromWebsite(source);
                allTaxData.push(...scrapedData);
                source.lastCrawled = new Date();
            }
            catch (error) {
                utils_1.logger.error(`Failed to collect from ${source.name}:`, error);
            }
        }
        return allTaxData;
    }
    async collectFromWebsite(source) {
        const taxData = [];
        if (!this.firecrawl) {
            return taxData;
        }
        try {
            const result = await this.firecrawl.scrapeUrl(source.url, {
                formats: ['markdown'],
                onlyMainContent: true
            });
            if (result.success && result.markdown) {
                const parsedData = this.parseMarkdownForTaxRates(result.markdown, source);
                taxData.push(...parsedData);
            }
        }
        catch (error) {
            utils_1.logger.error(`Error scraping ${source.name}:`, error);
        }
        return taxData;
    }
    parseMarkdownForTaxRates(markdown, source) {
        const taxData = [];
        const rateMatches = markdown.match(/(\d+\.?\d*)%/g);
        if (rateMatches) {
            for (const match of rateMatches.slice(0, 5)) {
                const rate = parseFloat(match.replace(/%/g, ''));
                if (rate > 0 && rate < 15) {
                    taxData.push({
                        state: source.state,
                        jurisdiction: source.state,
                        jurisdictionType: 'state',
                        rate,
                        effectiveDate: new Date(),
                        source: source.name,
                        sourceUrl: source.url
                    });
                }
            }
        }
        return taxData;
    }
    async crawlSpecificJurisdiction(state, jurisdiction) {
        if (!this.firecrawl) {
            return [];
        }
        const searchQuery = `"${jurisdiction}" "${state}" sales tax rate official`;
        try {
            const searchResults = await this.firecrawl.search(searchQuery, {
                limit: 3
            });
            const results = [];
            if (searchResults.data) {
                for (const result of searchResults.data) {
                    if (result.url?.includes('.gov')) {
                        results.push({
                            state,
                            jurisdiction: jurisdiction || state,
                            jurisdictionType: jurisdiction ? 'city' : 'state',
                            rate: 0,
                            effectiveDate: new Date(),
                            source: 'Firecrawl Search',
                            sourceUrl: result.url
                        });
                    }
                }
            }
            return results;
        }
        catch (error) {
            utils_1.logger.error(`Error crawling ${state} ${jurisdiction}:`, error);
            return [];
        }
    }
    async updateTaxRatesInDatabase(taxData) {
        let updatedCount = 0;
        for (const data of taxData) {
            try {
                const existing = await models_1.TaxRate.findOne({
                    state: data.state,
                    jurisdiction: data.jurisdiction,
                    jurisdictionType: data.jurisdictionType
                });
                if (!existing || existing.rate !== data.rate) {
                    await models_1.TaxRate.findOneAndUpdate({
                        state: data.state,
                        jurisdiction: data.jurisdiction,
                        jurisdictionType: data.jurisdictionType
                    }, {
                        ...data,
                        lastUpdated: new Date(),
                        isActive: true
                    }, { upsert: true, new: true });
                    updatedCount++;
                    utils_1.logger.info(`Updated tax rate for ${data.state} - ${data.jurisdiction}: ${data.rate}%`);
                }
            }
            catch (error) {
                utils_1.logger.error(`Failed to update tax rate for ${data.state} - ${data.jurisdiction}:`, error);
            }
        }
        return updatedCount;
    }
    async monitorComplianceChanges() {
        if (!this.firecrawl) {
            return [];
        }
        const complianceUpdates = [];
        const complianceSources = [
            'https://comptroller.texas.gov/taxes/sales/',
            'https://cdtfa.ca.gov/taxes-and-fees/',
            'https://tax.colorado.gov/sales-tax-changes'
        ];
        for (const url of complianceSources) {
            try {
                const result = await this.firecrawl.scrapeUrl(url, {
                    formats: ['markdown'],
                    onlyMainContent: true
                });
                if (result.success && result.markdown) {
                    complianceUpdates.push({
                        source: url,
                        content: result.markdown.substring(0, 1000),
                        timestamp: new Date()
                    });
                }
            }
            catch (error) {
                utils_1.logger.error(`Error monitoring compliance changes from ${url}:`, error);
            }
        }
        return complianceUpdates;
    }
    async getSourcesNeedingUpdate() {
        const now = new Date();
        return this.taxRateSources.filter(source => {
            if (!source.lastCrawled)
                return true;
            const daysSinceLastCrawl = Math.floor((now.getTime() - source.lastCrawled.getTime()) / (1000 * 60 * 60 * 24));
            switch (source.updateFrequency) {
                case 'daily': return daysSinceLastCrawl >= 1;
                case 'weekly': return daysSinceLastCrawl >= 7;
                case 'monthly': return daysSinceLastCrawl >= 30;
                case 'quarterly': return daysSinceLastCrawl >= 90;
                default: return true;
            }
        });
    }
}
exports.FirecrawlService = FirecrawlService;
//# sourceMappingURL=FirecrawlService.js.map