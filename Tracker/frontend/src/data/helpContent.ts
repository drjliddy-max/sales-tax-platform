import { HelpArticle, FAQ, HelpCategory } from '@/types';
import { curatedRealArticles } from './curatedRealArticles';

// Help Categories
export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of using our sales tax platform',
    icon: 'Rocket',
    color: 'blue'
  },
  {
    id: 'transactions',
    name: 'Transactions',
    description: 'Managing and understanding your sales transactions',
    icon: 'Receipt',
    color: 'green'
  },
  {
    id: 'tax-rates',
    name: 'Tax Rates & Compliance',
    description: 'Understanding tax rates and staying compliant',
    icon: 'Calculator',
    color: 'purple'
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    description: 'Generate reports and analyze your tax data',
    icon: 'BarChart3',
    color: 'orange'
  },
  {
    id: 'integrations',
    name: 'Integrations',
    description: 'Connect with POS systems and other platforms',
    icon: 'Link',
    color: 'cyan'
  },
  {
    id: 'troubleshooting',
    name: 'Troubleshooting',
    description: 'Resolve common issues and errors',
    icon: 'AlertCircle',
    color: 'red'
  },
  {
    id: 'account-management',
    name: 'Account Management',
    description: 'Managing your account and business settings',
    icon: 'Settings',
    color: 'gray'
  }
];

