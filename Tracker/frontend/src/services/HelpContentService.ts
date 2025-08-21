// Help Content Service - Live article crawling for help categories
import { HelpArticle, HelpCategory } from '@/types';

interface CrawledHelpArticle {
  url: string;
  title: string;
  content: string;
  description: string;
  category: string;
  source: string;
  metadata?: {
    author?: string;
    publishDate?: string;
    readingTime?: string;
    tags?: string[];
  };
  timestamp: Date;
}

interface CategoryUrls {
  [categoryId: string]: {
    sources: string[];
    searchQueries: string[];
  };
}

export class HelpContentService {
  private isConfigured: boolean;
  private apiKey: string | null = null;
  
  // Category-specific URL sources for crawling
  private categoryUrls: CategoryUrls = {
    'getting-started': {
      sources: [
        'https://blog.taxjar.com/sales-tax-guide/',
        'https://www.avalara.com/learn/guides/sales-tax-basics/',
        'https://smallbusiness.chron.com/sales-tax-getting-started/',
        'https://www.nerdwallet.com/article/small-business/sales-tax-guide',
        'https://blog.intuit.com/taxes/sales-tax-basics-for-small-businesses/',
      ],
      searchQueries: ['sales tax basics', 'getting started sales tax', 'small business tax guide']
    },
    'transactions': {
      sources: [
        'https://www.avalara.com/learn/guides/transaction-management/',
        'https://blog.taxjar.com/transaction-tracking/',
        'https://smallbusiness.chron.com/managing-sales-transactions/',
        'https://www.thebalancesmoney.com/sales-transaction-management',
        'https://blog.intuit.com/money/managing-business-transactions/',
      ],
      searchQueries: ['sales transaction management', 'tracking business sales', 'transaction reporting']
    },
    'tax-rates': {
      sources: [
        'https://blog.taxjar.com/sales-tax-rates-2024/',
        'https://www.avalara.com/learn/guides/tax-rates/',
        'https://www.salestaxinstitute.com/resources/rates-and-regulations',
        'https://blog.intuit.com/taxes/understanding-tax-rates/',
        'https://www.thebalancesmoney.com/sales-tax-rates-guide',
      ],
      searchQueries: ['sales tax rates 2024', 'tax compliance guide', 'state tax rates']
    },
    'reports': {
      sources: [
        'https://blog.taxjar.com/sales-tax-reporting/',
        'https://www.avalara.com/learn/guides/tax-reporting/',
        'https://smallbusiness.chron.com/tax-reporting-analytics/',
        'https://blog.intuit.com/taxes/tax-reporting-small-business/',
        'https://www.thebalancesmoney.com/business-tax-reports',
      ],
      searchQueries: ['sales tax reporting', 'business tax analytics', 'tax report generation']
    },
    'integrations': {
      sources: [
        'https://developer.squareup.com/blog/articles/sales-tax-integration',
        'https://help.shopify.com/en/manual/taxes',
        'https://blog.taxjar.com/pos-integration-guide/',
        'https://www.avalara.com/learn/guides/pos-integrations/',
        'https://developers.stripe.com/docs/tax/integrating',
      ],
      searchQueries: ['POS tax integration', 'sales tax API integration', 'e-commerce tax setup']
    },
    'troubleshooting': {
      sources: [
        'https://blog.taxjar.com/sales-tax-troubleshooting/',
        'https://www.avalara.com/learn/guides/troubleshooting/',
        'https://smallbusiness.chron.com/common-tax-problems/',
        'https://blog.intuit.com/taxes/solving-tax-issues/',
        'https://www.thebalancesmoney.com/tax-problem-solutions',
      ],
      searchQueries: ['sales tax problems', 'tax compliance issues', 'fixing tax errors']
    },
    'account-management': {
      sources: [
        'https://blog.taxjar.com/account-management-best-practices/',
        'https://www.avalara.com/learn/guides/account-setup/',
        'https://smallbusiness.chron.com/business-account-management/',
        'https://blog.intuit.com/money/business-account-tips/',
        'https://www.thebalancesmoney.com/managing-business-accounts',
      ],
      searchQueries: ['business account management', 'tax account setup', 'managing business settings']
    }
  };
  
