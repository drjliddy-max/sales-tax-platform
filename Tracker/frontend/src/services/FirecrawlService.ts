// Firecrawl Service - Frontend-compatible implementation
// Note: Full Firecrawl integration would be implemented on the backend

interface CrawledContent {
  url: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface TaxRateInfo {
  jurisdiction: string;
  rate: number;
  source: string;
  effectiveDate: string;
  lastUpdated: Date;
}

interface FilingRequirement {
  state: string;
  frequency: string;
  deadline: string;
  requirements: string[];
  source: string;
  lastUpdated: Date;
}

interface POSSystemInfo {
  name: string;
  description: string;
  integrationMethod: string;
  apiDocumentationUrl: string;
  features: string[];
  source: string;
  lastUpdated: Date;
}

export class FirecrawlService {
  private isConfigured: boolean;
  
  constructor() {
    const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;
    this.isConfigured = !!apiKey;
    if (!apiKey) {
      console.warn('Firecrawl API key not found. Using mock data for demonstration.');
    }
  }

  /**
   * Crawl sales tax rates from government websites
   */
  async crawlTaxRates(states: string[] = ['CA', 'NY', 'TX', 'FL']): Promise<TaxRateInfo[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock data that would be crawled from government websites
    const mockTaxRates: TaxRateInfo[] = [
      {
        jurisdiction: 'California Base Rate',
        rate: 7.25,
        source: 'https://www.cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm',
        effectiveDate: '2023-01-01',
        lastUpdated: new Date(),
      },
      {
        jurisdiction: 'Los Angeles County',
        rate: 2.25,
        source: 'https://www.cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm',
        effectiveDate: '2023-01-01',
        lastUpdated: new Date(),
      },
      {
        jurisdiction: 'New York State',
        rate: 4.0,
        source: 'https://www.tax.ny.gov/bus/st/stidx.htm',
        effectiveDate: '2023-01-01',
        lastUpdated: new Date(),
      },
      {
        jurisdiction: 'New York City',
        rate: 4.5,
        source: 'https://www.tax.ny.gov/bus/st/stidx.htm',
        effectiveDate: '2023-01-01',
        lastUpdated: new Date(),
      },
      {
        jurisdiction: 'Texas State',
        rate: 6.25,
        source: 'https://comptroller.texas.gov/taxes/sales/',
        effectiveDate: '2023-01-01',
        lastUpdated: new Date(),
      },
      {
        jurisdiction: 'Florida State',
        rate: 6.0,
        source: 'https://floridarevenue.com/taxes/taxesfees/Pages/sales_tax.aspx',
        effectiveDate: '2023-01-01',
        lastUpdated: new Date(),
      },
    ];

    // Filter by requested states if specific states are requested
    const filteredRates = states.length === 4 && states.includes('CA') && states.includes('NY') && states.includes('TX') && states.includes('FL')
      ? mockTaxRates
      : mockTaxRates.filter(rate => 
          states.some(state => rate.jurisdiction.toLowerCase().includes(state.toLowerCase()))
        );

    return filteredRates;
  }

  /**
   * Crawl filing requirements from state revenue websites
   */
  async crawlFilingRequirements(): Promise<FilingRequirement[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Mock filing requirements that would be crawled from government websites
    return [
      {
        state: 'CA',
        frequency: 'Monthly',
        deadline: '20th of following month',
        requirements: [
          'File Form BOE-401-A if gross receipts exceed $17,000 quarterly',
          'Electronic filing required for amounts over $20,000',
          'Maintain detailed transaction records for 4 years',
          'Report exempt sales separately'
        ],
        source: 'https://www.cdtfa.ca.gov/formspubs/returns/',
        lastUpdated: new Date(),
      },
      {
        state: 'NY',
        frequency: 'Quarterly',
        deadline: 'Last day of month following quarter end',
        requirements: [
          'File Form ST-100 for quarterly filers',
          'Online filing mandatory for most businesses',
          'Separate reporting for NYC local taxes',
          'Certificate of Authority required before selling'
        ],
        source: 'https://www.tax.ny.gov/bus/st/stret.htm',
        lastUpdated: new Date(),
      },
      {
        state: 'TX',
        frequency: 'Monthly',
        deadline: '20th of following month',
        requirements: [
          'File electronically through Webfile',
          'Report total sales and taxable sales',
          'Local tax reporting included in state return',
          'Sales tax permit required before conducting business'
        ],
        source: 'https://comptroller.texas.gov/taxes/sales/filing.php',
        lastUpdated: new Date(),
      },
      {
        state: 'FL',
        frequency: 'Monthly',
        deadline: '20th of following month',
        requirements: [
          'File Form DR-15 electronically',
          'Report gross sales and exempt sales',
          'Discretionary sales surtax reported separately',
          'Sales tax registration required before selling'
        ],
        source: 'https://floridarevenue.com/taxes/filings/Pages/sales_tax.aspx',
        lastUpdated: new Date(),
      },
    ];
  }

