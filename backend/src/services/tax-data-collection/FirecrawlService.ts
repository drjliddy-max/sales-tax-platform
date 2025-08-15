import FirecrawlApp from '@mendable/firecrawl-js';
import { logger } from '@/utils';
import { TaxRate } from '@/models';

interface TaxRateSource {
  name: string;
  url: string;
  state: string;
  extractionPattern: string;
  apiEndpoint?: string;
  updateFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  lastCrawled?: Date;
}

interface ExtractedTaxData {
  state: string;
  jurisdiction: string;
  jurisdictionType: 'state' | 'county' | 'city' | 'special';
  rate: number;
  effectiveDate: Date;
  source: string;
  sourceUrl: string;
  productCategories?: string[];
}

export class FirecrawlService {
  private firecrawl: FirecrawlApp;
  private taxRateSources: TaxRateSource[] = [];

  constructor() {
    if (!process.env.FIRECRAWL_API_KEY) {
      logger.warn('FIRECRAWL_API_KEY not set - Firecrawl features will be disabled');
      this.firecrawl = null as any; // Disabled mode
    } else {
      this.firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    }
    
    this.initializeTaxRateSources();
  }

  private initializeTaxRateSources(): void {
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

  async collectTaxRateUpdates(): Promise<ExtractedTaxData[]> {
    if (!this.firecrawl) {
      logger.warn('Firecrawl not available - returning empty tax data');
      return [];
    }

    const allTaxData: ExtractedTaxData[] = [];
    
    for (const source of this.taxRateSources) {
      try {
        logger.info(`Collecting tax rate updates from ${source.name}`);
        const scrapedData = await this.collectFromWebsite(source);
        allTaxData.push(...scrapedData);
        source.lastCrawled = new Date();
      } catch (error) {
        logger.error(`Failed to collect from ${source.name}:`, error);
      }
    }
    
    return allTaxData;
  }

  private async collectFromWebsite(source: TaxRateSource): Promise<ExtractedTaxData[]> {
    const taxData: ExtractedTaxData[] = [];
    
    if (!this.firecrawl) {
      return taxData;
    }
    
    try {
      const result = await this.firecrawl.scrapeUrl(source.url, {
        formats: ['markdown'],
        onlyMainContent: true
      });

      if (result.success && result.markdown) {
        // Parse the markdown content for tax rate information
        const parsedData = this.parseMarkdownForTaxRates(result.markdown, source);
        taxData.push(...parsedData);
      }
    } catch (error) {
      logger.error(`Error scraping ${source.name}:`, error);
    }
    
    return taxData;
  }

  private parseMarkdownForTaxRates(markdown: string, source: TaxRateSource): ExtractedTaxData[] {
    const taxData: ExtractedTaxData[] = [];
    
    // Simple parsing for demonstration - in production, this would be more sophisticated
    const rateMatches = markdown.match(/(\d+\.?\d*)%/g);
    
    if (rateMatches) {
      for (const match of rateMatches.slice(0, 5)) { // Limit to prevent too many false positives
        const rate = parseFloat(match.replace('%', ''));
        
        if (rate > 0 && rate < 15) { // Reasonable tax rate range
          taxData.push({
            state: source.state,
            jurisdiction: source.state, // Simplified
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

  async crawlSpecificJurisdiction(state: string, jurisdiction: string): Promise<ExtractedTaxData[]> {
    if (!this.firecrawl) {
      return [];
    }

    const searchQuery = `"${jurisdiction}" "${state}" sales tax rate official`;
    
    try {
      const searchResults = await this.firecrawl.search(searchQuery, {
        limit: 3
      });

      const results: ExtractedTaxData[] = [];
      
      if (searchResults.data) {
        for (const result of searchResults.data) {
          if (result.url?.includes('.gov')) {
            // Simple rate extraction from search results
            results.push({
              state,
              jurisdiction: jurisdiction || state,
              jurisdictionType: jurisdiction ? 'city' : 'state',
              rate: 0, // Would be extracted from actual content
              effectiveDate: new Date(),
              source: 'Firecrawl Search',
              sourceUrl: result.url
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      logger.error(`Error crawling ${state} ${jurisdiction}:`, error);
      return [];
    }
  }

  async updateTaxRatesInDatabase(taxData: ExtractedTaxData[]): Promise<number> {
    let updatedCount = 0;
    
    for (const data of taxData) {
      try {
        const existing = await TaxRate.findOne({
          state: data.state,
          jurisdiction: data.jurisdiction,
          jurisdictionType: data.jurisdictionType
        });

        if (!existing || existing.rate !== data.rate) {
          await TaxRate.findOneAndUpdate(
            {
              state: data.state,
              jurisdiction: data.jurisdiction,
              jurisdictionType: data.jurisdictionType
            },
            {
              ...data,
              lastUpdated: new Date(),
              isActive: true
            },
            { upsert: true, new: true }
          );
          
          updatedCount++;
          logger.info(`Updated tax rate for ${data.state} - ${data.jurisdiction}: ${data.rate}%`);
        }
      } catch (error) {
        logger.error(`Failed to update tax rate for ${data.state} - ${data.jurisdiction}:`, error);
      }
    }
    
    return updatedCount;
  }

  async monitorComplianceChanges(): Promise<any[]> {
    if (!this.firecrawl) {
      return [];
    }

    const complianceUpdates: any[] = [];
    
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
            content: result.markdown.substring(0, 1000), // Truncate for storage
            timestamp: new Date()
          });
        }
      } catch (error) {
        logger.error(`Error monitoring compliance changes from ${url}:`, error);
      }
    }
    
    return complianceUpdates;
  }

  async getSourcesNeedingUpdate(): Promise<TaxRateSource[]> {
    const now = new Date();
    
    return this.taxRateSources.filter(source => {
      if (!source.lastCrawled) return true;
      
      const daysSinceLastCrawl = Math.floor(
        (now.getTime() - source.lastCrawled.getTime()) / (1000 * 60 * 60 * 24)
      );
      
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