// Help Articles
export const helpArticles: HelpArticle[] = [
  // Getting Started Articles
  {
    id: 'setup-account',
    title: 'Setting Up Your Account',
    content: `
# Setting Up Your Sales Tax Tracker Account

Welcome to Sales Tax Insights! This guide will help you get your account set up and configured for success.

## Initial Setup Steps

### 1. Complete Your Profile
- Add your business information
- Verify your email address
- Upload your business logo (optional)

### 2. Add Your First Business
1. Navigate to **Business Settings**
2. Click **Add New Business**
3. Fill in all required information:
   - Business name and tax ID
   - Physical address
   - Business type and industry
   - Nexus states (where you collect tax)

### 3. Configure Tax Settings
- Review default tax rates for your locations
- Set up product categories if needed
- Configure exemption rules

### 4. Test Your Setup
- Run a test transaction
- Verify tax calculations are correct
- Check that data appears in your dashboard

## Next Steps
Once your account is set up, you can:
- Connect your POS system
- Import historical data
- Set up automated reporting
- Explore business insights

Need help? Contact our support team or use the AI chat for instant assistance.
    `,
    category: helpCategories[0], // getting-started
    tags: ['setup', 'account', 'onboarding', 'business'],
    difficulty: 'beginner',
    lastUpdated: '2024-01-15',
    views: 1250,
    helpful: 89,
    notHelpful: 3
  },
  {
    id: 'nexus-states',
    title: 'Understanding Sales Tax Nexus',
    content: `
# Understanding Sales Tax Nexus

Sales tax nexus determines where your business is required to collect and remit sales tax. This is crucial for compliance.

## What is Nexus?

Nexus is a connection between a business and a state that creates a tax obligation. Having nexus in a state means you must:
- Register for a sales tax permit
- Collect appropriate sales tax
- File regular tax returns
- Remit collected taxes

## Types of Nexus

### Physical Nexus
Created by having a physical presence in a state:
- Offices or stores
- Warehouses or inventory
- Employees or contractors
- Property ownership

### Economic Nexus
Created by exceeding sales or transaction thresholds:
- Usually $100,000 in sales OR 200+ transactions
- Thresholds vary by state
- Based on current or previous year sales

## Managing Nexus in Our Platform

1. **Add Nexus States**: Go to Business Settings → Nexus Management
2. **Set Effective Dates**: When nexus began in each state
3. **Monitor Thresholds**: We'll alert you when approaching limits
4. **Update Regularly**: Add new states as your business grows

## Common Nexus Scenarios

- **Online sellers**: Consider economic nexus in all states
- **Trade shows**: Temporary nexus may apply
- **Drop shipping**: Complex rules apply
- **Marketplaces**: Platform may handle collection

Always consult with a tax professional for complex situations.
    `,
    category: helpCategories[2], // tax-rates
    tags: ['nexus', 'compliance', 'states', 'registration'],
    difficulty: 'intermediate',
    lastUpdated: '2024-01-20',
    views: 2100,
    helpful: 156,
    notHelpful: 8
  },
  {
    id: 'pos-integration',
    title: 'Integrating Your POS System',
    content: `
# Integrating Your POS System

Connect your Point of Sale system to automatically sync transactions and ensure accurate tax collection.

## Supported POS Systems

We integrate with popular POS systems including:
- **Square**: Full integration with real-time sync
- **Shopify**: E-commerce and POS integration
- **Clover**: Transaction and inventory sync
- **Toast**: Restaurant POS integration
- **Lightspeed**: Retail and restaurant versions
- **WooCommerce**: WordPress e-commerce
- **BigCommerce**: Enterprise e-commerce
- **Custom APIs**: REST API for custom systems

## Integration Setup

### Step 1: Choose Integration Type
1. Go to **Settings** → **Integrations**
2. Select your POS system
3. Choose integration method:
   - **Real-time**: Instant transaction sync
   - **Batch**: Scheduled imports
   - **Manual**: Upload files periodically

### Step 2: Authentication
- Follow POS-specific authentication steps
- Usually involves API keys or OAuth
- Test connection before proceeding

### Step 3: Configure Data Mapping
- Map transaction fields
- Set up product categories
- Configure tax exempt handling
- Test data accuracy

### Step 4: Enable Sync
- Start with test mode
- Verify a few transactions
- Enable full sync when ready

## Troubleshooting Integration Issues

### Common Problems
- **Authentication failed**: Check API credentials
- **Missing transactions**: Verify date ranges and filters
- **Incorrect tax amounts**: Review rate mappings
- **Duplicate transactions**: Check sync settings

### Data Validation
- Compare totals between systems
- Spot-check individual transactions
- Monitor sync status regularly
- Set up alerts for sync failures

## Best Practices
- Backup data before integration
- Test thoroughly in staging environment
- Monitor first few days closely
- Keep POS system updated
- Regular sync health checks

Need help with a specific POS system? Contact support with your system details.
    `,
    category: helpCategories[4], // integrations
    tags: ['pos', 'integration', 'sync', 'setup'],
    difficulty: 'intermediate',
    lastUpdated: '2024-01-18',
    views: 875,
    helpful: 67,
    notHelpful: 2
  },
  {
    id: 'tax-exemptions',
    title: 'Handling Tax Exemptions',
    content: `
# Handling Tax Exemptions

Learn how to properly manage tax-exempt sales and maintain compliance with exemption regulations.

## Types of Tax Exemptions

### Customer-Based Exemptions
- **Non-profits**: 501(c)(3) organizations
- **Government entities**: Federal, state, local
- **Religious organizations**: Churches, schools
- **Resellers**: Buying for resale
- **Manufacturers**: Raw materials for production

### Product-Based Exemptions
- **Food and groceries**: Varies by state
- **Prescription drugs**: Generally exempt
- **Medical devices**: Often exempt
- **Clothing**: Exempt in some states
- **Educational materials**: Sometimes exempt

## Managing Exemptions in Our Platform

### Setting Up Customer Exemptions
1. Go to **Customers** → **Exemption Management**
2. Add customer exemption certificate
3. Set exemption types and validity dates
4. Upload certificate documentation

### Configuring Product Exemptions
1. Navigate to **Products** → **Tax Settings**
2. Set exemption rules by category
3. Configure state-specific rules
4. Test exemption calculations

### Exemption Certificates
**Required Information:**
- Customer name and address
- Reason for exemption
- Certificate number
- Expiration date (if applicable)
- Authorized signature

**Certificate Management:**
- Store digital copies securely
- Set renewal reminders
- Track expiration dates
- Maintain audit trail

## Compliance Requirements

### Documentation
- Keep exemption certificates on file
- Ensure certificates are current
- Document exemption reason for each sale
- Maintain records for audit purposes

### Validation
- Verify certificate authenticity
- Check exemption applies to purchased items
- Ensure certificates haven't expired
- Validate customer information

### Common Mistakes to Avoid
- Accepting expired certificates
- Applying wrong exemption type
- Missing required documentation
- Over-broad exemption application

## Reporting Exempt Sales
- Track exempt sales separately
- Include in sales tax returns
- Document exemption reasons
- Prepare for audit inquiries

## Audit Preparation
Keep detailed records of:
- All exemption certificates
- Exempt transaction details
- Exemption policies and procedures
- Staff training records

Regular reviews help ensure ongoing compliance and reduce audit risk.
    `,
    category: helpCategories[2], // tax-rates
    tags: ['exemptions', 'compliance', 'certificates', 'audit'],
    difficulty: 'advanced',
    lastUpdated: '2024-01-22',
    views: 1680,
    helpful: 142,
    notHelpful: 7
  },
  {
    id: 'dashboard-overview',
    title: 'Understanding Your Dashboard',
    content: `
# Understanding Your Dashboard

Your dashboard provides a comprehensive overview of your sales tax data and business performance.

## Dashboard Sections

### Key Metrics (Top Row)
- **This Month's Transactions**: Total number of sales
- **Revenue**: Total sales amount before tax
- **Tax Collected**: Total sales tax collected
- **Compliance Score**: Overall compliance rating

### Quick Actions
- **View Transactions**: Access transaction history
- **Generate Reports**: Create tax reports
- **Check Compliance**: Review compliance status
- **Business Insights**: View AI-powered insights

### Recent Activity
Shows your latest transactions with:
- Transaction date and amount
- Tax amount calculated
- Business location
- Transaction status

### Visual Analytics (When Available)
- Sales trends over time
- Tax collection by state
- Top performing locations
- Compliance metrics

## Understanding Your Data

### Transaction Status Indicators
- **✅ Completed**: Successfully processed
- **⏳ Pending**: Awaiting processing
- **❌ Failed**: Processing error occurred
- **📋 Review**: Requires manual review

### Compliance Indicators
- **Green**: Fully compliant
- **Yellow**: Minor issues to address
- **Red**: Immediate attention required

## Customizing Your Dashboard

### Filter Options
- Date ranges
- Business locations
- Transaction types
- Tax jurisdictions

### Export Options
- Download transaction data
- Export compliance reports
- Generate summary sheets
- Create custom exports

## Dashboard Best Practices

1. **Daily Monitoring**: Check key metrics daily
2. **Weekly Reviews**: Review compliance status
3. **Monthly Analysis**: Analyze trends and insights
4. **Quarterly Planning**: Use insights for business planning

## Mobile Dashboard
Access your dashboard on mobile devices:
- Optimized for phone screens
- Key metrics at a glance
- Quick action buttons
- Offline data caching

Need to customize your dashboard view? Contact support for advanced options.
    `,
    category: helpCategories[0], // getting-started
    tags: ['dashboard', 'metrics', 'overview', 'navigation'],
    difficulty: 'beginner',
    lastUpdated: '2024-01-16',
    views: 1890,
    helpful: 134,
    notHelpful: 4
  },
  // Additional Transaction Articles
  {
    id: 'transaction-management',
    title: 'Managing Transactions',
    content: `
# Managing Transactions

Learn how to view, edit, and analyze your sales transactions in the platform.

## Transaction Overview

Your transaction dashboard shows:
- **Real-time data** from connected POS systems
- **Tax calculations** for each sale
- **Location-based** tax breakdowns
- **Product category** classifications

## Key Features

### Transaction Search & Filtering
- Filter by date range, location, or amount
- Search by customer or product details
- Sort by various criteria
- Export filtered results

### Tax Breakdown View
Each transaction shows:
- Base sale amount
- Tax rates applied (state, local, special districts)
- Final tax amount collected
- Jurisdiction details

### Bulk Operations
- Update multiple transactions
- Apply corrections in bulk
- Export transaction data
- Generate reports from selections

## Common Use Cases

### Daily Reconciliation
1. Review day's transactions
2. Verify tax calculations
3. Check for any discrepancies
4. Export for accounting system

### Monthly Tax Filing
1. Filter transactions by filing period
2. Generate jurisdiction summaries
3. Export tax return data
4. Verify exemption handling

Need help with a specific transaction issue? Contact support for assistance.
    `,
    category: helpCategories[1], // transactions
    tags: ['transactions', 'management', 'search', 'export'],
    difficulty: 'beginner',
    lastUpdated: '2024-01-20',
    views: 445,
    helpful: 67,
    notHelpful: 1
  },
  {
    id: 'tax-rates-compliance',
    title: 'Tax Rates & Compliance Guide',
    content: `
# Tax Rates & Compliance Guide

Stay compliant with ever-changing tax rates and regulations across jurisdictions.

## Understanding Tax Rates

### Rate Components
- **State Rate**: Base state sales tax
- **County Rate**: Local county taxes
- **City Rate**: Municipal taxes  
- **Special Districts**: Transportation, school districts

### Rate Updates
- **Daily Updates**: Rates refreshed automatically
- **Government Sources**: Direct from official sources
- **Effective Dates**: Historical and future rates maintained
- **Notifications**: Alerts for significant changes

## Compliance Requirements

### Nexus Obligations
- **Physical Presence**: Offices, warehouses, employees
- **Economic Thresholds**: $100K sales or 200+ transactions
- **Marketplace Facilitation**: Third-party platforms
- **Registration Requirements**: State-by-state registration

### Filing Frequencies
- **Monthly**: High-volume businesses
- **Quarterly**: Medium-volume businesses
- **Annual**: Low-volume businesses
- **Special Requirements**: Some states have unique rules

## Staying Compliant

### Best Practices
1. Monitor nexus thresholds monthly
2. Review tax calculations regularly
3. Maintain exemption certificates
4. File returns on time
5. Keep detailed transaction records

### Compliance Monitoring
- **Threshold Tracking**: Automatic nexus monitoring
- **Filing Reminders**: Never miss a deadline
- **Rate Verification**: Cross-check calculations
- **Audit Support**: Detailed transaction logs

Questions about specific state requirements? Our compliance team can help.
    `,
    category: helpCategories[2], // tax-rates
    tags: ['compliance', 'tax-rates', 'nexus', 'filing'],
    difficulty: 'intermediate',
    lastUpdated: '2024-01-21',
    views: 623,
    helpful: 89,
    notHelpful: 3
  },
  {
    id: 'troubleshooting-guide',
    title: 'Troubleshooting Common Issues',
    content: `
# Troubleshooting Common Issues

Quick solutions to common problems and issues you might encounter.

## Connection Issues

### POS System Not Syncing
1. **Check Credentials**: Verify API keys and tokens
2. **Test Connection**: Use connection test feature
3. **Review Permissions**: Ensure proper access rights
4. **Check Status**: Review sync status and error logs

### Missing Transactions
- **Date Range**: Verify filter settings
- **Location Settings**: Check location mappings
- **Product Categories**: Review category filters
- **Network Issues**: Check internet connectivity

## Tax Calculation Issues

### Incorrect Tax Amounts
1. **Business Address**: Verify location settings
2. **Product Categories**: Check category assignments
3. **Exemption Status**: Review customer exemptions
4. **Rate Updates**: Ensure rates are current

### Missing Tax
- **Nexus States**: Confirm nexus configuration
- **Zero-Rate Items**: Check product exemptions
- **Customer Type**: Verify business vs. consumer
- **Special Rules**: Review jurisdiction-specific rules

## Report Problems

### Empty Reports
- **Date Range**: Expand date selection
- **Filters**: Remove restrictive filters
- **Data Sync**: Ensure transactions are synced
- **Permissions**: Check user access rights

### Export Failures
- **File Size**: Large exports may timeout
- **Format Issues**: Try different file formats
- **Browser Cache**: Clear browser cache
- **Network**: Check stable connection

## Getting Additional Help

### Support Resources
- **Live Chat**: Available during business hours
- **Email Support**: Detailed issue descriptions
- **Knowledge Base**: Searchable help articles
- **Video Tutorials**: Step-by-step guides

### Escalation Process
1. Try self-service solutions first
2. Contact support with specific details
3. Provide screenshots if helpful
4. Include error messages and timestamps

Still having issues? Contact our technical support team for personalized assistance.
    `,
    category: helpCategories[5], // troubleshooting
    tags: ['troubleshooting', 'issues', 'support', 'problems'],
    difficulty: 'beginner',
    lastUpdated: '2024-01-22',
    views: 789,
    helpful: 98,
    notHelpful: 5
  },
  // Additional Getting Started Articles
  {
    id: 'first-steps-guide',
    title: 'Your First Steps Guide',
    content: `
# Your First Steps Guide

Welcome to Sales Tax Insights! This quick guide will get you up and running in just a few minutes.

## Step 1: Complete Your Business Profile

### Business Information
- **Business Name**: Legal entity name
- **Tax ID/EIN**: Federal tax identification
- **Business Type**: Corporation, LLC, Partnership, etc.
- **Industry**: Select from dropdown options

### Location Details
- **Primary Address**: Where your business is located
- **Additional Locations**: Warehouses, stores, offices
- **Nexus States**: States where you collect tax

## Step 2: Configure Basic Settings

### Tax Collection
- **Default Tax Settings**: Basic rate configuration
- **Product Categories**: Organize your inventory
- **Customer Types**: Business vs. consumer sales
- **Exemptions**: Tax-exempt customers and products

### Preferences
- **Time Zone**: Set your business timezone
- **Currency**: Default currency for transactions
- **Date Format**: Choose your preferred format
- **Email Notifications**: Configure alerts and updates

## Step 3: Connect Your Data

### Option A: POS Integration
1. Navigate to **Integrations**
2. Select your POS system
3. Follow connection wizard
4. Test the integration

### Option B: Manual Import
1. Go to **Transactions**
2. Click **Import Data**
3. Upload your CSV file
4. Map the data fields

## Step 4: Verify Everything Works

### Test Transaction
1. Create a sample transaction
2. Verify tax calculation is correct
3. Check location and product details
4. Review in dashboard

### Review Dashboard
- Check key metrics display
- Verify transaction data appears
- Test filter and search functions
- Explore available reports

## Next Steps

Once your basics are set up:
- **Explore Insights**: View business analytics
- **Generate Reports**: Create tax returns and summaries
- **Set Up Automation**: Configure scheduled tasks
- **Learn Advanced Features**: Explore power-user tools

## Quick Tips for Success

1. **Start Simple**: Begin with basic setup, add complexity later
2. **Test First**: Always test with sample data before going live
3. **Stay Updated**: Review settings monthly for accuracy
4. **Use Support**: Our team is here to help when needed

Ready to dive deeper? Check out our detailed guides for each feature area.
    `,
    category: helpCategories[0], // getting-started
    tags: ['getting-started', 'quick-start', 'setup', 'beginners'],
    difficulty: 'beginner',
    lastUpdated: '2024-01-25',
    views: 234,
    helpful: 45,
    notHelpful: 1
  },
  {
    id: 'common-concepts',
    title: 'Understanding Key Concepts',
    content: `
# Understanding Key Concepts

Learn the essential concepts that will help you use Sales Tax Insights effectively.

## Sales Tax Fundamentals

### What is Sales Tax?
Sales tax is a consumption tax paid by consumers on goods and services, collected by businesses at the point of sale.

### Key Components
- **Tax Base**: The amount subject to tax (usually sale price)
- **Tax Rate**: Percentage applied to the tax base
- **Tax Amount**: Final tax collected (base × rate)
- **Total**: Sale amount plus tax

## Nexus Explained

### Physical Nexus
A business has nexus in a state where it has:
- **Physical Presence**: Offices, warehouses, stores
- **Employees**: Workers or contractors
- **Property**: Equipment, inventory, real estate
- **Activities**: Sales calls, installations, repairs

### Economic Nexus
Created by sales volume or transaction count:
- **Thresholds**: Typically $100,000 or 200+ transactions
- **Measurement**: Calendar or previous year activity
- **Remote Sales**: Online, phone, or mail orders
- **Marketplace Sales**: Often included in calculations

## Jurisdictions and Rates

### State Level
- **Base Rate**: State-wide sales tax rate
- **Registration**: Required when nexus exists
- **Filing**: Monthly, quarterly, or annual returns
- **Administration**: State revenue departments

### Local Jurisdictions
- **Counties**: Additional county taxes
- **Cities**: Municipal tax rates
- **Special Districts**: Schools, transportation, etc.
- **Combined Rates**: Total of all applicable taxes

### Rate Changes
- **Effective Dates**: When new rates take effect
- **Notice Requirements**: Advance warning periods
- **Retroactive Changes**: Rare but possible
- **Holiday Rates**: Special temporary rates

## Product Categories

### Taxable Goods
- Most physical products
- Prepared food and beverages
- Entertainment and services
- Digital goods (varies by state)

### Tax-Exempt Items
- **Groceries**: Unprepared food items
- **Prescription Drugs**: Medical necessities
- **Manufacturing Equipment**: In many states
- **Resale Items**: Business-to-business sales

### Special Categories
- **Clothing**: Some states have exemptions
- **Services**: Taxation varies widely
- **Digital Products**: Rapidly evolving rules
- **Marketplace Sales**: Special considerations

## Exemptions and Certificates

### Customer Exemptions
- **Resale Certificates**: For retailers
- **Non-Profit Organizations**: Qualified entities
- **Government Entities**: Federal, state, local
- **Manufacturing**: Direct use exemptions

### Certificate Management
- **Collection**: Obtain before first exempt sale
- **Validation**: Verify certificate authenticity
- **Expiration**: Monitor renewal dates
- **Documentation**: Maintain proper records

## Compliance Requirements

### Registration
- **When Required**: Upon establishing nexus
- **Process**: State-specific applications
- **Timing**: Before collecting tax
- **Fees**: Application and annual fees may apply

### Collection
- **Proper Rates**: Use current, accurate rates
- **Jurisdiction**: Collect for destination or origin
- **Timing**: At point of sale
- **Documentation**: Maintain transaction records

### Filing and Payment
- **Returns**: Periodic tax return filing
- **Payments**: Remit collected taxes
- **Deadlines**: Never miss filing dates
- **Penalties**: Avoid late filing consequences

Understanding these concepts will help you navigate sales tax requirements with confidence. For specific questions, consult with our compliance experts.
    `,
    category: helpCategories[0], // getting-started
    tags: ['concepts', 'fundamentals', 'nexus', 'compliance'],
    difficulty: 'beginner',
    lastUpdated: '2024-01-24',
    views: 456,
    helpful: 72,
    notHelpful: 3
  },
  // Add curated real articles with comprehensive, authoritative content
  ...curatedRealArticles
];