  constructor() {
    const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;
    this.isConfigured = !!apiKey;
    this.apiKey = apiKey;
    
    if (apiKey) {
      console.log('🔥 Firecrawl API configured successfully');
    } else {
      console.warn('Firecrawl API key not found. Using enhanced mock data for help articles.');
    }
  }

  /**
   * Crawl help articles for a specific category
   */
  async crawlCategoryArticles(categoryId: string, limit: number = 5): Promise<CrawledHelpArticle[]> {
    const categoryConfig = this.categoryUrls[categoryId];
    if (!categoryConfig) {
      throw new Error(`Unknown category: ${categoryId}`);
    }

    // Use real Firecrawl API if configured
    if (this.isConfigured && this.apiKey) {
      try {
        return await this.actualFirecrawlRequest(categoryId, categoryConfig, limit);
      } catch (error) {
        console.error(`🔥 Firecrawl API error for category ${categoryId}:`, error);
        // Fall back to enhanced mock data on API failure
      }
    }
    
    // Simulate API delay for mock data
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    
    // Generate enhanced mock articles
    return this.generateMockArticles(categoryId, categoryConfig, limit);
  }

  /**
   * Make actual Firecrawl API requests for live content using direct HTTP calls
   */
  private async actualFirecrawlRequest(categoryId: string, config: { sources: string[], searchQueries: string[] }, limit: number): Promise<CrawledHelpArticle[]> {
    if (!this.apiKey) {
      throw new Error('Firecrawl API key not configured');
    }

    const crawledArticles: CrawledHelpArticle[] = [];
    const urlsToScrape = config.sources.slice(0, Math.min(limit, 3)); // Limit to 3 URLs to avoid rate limits

    console.log(`🔍 Crawling ${urlsToScrape.length} URLs for category: ${categoryId}`);

    for (const url of urlsToScrape) {
      try {
        console.log(`📄 Scraping: ${url}`);
        
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            url: url,
            formats: ['markdown'],
            includeTags: ['article', 'main', '.content', '.post', 'h1', 'h2', 'h3', 'p'],
            excludeTags: ['nav', 'footer', 'header', 'script', '.sidebar', '.ads', '.comments'],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          
          if (result && result.data && result.data.markdown) {
            const article = this.processFirecrawlResult(result.data, url, categoryId);
            if (article) {
              crawledArticles.push(article);
              console.log(`✅ Successfully crawled: ${article.title}`);
            }
          } else {
            console.warn(`⚠️ No content found for: ${url}`);
          }
        } else {
          console.error(`❌ HTTP ${response.status} for ${url}:`, await response.text());
        }
      } catch (error) {
        console.error(`❌ Failed to crawl ${url}:`, error);
        // Continue with next URL instead of failing completely
      }
    }

    // If we didn't get enough articles from crawling, supplement with enhanced mock data
    if (crawledArticles.length < limit) {
      const mockArticles = this.generateMockArticles(categoryId, config, limit - crawledArticles.length);
      crawledArticles.push(...mockArticles);
      console.log(`📝 Supplemented with ${mockArticles.length} enhanced mock articles`);
    }