  /**
   * Crawl POS system information and integration guides
   */
  async crawlPOSSystemInfo(): Promise<POSSystemInfo[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1800));
    
    // Mock POS system information that would be crawled from developer docs
    return [
      {
        name: 'Square',
        description: 'Complete payment processing platform with robust APIs for e-commerce and in-person transactions',
        integrationMethod: 'REST API + OAuth 2.0',
        apiDocumentationUrl: 'https://developer.squareup.com/docs',
        features: [
          'Payment processing and refunds',
          'Inventory management',
          'Customer management',
          'Real-time transaction webhooks',
          'Tax calculation and reporting',
          'Multi-location support'
        ],
        source: 'https://developer.squareup.com/docs',
        lastUpdated: new Date(),
      },
      {
        name: 'Shopify',
        description: 'Leading e-commerce platform with comprehensive APIs for online store management',
        integrationMethod: 'GraphQL + REST API',
        apiDocumentationUrl: 'https://shopify.dev/docs',
        features: [
          'Order management and fulfillment',
          'Product catalog synchronization',
          'Customer data and analytics',
          'Webhook notifications',
          'Multi-currency support',
          'Tax calculation by location'
        ],
        source: 'https://shopify.dev/docs',
        lastUpdated: new Date(),
      },
      {
        name: 'Clover',
        description: 'Point-of-sale system designed for restaurants and retail businesses',
        integrationMethod: 'REST API + OAuth',
        apiDocumentationUrl: 'https://docs.clover.com/docs',
        features: [
          'Terminal integration',
          'Order and payment processing',
          'Inventory tracking',
          'Employee management',
          'Reporting and analytics',
          'Custom app development'
        ],
        source: 'https://docs.clover.com/docs',
        lastUpdated: new Date(),
      },
      {
        name: 'PayPal',
        description: 'Global payment processor with APIs for online and mobile payments',
        integrationMethod: 'REST API + OAuth 2.0',
        apiDocumentationUrl: 'https://developer.paypal.com/docs',
        features: [
          'Payment processing',
          'Subscription billing',
          'Dispute management',
          'Multi-currency transactions',
          'Express checkout',
          'Mobile SDK integration'
        ],
        source: 'https://developer.paypal.com/docs',
        lastUpdated: new Date(),
      },
      {
        name: 'Stripe',
        description: 'Developer-friendly payment infrastructure for internet businesses',
        integrationMethod: 'REST API + Webhooks',
        apiDocumentationUrl: 'https://stripe.com/docs/api',
        features: [
          'Payment intent management',
          'Subscription and billing',
          'Connect marketplace payments',
          'Fraud detection',
          'International payments',
          'Comprehensive tax handling'
        ],
        source: 'https://stripe.com/docs/api',
        lastUpdated: new Date(),
      },
      {
        name: 'QuickBooks POS',
        description: 'Integrated accounting and point-of-sale solution for small businesses',
        integrationMethod: 'REST API + OAuth 2.0',
        apiDocumentationUrl: 'https://developer.intuit.com/app/developer/qbpayments/docs/get-started',
        features: [
          'Integrated accounting sync',
          'Inventory management',
          'Customer management',
          'Financial reporting',
          'Multi-location support',
          'Tax compliance automation'
        ],
        source: 'https://developer.intuit.com/app/developer/qbpayments/docs/get-started',
        lastUpdated: new Date(),
      },
    ];
  }

  /**
   * Crawl sales tax help articles and guides
   */
  async crawlHelpArticles(): Promise<CrawledContent[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock help articles that would be crawled from industry websites
    return [
      {
        url: 'https://www.avalara.com/learn/sales-tax/',
        title: 'Sales Tax Fundamentals: A Complete Guide for Businesses',
        content: `# Sales Tax Fundamentals\n\nSales tax compliance is one of the most complex challenges facing modern businesses. With over 10,000 tax jurisdictions in the United States alone, understanding your obligations is crucial.\n\n## Key Concepts\n\n**Nexus**: The connection between your business and a state that creates tax obligations\n- Physical presence (offices, employees, inventory)\n- Economic nexus (sales thresholds)\n- Click-through nexus (affiliate programs)\n\n**Taxability**: Not all products and services are subject to sales tax\n- Varies by state and local jurisdiction\n- Product classifications matter\n- Services often have different rules\n\n**Filing Requirements**: Once you have nexus, you must register and file\n- Registration before first sale\n- Regular filing (monthly, quarterly, or annually)\n- Payment due with returns\n\n## Best Practices\n\n1. **Monitor your nexus** across all states\n2. **Automate tax calculations** with certified software\n3. **Keep detailed records** of all transactions\n4. **Stay updated** on changing regulations\n5. **Consider voluntary disclosure** for past exposure`,
        metadata: {
          title: 'Sales Tax Fundamentals: A Complete Guide for Businesses',
          description: 'Comprehensive guide covering sales tax nexus, taxability, and compliance requirements',
          author: 'Avalara Tax Experts',
          publishDate: '2024-01-15',
          tags: ['sales-tax', 'nexus', 'compliance', 'business']
        },
        timestamp: new Date(),
      },
      {
        url: 'https://blog.taxjar.com/sales-tax-guide/',
        title: 'Sales Tax Automation: Modern Solutions for Complex Problems',
        content: `# Sales Tax Automation\n\nManual sales tax management is becoming increasingly impractical as businesses expand across multiple jurisdictions.\n\n## Why Automate?\n\n**Accuracy**: Eliminate human calculation errors\n- Real-time rate updates\n- Jurisdiction boundary precision\n- Product taxability rules\n\n**Efficiency**: Save time and resources\n- Automatic tax calculation\n- Streamlined filing processes\n- Integration with existing systems\n\n**Compliance**: Stay current with changing regulations\n- Automatic rate updates\n- Nexus monitoring\n- Audit trail maintenance\n\n## Implementation Strategy\n\n1. **Assess current processes** and identify pain points\n2. **Choose the right solution** for your business size\n3. **Plan integration** with existing systems\n4. **Train your team** on new processes\n5. **Monitor and optimize** performance\n\n## ROI Considerations\n\nAutomation typically pays for itself through:\n- Reduced compliance costs\n- Fewer filing errors and penalties\n- Time savings for staff\n- Scalability for business growth`,
        metadata: {
          title: 'Sales Tax Automation: Modern Solutions for Complex Problems',
          description: 'Guide to implementing automated sales tax solutions for growing businesses',
          author: 'TaxJar Team',
          publishDate: '2024-02-10',
          tags: ['automation', 'technology', 'efficiency', 'roi']
        },
        timestamp: new Date(),
      },
      {
        url: 'https://www.nolo.com/legal-encyclopedia/sales-tax',
        title: 'Legal Requirements for Sales Tax Collection and Remittance',
        content: `# Legal Requirements for Sales Tax\n\nUnderstanding the legal framework around sales tax is essential for business compliance and avoiding costly penalties.\n\n## Constitutional Framework\n\nSales tax authority derives from state sovereignty:\n- States set their own rates and rules\n- Interstate commerce protections apply\n- Supreme Court decisions shape nexus standards\n\n## Registration Requirements\n\n**Before You Sell**: Most states require registration before conducting taxable business\n- Application process varies by state\n- May require bonds or deposits\n- Business licenses often required simultaneously\n\n**Ongoing Obligations**: Registration creates ongoing responsibilities\n- Regular filing requirements\n- Timely payment obligations\n- Record keeping requirements\n- Renewal and update obligations\n\n## Penalties and Interest\n\n**Late Filing**: Penalties typically range from 5-25% per month\n**Late Payment**: Interest accrues daily on unpaid amounts\n**Negligence**: Additional penalties for careless mistakes\n**Fraud**: Severe penalties for intentional non-compliance\n\n## Best Practices\n\n1. **Register proactively** when nexus is established\n2. **Maintain detailed records** of all transactions\n3. **File on time** even if no tax is due\n4. **Seek professional help** for complex situations\n5. **Consider voluntary disclosure** for past exposure`,
        metadata: {
          title: 'Legal Requirements for Sales Tax Collection and Remittance',
          description: 'Legal overview of sales tax obligations and compliance requirements',
          author: 'Nolo Legal Editors',
          publishDate: '2024-01-20',
          tags: ['legal', 'compliance', 'penalties', 'registration']
        },
        timestamp: new Date(),
      },
      {
        url: 'https://smallbusiness.chron.com/sales-tax-compliance',
        title: 'Small Business Sales Tax Compliance: Practical Tips and Strategies',
        content: `# Small Business Sales Tax Compliance\n\nSmall businesses face unique challenges in managing sales tax compliance while maintaining focus on growth and operations.\n\n## Common Challenges\n\n**Resource Constraints**: Limited staff and budget for compliance\n**Complexity**: Understanding multi-state requirements\n**Technology**: Integrating tax solutions with existing systems\n**Growth**: Scaling compliance as business expands\n\n## Practical Solutions\n\n### Start Simple\n- Focus on your primary markets first\n- Use cloud-based tax solutions\n- Automate where possible\n- Set up regular review processes\n\n### Build Systems\n- Document your processes\n- Create compliance calendars\n- Establish record-keeping procedures\n- Plan for audit preparation\n\n### Seek Help When Needed\n- Tax professionals for complex situations\n- Software solutions for automation\n- Industry associations for guidance\n- Peer networks for best practices\n\n## Growth Considerations\n\nAs your business grows:\n1. **Monitor nexus thresholds** in all states\n2. **Evaluate technology needs** regularly\n3. **Consider professional services** for complex compliance\n4. **Plan for audit readiness** from day one\n5. **Stay informed** about regulatory changes\n\n## Cost-Benefit Analysis\n\nInvest in compliance infrastructure that:\n- Scales with your business\n- Reduces manual work\n- Minimizes error risk\n- Supports audit defense`,
        metadata: {
          title: 'Small Business Sales Tax Compliance: Practical Tips and Strategies',
          description: 'Actionable advice for small businesses managing sales tax compliance',
          author: 'Small Business Chronicle',
          publishDate: '2024-02-01',
          tags: ['small-business', 'practical-tips', 'growth', 'strategy']
        },
        timestamp: new Date(),
      },
    ];
  }

  /**
   * Batch crawl multiple URLs for comprehensive content updates
   */
  async batchCrawl(urls: string[]): Promise<CrawledContent[]> {
    // Simulate batch crawling delay
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    // Mock batch crawl results combining multiple content types
    const batchResults: CrawledContent[] = [];
    
    // Add a subset of results from each content type
    const taxRates = await this.crawlTaxRates(['CA', 'NY']);
    taxRates.slice(0, 2).forEach(rate => {
      batchResults.push({
        url: rate.source,
        title: `${rate.jurisdiction} Tax Rate: ${rate.rate}%`,
        content: `**Jurisdiction**: ${rate.jurisdiction}\n**Rate**: ${rate.rate}%\n**Effective Date**: ${rate.effectiveDate}\n**Source**: Official government website`,
        metadata: { type: 'tax-rate', jurisdiction: rate.jurisdiction, rate: rate.rate },
        timestamp: new Date(),
      });
    });
    
    const posInfo = await this.crawlPOSSystemInfo();
    posInfo.slice(0, 2).forEach(pos => {
      batchResults.push({
        url: pos.apiDocumentationUrl,
        title: `${pos.name} Integration Guide`,
        content: `**${pos.name}**\n\n${pos.description}\n\n**Integration Method**: ${pos.integrationMethod}\n\n**Key Features**:\n${pos.features.map(f => `• ${f}`).join('\n')}`,
        metadata: { type: 'pos-integration', system: pos.name, features: pos.features },
        timestamp: new Date(),
      });
    });
    
    return batchResults;
  }

  /**
   * Parse tax rate information from crawled content
   */
  private parseTaxRates(content: string, source: string): TaxRateInfo[] {
    const rates: TaxRateInfo[] = [];
    
    // Simple parsing logic - in production, you'd want more sophisticated parsing
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Look for patterns like "California: 7.25%" or "State Rate: 8.5%"
      const rateMatch = line.match(/([A-Za-z\s]+)[:]\s*(\d+\.?\d*)%/);
      if (rateMatch) {
        rates.push({
          jurisdiction: rateMatch[1].trim(),
          rate: parseFloat(rateMatch[2]),
          source,
          effectiveDate: new Date().toISOString(),
          lastUpdated: new Date(),
        });
      }
    }

    return rates;
  }

  /**
   * Parse filing requirements from crawled content
   */
  private parseFilingRequirements(content: string, source: string): FilingRequirement[] {
    // Implementation would parse filing frequencies, deadlines, and requirements
    // This is a simplified version
    return [
      {
        state: this.extractStateFromUrl(source),
        frequency: 'Monthly',
        deadline: '20th of following month',
        requirements: ['File return', 'Pay taxes', 'Maintain records'],
        source,
        lastUpdated: new Date(),
      }
    ];
  }

  /**
   * Parse POS system information from crawled content
   */
  private parsePOSSystemInfo(content: string, source: string): POSSystemInfo | null {
    const systemName = this.extractPOSSystemName(source);
    
    if (!systemName) return null;

    return {
      name: systemName,
      description: `API integration for ${systemName}`,
      integrationMethod: 'REST API',
      apiDocumentationUrl: source,
      features: ['Transaction sync', 'Real-time updates', 'OAuth authentication'],
      source,
      lastUpdated: new Date(),
    };
  }

  /**
   * Extract state abbreviation from URL
   */
  private extractStateFromUrl(url: string): string {
    if (url.includes('ca.gov') || url.includes('cdtfa')) return 'CA';
    if (url.includes('ny.gov')) return 'NY';
    if (url.includes('texas.gov')) return 'TX';
    if (url.includes('floridarevenue')) return 'FL';
    return 'Unknown';
  }

  /**
   * Extract POS system name from URL
   */
  private extractPOSSystemName(url: string): string {
    if (url.includes('squareup')) return 'Square';
    if (url.includes('shopify')) return 'Shopify';
    if (url.includes('clover')) return 'Clover';
    if (url.includes('paypal')) return 'PayPal';
    if (url.includes('stripe')) return 'Stripe';
    if (url.includes('intuit')) return 'QuickBooks';
    return '';
  }

  /**
   * Check if Firecrawl is properly configured
   */
  getConfigurationStatus(): { configured: boolean; message: string } {
    return {
      configured: this.isConfigured,
      message: this.isConfigured 
        ? 'Firecrawl API configured and ready for live crawling'
        : 'Using mock data for demonstration - configure VITE_FIRECRAWL_API_KEY for live crawling'
    };
  }

  /**
   * Get demo information about the crawling capabilities
   */
  getDemoInfo(): { 
    capabilities: string[];
    mockDataSources: string[];
    productionFeatures: string[];
  } {
    return {
      capabilities: [
        'Real-time government website crawling',
        'POS system documentation parsing',
        'Industry help article aggregation',
        'Automated content updates',
        'Structured data extraction',
        'Content caching and optimization'
      ],
      mockDataSources: [
        'California Department of Tax and Fee Administration',
        'New York State Department of Taxation',
        'Texas Comptroller of Public Accounts',
        'Florida Department of Revenue',
        'Square Developer Documentation',
        'Shopify Partner Documentation',
        'Industry tax compliance resources'
      ],
      productionFeatures: [
        'Live API integration with Firecrawl v2',
        'Scheduled content updates',
        'Advanced content parsing and validation',
        'Multi-source data correlation',
        'Change detection and alerts',
        'Comprehensive audit trails'
      ]
    };
  }
}

export const firecrawlService = new FirecrawlService();