// FAQ Database
export const faqDatabase: FAQ[] = [
  // Getting Started FAQs
  {
    id: 'faq-001',
    question: 'How do I get started with Sales Tax Insights?',
    answer: 'Start by creating your account, adding your business information, and configuring your tax settings. Our setup wizard will guide you through each step. You can then connect your POS system or manually import transactions.',
    category: helpCategories[0], // getting-started
    tags: ['setup', 'onboarding', 'getting-started'],
    priority: 10
  },
  {
    id: 'faq-002',
    question: 'What POS systems do you integrate with?',
    answer: 'We integrate with major POS systems including Square, Shopify, Clover, Toast, Lightspeed, WooCommerce, and BigCommerce. We also provide REST APIs for custom integrations. Contact support for specific integration questions.',
    category: helpCategories[4], // integrations
    tags: ['pos', 'integrations', 'compatibility'],
    priority: 9
  },
  {
    id: 'faq-003',
    question: 'How accurate are your tax calculations?',
    answer: 'Our tax calculations use the most current rates from official state sources, updated daily. We achieve 99.9% accuracy for standard transactions. Complex scenarios involving exemptions or special products may require manual review.',
    category: helpCategories[2], // tax-rates
    tags: ['accuracy', 'tax-rates', 'calculations'],
    priority: 10
  },
  {
    id: 'faq-004',
    question: 'Can I import historical transaction data?',
    answer: 'Yes! You can import historical data via CSV files or through our API. We support standard formats and can help map your data fields. Historical imports are useful for trend analysis and compliance reviews.',
    category: helpCategories[1], // transactions
    tags: ['import', 'historical-data', 'csv'],
    priority: 7
  },
  {
    id: 'faq-005',
    question: 'How do I handle tax-exempt customers?',
    answer: 'Set up customer exemption profiles by uploading their exemption certificates. The system will automatically apply exemptions to qualifying transactions. Always ensure certificates are current and valid.',
    category: helpCategories[2], // tax-rates
    tags: ['exemptions', 'certificates', 'compliance'],
    priority: 8
  },
  {
    id: 'faq-006',
    question: 'What reports can I generate?',
    answer: 'Generate sales tax returns, transaction summaries, nexus reports, exemption reports, and custom analytics reports. All reports can be exported to PDF, Excel, or CSV formats.',
    category: helpCategories[3], // reports
    tags: ['reports', 'exports', 'analytics'],
    priority: 8
  },
  {
    id: 'faq-007',
    question: 'How do I know if I need to collect tax in a new state?',
    answer: 'Our platform monitors your sales by state and alerts you when approaching economic nexus thresholds. We also track physical nexus indicators and provide compliance recommendations.',
    category: helpCategories[2], // tax-rates
    tags: ['nexus', 'compliance', 'thresholds'],
    priority: 9
  },
  {
    id: 'faq-008',
    question: 'What happens if there\'s a sync error with my POS?',
    answer: 'Sync errors are logged and you\'ll receive notifications. Most errors resolve automatically on retry. For persistent issues, check your API credentials and connection settings, or contact support.',
    category: helpCategories[5], // troubleshooting
    tags: ['sync-errors', 'pos', 'troubleshooting'],
    priority: 6
  },
  {
    id: 'faq-009',
    question: 'Can I use this for multiple businesses?',
    answer: 'Yes! You can manage multiple businesses under one account. Each business has separate settings, reports, and compliance tracking. Switch between businesses using the business selector in the navigation.',
    category: helpCategories[6], // account-management
    tags: ['multiple-businesses', 'account', 'management'],
    priority: 7
  },
  {
    id: 'faq-010',
    question: 'How secure is my data?',
    answer: 'We use bank-level security with 256-bit SSL encryption, SOC 2 compliance, and regular security audits. Data is backed up daily and we never share customer information with third parties.',
    category: helpCategories[6], // account-management
    tags: ['security', 'privacy', 'compliance'],
    priority: 8
  },
  {
    id: 'faq-011',
    question: 'Can I customize tax rates for specific products?',
    answer: 'Yes! Set up product categories with custom tax rules. This is useful for items with special tax treatment like clothing, food, or digital products. Rules can vary by state and jurisdiction.',
    category: helpCategories[2], // tax-rates
    tags: ['product-categories', 'custom-rates', 'tax-rules'],
    priority: 6
  },
  {
    id: 'faq-012',
    question: 'How do I handle refunds and returns?',
    answer: 'Process refunds through your POS system as normal. The platform will automatically adjust tax calculations and update your totals. Refund transactions are clearly marked in your reports.',
    category: helpCategories[1], // transactions
    tags: ['refunds', 'returns', 'adjustments'],
    priority: 5
  },
  {
    id: 'faq-013',
    question: 'What if I disagree with a tax calculation?',
    answer: 'You can manually override calculations when needed, but document the reason. For systematic issues, contact support to review rate configurations. All overrides are logged for audit purposes.',
    category: helpCategories[5], // troubleshooting
    tags: ['overrides', 'manual-adjustments', 'disputes'],
    priority: 4
  },
  {
    id: 'faq-014',
    question: 'How often are tax rates updated?',
    answer: 'Tax rates are updated daily from official government sources. Critical rate changes are applied immediately. You\'ll receive notifications about significant changes affecting your business.',
    category: helpCategories[2], // tax-rates
    tags: ['rate-updates', 'government-sources', 'notifications'],
    priority: 7
  },
  {
    id: 'faq-015',
    question: 'Can I schedule automatic reports?',
    answer: 'Yes! Set up recurring reports for daily, weekly, monthly, or quarterly delivery. Reports can be emailed to multiple recipients or uploaded to cloud storage services.',
    category: helpCategories[3], // reports
    tags: ['scheduled-reports', 'automation', 'recurring'],
    priority: 6
  }
];