    return crawledArticles;
  }

  /**
   * Process individual Firecrawl result into article format
   */
  private processFirecrawlResult(result: any, url: string, categoryId: string): CrawledHelpArticle | null {
    try {
      const title = result.metadata?.title || this.extractTitleFromContent(result.markdown) || 'Help Article';
      const description = result.metadata?.description || this.extractDescription(result.markdown) || 'Helpful information and guidance.';
      const content = this.cleanMarkdownContent(result.markdown);

      // Skip if content is too short or irrelevant
      if (content.length < 200) {
        return null;
      }

      return {
        url,
        title: this.cleanTitle(title),
        content: content.substring(0, 2000), // Limit content length
        description: description.substring(0, 300),
        category: categoryId,
        source: this.extractSourceName(url),
        metadata: {
          author: result.metadata?.author || 'Expert Author',
          publishDate: result.metadata?.publishedTime || this.getRandomDate(),
          readingTime: this.estimateReadingTime(content),
          tags: this.extractTags(content, categoryId)
        },
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error processing Firecrawl result:', error);
      return null;
    }
  }

  /**
   * Generate mock articles that simulate real crawled content
   */
  private generateMockArticles(categoryId: string, config: { sources: string[], searchQueries: string[] }, limit: number): CrawledHelpArticle[] {
    const categoryTitles: { [key: string]: string[] } = {
      'getting-started': [
        'Sales Tax Basics: Everything New Businesses Need to Know',
        'Your First Sales Tax Registration: Step-by-Step Guide',
        'Understanding Nexus: When You Need to Collect Sales Tax',
        'Setting Up Your First Sales Tax System',
        'Common Sales Tax Mistakes New Businesses Make (And How to Avoid Them)'
      ],
      'transactions': [
        'Best Practices for Sales Transaction Management',
        'How to Track and Record Sales Transactions Properly',
        'Understanding Transaction Types and Tax Implications',
        'Setting Up Automated Transaction Processing',
        'Transaction Reporting Requirements by State'
      ],
      'tax-rates': [
        '2024 Sales Tax Rate Changes: What You Need to Know',
        'Understanding Complex Tax Rate Calculations',
        'How to Handle Multi-Jurisdiction Tax Rates',
        'Tax Rate Updates: Staying Current with Government Changes',
        'Product-Specific Tax Rates and Exemptions Guide'
      ],
      'reports': [
        'Essential Sales Tax Reports Every Business Needs',
        'How to Generate Accurate Tax Returns',
        'Using Analytics to Improve Tax Compliance',
        'Monthly vs. Quarterly Tax Reporting: Which is Right for You?',
        'Automating Your Tax Reporting Process'
      ],
      'integrations': [
        'Complete Guide to POS System Tax Integration',
        'E-commerce Platform Tax Setup: Best Practices',
        'API Integration for Sales Tax Automation',
        'Connecting Your Accounting Software to Tax Systems',
        'Multi-Channel Sales Tax Integration Strategies'
      ],
      'troubleshooting': [
        'Resolving Common Sales Tax Calculation Errors',
        'What to Do When Tax Rates Are Incorrect',
        'Fixing Integration Issues with Your POS System',
        'Handling Tax Exemption Problems',
        'Troubleshooting Filing Deadline Issues'
      ],
      'account-management': [
        'Setting Up Your Business Profile for Tax Compliance',
        'Managing Multiple Business Locations',
        'User Permissions and Account Security',
        'Updating Your Business Information',
        'Account Billing and Subscription Management'
      ]
    };

    const categoryContent: { [key: string]: string[] } = {
      'getting-started': [
        'Sales tax can seem overwhelming for new businesses, but understanding the basics will help you stay compliant from day one. This comprehensive guide covers nexus requirements, registration processes, and essential compliance steps every business needs to know.',
        'Before you make your first sale, you need to register for sales tax in states where you have nexus. This step-by-step guide walks through the registration process, required documentation, and common pitfalls to avoid.',
        'Nexus determines where you\'re required to collect sales tax. With economic nexus laws varying by state, understanding these requirements is crucial for compliance. Learn about physical presence, economic thresholds, and click-through nexus.',
      ],
      'transactions': [
        'Proper transaction management is the foundation of sales tax compliance. Learn how to categorize transactions, handle exemptions, and maintain accurate records that will simplify your filing process.',
        'Every transaction needs proper documentation and categorization. This guide covers transaction recording best practices, audit trail maintenance, and integration with your accounting system.',
      ],
      'tax-rates': [
        'Tax rates change frequently across thousands of jurisdictions. Stay updated with the latest rate changes, understand how they affect your business, and learn to implement automated rate updates.',
        'Complex tax calculations involve multiple jurisdictions, product exemptions, and customer classifications. Master the intricacies of accurate tax calculation with real-world examples.',
      ],
      'reports': [
        'Tax reporting doesn\'t have to be stressful. Learn which reports you need, when to file them, and how to ensure accuracy. From monthly returns to annual reconciliations, we cover it all.',
        'Generate professional tax returns with confidence. This guide covers return preparation, supporting documentation, and common filing errors to avoid.',
      ],
      'integrations': [
        'Seamlessly connect your POS system to automated tax calculation. This comprehensive guide covers API setup, testing procedures, and troubleshooting common integration issues.',
        'E-commerce platforms require special consideration for tax collection. Learn platform-specific setup procedures, multi-state compliance, and customer exemption handling.',
      ],
      'troubleshooting': [
        'When tax calculations go wrong, quick resolution is essential. Learn to identify common calculation errors, understand their causes, and implement permanent fixes.',
        'Incorrect tax rates can lead to compliance issues. Discover how to verify rate accuracy, report discrepancies, and ensure your system stays current.',
      ],
      'account-management': [
        'Your business profile is the foundation of accurate tax calculation. Learn to set up locations, configure tax settings, and maintain current business information.',
        'Managing multiple locations requires careful coordination. Understand location-specific settings, nexus tracking, and consolidated reporting options.',
      ]
    };

    const titles = categoryTitles[categoryId] || [];
    const contents = categoryContent[categoryId] || [];
    
    return titles.slice(0, limit).map((title, index) => ({
      url: config.sources[index % config.sources.length],
      title,
      content: contents[index % contents.length] || 'Comprehensive guide covering best practices and practical implementation strategies.',
      description: this.generateDescription(title, categoryId),
      category: categoryId,
      source: this.extractSourceName(config.sources[index % config.sources.length]),
      metadata: {
        author: this.getRandomAuthor(),
        publishDate: this.getRandomDate(),
        readingTime: `${Math.floor(Math.random() * 8) + 3} min read`,
        tags: config.searchQueries.slice(0, 2).concat([categoryId])
      },
      timestamp: new Date()
    }));
  }

  /**
   * Search articles across all categories
   */
  async searchAllCategories(query: string, categoryFilter?: string): Promise<CrawledHelpArticle[]> {
    const searchResults: CrawledHelpArticle[] = [];
    const categoriesToSearch = categoryFilter ? [categoryFilter] : Object.keys(this.categoryUrls);
    
    for (const categoryId of categoriesToSearch) {
      const categoryArticles = await this.crawlCategoryArticles(categoryId, 2);
      const relevantArticles = categoryArticles.filter(article =>
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.content.toLowerCase().includes(query.toLowerCase()) ||
        article.metadata?.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      searchResults.push(...relevantArticles);
    }
    
    return searchResults.slice(0, 10); // Limit search results
  }

  /**
   * Get trending/popular articles across categories
   */
  async getTrendingArticles(limit: number = 8): Promise<CrawledHelpArticle[]> {
    const trendingTopics = [
      'getting-started',
      'tax-rates',
      'integrations',
      'troubleshooting'
    ];
    
    const articles: CrawledHelpArticle[] = [];
    
    for (const categoryId of trendingTopics) {
      const categoryArticles = await this.crawlCategoryArticles(categoryId, 2);
      articles.push(...categoryArticles);
    }
    
    return articles.slice(0, limit);
  }

  /**
   * Convert crawled articles to help article format
   */
  convertToHelpArticles(crawledArticles: CrawledHelpArticle[], category: HelpCategory): HelpArticle[] {
    return crawledArticles.map((article, index) => ({
      id: `crawled-${category.id}-${index}`,
      title: article.title,
      content: this.expandContent(article.content, article.title),
      category,
      difficulty: this.getDifficultyLevel(article.title, category.id),
      tags: article.metadata?.tags || [category.name],
      views: Math.floor(Math.random() * 10000) + 500,
      helpful: Math.floor(Math.random() * 200) + 50,
      notHelpful: Math.floor(Math.random() * 20) + 2,
      lastUpdated: article.metadata?.publishDate || 'Recently',
      author: article.metadata?.author || 'Tax Expert',
      readingTime: article.metadata?.readingTime || '5 min read',
      relatedArticles: []
    }));
  }

  // Helper methods
  private generateDescription(title: string, categoryId: string): string {
    const descriptions = {
      'getting-started': 'Learn the fundamentals and get started quickly with practical guidance.',
      'transactions': 'Master transaction management with step-by-step instructions.',
      'tax-rates': 'Stay compliant with current tax rates and calculation methods.',
      'reports': 'Generate accurate reports and meet your filing obligations.',
      'integrations': 'Seamlessly connect your systems for automated tax management.',
      'troubleshooting': 'Resolve issues quickly with expert troubleshooting guidance.',
      'account-management': 'Optimize your account settings and business configuration.'
    };
    return descriptions[categoryId as keyof typeof descriptions] || 'Comprehensive guide with practical examples.';
  }

  private expandContent(shortContent: string, title: string): string {
    return `${shortContent}

## Overview

${title} - This comprehensive guide provides step-by-step instructions and best practices to help you implement effective solutions.

## Key Points

• Understand the fundamental concepts and requirements
• Learn industry-standard best practices and methodologies  
• Implement solutions with real-world examples
• Avoid common pitfalls and mistakes
• Stay compliant with current regulations and requirements

## Implementation Steps

1. **Assessment**: Evaluate your current situation and requirements
2. **Planning**: Develop a comprehensive implementation strategy
3. **Setup**: Configure systems and establish proper workflows
4. **Testing**: Verify functionality and accuracy before going live
5. **Monitoring**: Track performance and make necessary adjustments

## Best Practices

Following established best practices ensures reliable results and long-term success. Regular monitoring and updates help maintain optimal performance.

## Conclusion

Proper implementation of these guidelines will help you achieve your goals while maintaining compliance and operational efficiency.`;
  }

  private extractSourceName(url: string): string {
    try {
      const domain = new URL(url).hostname.replace('www.', '').replace('blog.', '');
      return domain.charAt(0).toUpperCase() + domain.slice(1).replace(/\.(com|org|net)$/, '');
    } catch {
      return 'Expert Source';
    }
  }

  private getRandomAuthor(): string {
    const authors = [
      'Sarah Johnson, Tax Expert',
      'Michael Chen, Compliance Specialist', 
      'Lisa Rodriguez, Business Consultant',
      'David Kim, Integration Specialist',
      'Jennifer Walsh, Tax Analyst',
      'Robert Taylor, Compliance Manager'
    ];
    return authors[Math.floor(Math.random() * authors.length)];
  }

  private getRandomDate(): string {
    const dates = [
      '2 days ago',
      '1 week ago',
      '2 weeks ago', 
      '3 weeks ago',
      '1 month ago',
      '6 weeks ago'
    ];
    return dates[Math.floor(Math.random() * dates.length)];
  }

  private getDifficultyLevel(title: string, categoryId: string): 'beginner' | 'intermediate' | 'advanced' {
    if (title.toLowerCase().includes('basic') || title.toLowerCase().includes('getting started') || categoryId === 'getting-started') {
      return 'beginner';
    }
    if (title.toLowerCase().includes('advanced') || title.toLowerCase().includes('complex') || categoryId === 'troubleshooting') {
      return 'advanced';
    }
    return 'intermediate';
  }

  // Content processing helper methods for Firecrawl results
  private extractTitleFromContent(markdown: string): string | null {
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : null;
  }

  private extractDescription(markdown: string): string {
    // Find first paragraph after title
    const lines = markdown.split('\n');
    let foundTitle = false;
    
    for (const line of lines) {
      if (line.startsWith('#')) {
        foundTitle = true;
        continue;
      }
      if (foundTitle && line.trim() && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-')) {
        return line.trim();
      }
    }
    return 'Helpful guidance and information.';
  }

  private cleanMarkdownContent(markdown: string): string {
    return markdown
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convert links to plain text
      .replace(/#+\s*/g, '') // Remove heading markers
      .replace(/\*{1,2}([^\*]+)\*{1,2}/g, '$1') // Remove bold/italic
      .replace(/`([^`]+)`/g, '$1') // Remove code markers
      .trim();
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/^\d+\.\s*/, '') // Remove leading numbers
      .replace(/\s*\|\s*.+$/, '') // Remove site names after pipe
      .replace(/\s*-\s*.+$/, '') // Remove site names after dash
      .trim();
  }

  private estimateReadingTime(content: string): string {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min read`;
  }

  private extractTags(content: string, categoryId: string): string[] {
    const tags = [categoryId];
    const keywords = ['tax', 'sales', 'business', 'compliance', 'integration', 'reporting'];
    
    keywords.forEach(keyword => {
      if (content.toLowerCase().includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Get service configuration status
   */
  getConfigurationStatus(): { configured: boolean; message: string } {
    return {
      configured: this.isConfigured,
      message: this.isConfigured 
        ? 'Firecrawl integration active - fetching live help articles'
        : 'Using enhanced mock help articles - configure VITE_FIRECRAWL_API_KEY for live crawling'
    };
  }
}

export const helpContentService = new HelpContentService();