// Get categories by ID helper
export const getCategoryById = (id: string): HelpCategory | undefined => {
  return helpCategories.find(category => category.id === id);
};

// Search functions
export const searchArticles = (query: string, category?: string): HelpArticle[] => {
  const searchTerm = query.toLowerCase();
  return helpArticles.filter(article => {
    const matchesCategory = !category || article.category.id === category;
    const matchesSearch = 
      article.title.toLowerCase().includes(searchTerm) ||
      article.content.toLowerCase().includes(searchTerm) ||
      article.tags.some(tag => tag.toLowerCase().includes(searchTerm));
    
    return matchesCategory && matchesSearch;
  });
};

export const searchFAQs = (query: string, category?: string): FAQ[] => {
  const searchTerm = query.toLowerCase();
  return faqDatabase.filter(faq => {
    const matchesCategory = !category || faq.category.id === category;
    const matchesSearch = 
      faq.question.toLowerCase().includes(searchTerm) ||
      faq.answer.toLowerCase().includes(searchTerm) ||
      faq.tags.some(tag => tag.toLowerCase().includes(searchTerm));
    
    return matchesCategory && matchesSearch;
  });
};

// Get popular articles
export const getPopularArticles = (limit: number = 5): HelpArticle[] => {
  return [...helpArticles]
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
};

// Get high-priority FAQs
export const getTopFAQs = (limit: number = 10): FAQ[] => {
  return [...faqDatabase]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
};
