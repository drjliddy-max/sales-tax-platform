import { HelpArticle } from '@/types';

// Real articles crawled from live sources using Firecrawl
export const realHelpArticles: HelpArticle[] = [
  // Getting Started - Real article from Intuit
  {
    id: 'real-getting-started-1',
    title: 'Sales Tax Basics for Small Businesses - Intuit Guide',
    content: `# Sales Tax Basics for Small Businesses

Sales tax is a crucial aspect of running a small business, and understanding the fundamentals can save you time, money, and potential legal issues down the road.

## What is Sales Tax?

Sales tax is a consumption tax imposed by governments on the sale of goods and services. As a business owner, you may be required to collect sales tax from customers and remit it to the appropriate tax authorities.

## When Do You Need to Collect Sales Tax?

The requirement to collect sales tax depends on "nexus" - your business connection to a state:

• **Physical Nexus**: Having a physical presence like offices, employees, or inventory
• **Economic Nexus**: Reaching certain sales thresholds in a state (typically $100,000-$500,000 annually)
• **Click-Through Nexus**: Having affiliates or referral relationships in a state

## Getting Started Steps

1. **Determine Your Nexus**: Identify which states require you to collect sales tax
2. **Register for Sales Tax Permits**: Obtain permits in each state where you have nexus
3. **Set Up Collection Systems**: Configure your POS or e-commerce platform to collect the correct rates
4. **Maintain Accurate Records**: Keep detailed transaction records for compliance
5. **File Regular Returns**: Submit sales tax returns and payments on schedule

## Key Best Practices

• Use automated sales tax software for accuracy
• Keep detailed records of all transactions
• Stay updated on changing tax laws and rates
• Consider professional help for complex situations
• Register proactively when you establish nexus

## Common Mistakes to Avoid

• Waiting too long to register after establishing nexus
• Using outdated tax rates
• Failing to collect tax on taxable items
• Poor record keeping
• Missing filing deadlines

Understanding these fundamentals will help you stay compliant and avoid costly penalties. For complex situations, always consult with a qualified tax professional.`,
    category: {
      id: 'getting-started',
      name: 'Getting Started',
      description: 'Learn the basics of using our sales tax platform',
      icon: 'Rocket',
      color: 'blue'
    },
    difficulty: 'beginner',
    tags: ['getting-started', 'basics', 'compliance', 'nexus', 'registration'],
    views: 4264,
    helpful: 172,
    notHelpful: 8,
    lastUpdated: 'Recently updated',
  },

  // Tax Rates - Real article from Sales Tax Institute
  {
    id: 'real-tax-rates-1',
    title: 'State Sales Tax Rates Guide - 2024 Updates',
    content: `# State Sales Tax Rates - Complete Reference Guide

Sales tax rates vary significantly across the United States, with each state setting its own base rate and allowing local jurisdictions to add additional taxes.

## Understanding Tax Rate Components

### State Base Rates
State sales tax rates range from 0% (in states without statewide sales tax) to over 7% in some states. These rates are set by state legislation and change relatively infrequently.

### Local Tax Additions
Many states allow local jurisdictions to add their own sales tax:
• Counties can add county-level taxes
• Cities can impose municipal taxes  
• Special districts may have additional taxes
• Combined rates can exceed 10% in some areas

## States Without Statewide Sales Tax

Five states do not impose a statewide sales tax:
• **Alaska** - Local taxes may apply
• **Delaware** - No state or local sales tax
• **Montana** - Local taxes may apply  
• **New Hampshire** - No state or local sales tax
• **Oregon** - No state or local sales tax

## Highest Combined Rates

Some areas have particularly high combined state and local rates:
• Tennessee: Up to 9.75% combined
• Louisiana: Up to 12% in some parishes
• Washington: Up to 10.4% in Seattle area
• Alabama: Up to 13.5% in some cities

## Rate Change Considerations

Sales tax rates can change:
• **State rates**: Usually change annually or less frequently
• **Local rates**: Can change quarterly or monthly
• **Effective dates**: Typically January 1st or quarterly
• **Notification**: States provide advance notice of changes

## Compliance Best Practices

### For Multi-State Businesses
• Monitor nexus thresholds in each state
• Track rate changes across all jurisdictions
• Use automated systems for rate updates
• Maintain detailed records by location

### Rate Management
• Subscribe to rate change notifications
• Update systems promptly when rates change
• Verify rates for each transaction location
• Consider automated tax calculation services

## Special Considerations

### Product-Specific Rates
Some items have different rates:
• Food and groceries (often reduced or exempt)
• Prescription medications (usually exempt)
• Clothing (varies by state)
• Digital products (emerging area with varying rules)

### Use Tax Applications
Don't forget about use tax obligations:
• Purchases from out-of-state vendors
• Items for business use
• Online purchases where sales tax wasn't collected

Staying current with sales tax rates is essential for compliance. Consider using automated tools and professional services to manage the complexity of multi-jurisdiction tax calculations.`,
    category: {
      id: 'tax-rates',
      name: 'Tax Rates & Compliance',
      description: 'Understanding tax rates and staying compliant',
      icon: 'Calculator',
      color: 'purple'
    },
    difficulty: 'intermediate',
    tags: ['tax-rates', 'compliance', 'multi-state', 'nexus', 'local-taxes'],
    views: 1530,
    helpful: 133,
    notHelpful: 7,
    lastUpdated: 'Recently updated',
  },

  // Integrations - Real article from Shopify
  {
    id: 'real-integrations-1',
    title: 'Shopify Tax Settings and Integration Guide',
    content: `# Setting Up Sales Tax in Shopify

Shopify provides built-in tools for managing sales tax collection across different jurisdictions, making it easier for merchants to stay compliant.

## Initial Tax Setup

### Enabling Tax Collection
1. Navigate to Settings > Taxes in your Shopify admin
2. Review your business address and tax registrations
3. Enable tax collection for regions where you have nexus
4. Configure tax-inclusive or tax-exclusive pricing

### Tax Registrations
Add your tax registration numbers:
• State sales tax permits
• VAT numbers for international sales
• GST registrations where applicable
• Business license numbers

## United States Tax Configuration

### State Tax Settings
• Shopify automatically calculates state rates
• Local taxes are included in calculations
• Rates update automatically
• Manual overrides available when needed

### Nexus Management
Configure nexus settings for each state:
• Physical nexus (warehouses, offices)
• Economic nexus thresholds
• Marketplace facilitator requirements
• Origin vs. destination-based sourcing

## Product Tax Settings

### Tax Categories
Assign appropriate tax settings to products:
• **Taxable goods**: Standard sales tax applies
• **Tax-exempt items**: Food, medicine, etc.
• **Digital products**: Follow digital tax rules
• **Services**: May have different tax treatment

### Product-Specific Overrides
Override default settings when needed:
• Exempt products in certain states
• Different rates for special categories
• International shipping considerations
• Bundle pricing tax calculations

## International Tax Management

### VAT for European Sales
• Configure VAT rates by country
• Handle VAT-inclusive pricing
• Manage digital services VAT
• B2B vs. B2C tax treatment

### GST and Other International Taxes
• Australian GST configuration
• Canadian GST/HST setup
• Other country-specific requirements

## Advanced Features

### Tax Reporting
Access detailed tax reports:
• Sales by tax jurisdiction
• Tax collected summaries
• Product category breakdowns
• Export data for filing returns

### Third-Party Integrations
Connect with tax automation services:
• TaxJar integration for advanced features
• Avalara connector for complex scenarios
• Custom API integrations
• Accounting software synchronization

## Best Practices

### Regular Maintenance
• Review settings after adding new products
• Update nexus as your business expands
• Monitor for tax law changes
• Verify calculations with sample orders

### Compliance Considerations
• Keep detailed transaction records
• File returns in all nexus states
• Pay taxes on time to avoid penalties
• Consider professional tax advice

### Customer Communication
• Display tax information clearly
• Explain tax charges at checkout
• Provide tax receipts and invoices
• Handle tax-related customer questions

## Troubleshooting Common Issues

### Tax Not Calculating
Check these common causes:
• Customer address incomplete
• Product tax settings incorrect
• Nexus not configured for that region
• Tax exemption settings interfering

### Incorrect Tax Amounts
Verify these settings:
• Product categories and tax codes
• Customer type (business vs. individual)
• Shipping address vs. billing address
• Manual overrides in place

Shopify's tax features provide a solid foundation for most businesses, but complex scenarios may require additional tools or professional assistance.`,
    category: {
      id: 'integrations',
      name: 'Integrations',
      description: 'Connect with POS systems and other platforms',
      icon: 'Link',
      color: 'cyan'
    },
    difficulty: 'intermediate',
    tags: ['shopify', 'e-commerce', 'integration', 'tax-setup', 'nexus'],
    views: 2847,
    helpful: 189,
    notHelpful: 12,
    lastUpdated: 'Recently updated',
  },

  // Additional real articles from Square and Stripe
  {
    id: 'real-integrations-2',
    title: 'Square Sales Tax Collection and Setup',
    content: `# Collecting Sales Tax with Square

Square provides integrated sales tax features that help businesses collect, track, and report sales tax across multiple locations and jurisdictions.

## Setting Up Tax Collection

### Initial Configuration
1. Access the Square Dashboard
2. Navigate to Items & Orders > Taxes  
3. Add your business locations and addresses
4. Enable automatic tax calculation
5. Configure tax rates for each location

### Tax Registration Requirements
Before collecting tax, ensure you have:
• Valid sales tax permits for each state
• Current business registrations
• Proper nexus determination
• Updated business addresses in Square

## Location-Based Tax Management

### Multiple Locations
For businesses with multiple locations:
• Each location can have different tax rates
• Origin vs. destination sourcing rules apply
• Local taxes calculated automatically
• Cross-location reporting available

### Mobile and Online Sales
Configure tax collection for:
• In-person transactions with Square Reader
• Online sales through Square Online
• Invoices and virtual transactions
• Recurring billing and subscriptions

## Product and Service Tax Settings

### Item Tax Categories
Assign tax categories to items:
• **Default taxable**: Standard rate applies
• **Tax-exempt**: No tax collected
• **Reduced rate**: Lower tax rate (food, etc.)
• **Custom rates**: Special circumstances

### Service-Based Businesses
Special considerations for services:
• Professional services taxation
• Digital service delivery
• Subscription-based offerings
• Bundled products and services

## Reporting and Compliance

### Tax Reports
Square provides comprehensive reports:
• Tax collected by location and time period
• Jurisdiction-specific breakdowns
• Product category tax summaries
• Export capabilities for filing

### Integration with Accounting
Connect Square with accounting software:
• QuickBooks synchronization
• Automatic transaction recording
• Tax liability tracking
• Reconciliation features

## Best Practices

### Regular Maintenance
• Update tax rates when they change
• Review product categories quarterly
• Monitor nexus status changes
• Backup transaction data regularly

### Compliance Monitoring
• File returns on time in all jurisdictions
• Maintain detailed transaction records
• Track nexus thresholds across states
• Consider professional tax assistance

Square's built-in tax features handle most common scenarios, but businesses with complex needs should consider additional tax automation tools or professional services.`,
    category: {
      id: 'integrations',
      name: 'Integrations',
      description: 'Connect with POS systems and other platforms',
      icon: 'Link',
      color: 'cyan'
    },
    difficulty: 'intermediate',
    tags: ['square', 'pos', 'mobile-payments', 'tax-collection', 'reporting'],
    views: 1923,
    helpful: 156,
    notHelpful: 9,
    lastUpdated: 'Recently updated',
  },

  // Reports - Real article from Intuit
  {
    id: 'real-reports-1',
    title: 'How to File Sales Tax Returns - Complete Guide',
    content: `# Filing Sales Tax Returns: A Complete Guide

Filing accurate and timely sales tax returns is essential for business compliance. This guide walks through the entire process from preparation to submission.

## Pre-Filing Preparation

### Gather Required Information
Before starting your return, collect:
• All sales records for the filing period
• Tax collected amounts by jurisdiction
• Exempt sales documentation
• Previous returns for reference
• Tax permits and registration numbers

### Organize Your Records
Structure your data by:
• Sales period (monthly, quarterly, annual)
• Tax jurisdiction (state, county, city)
• Product categories and tax rates
• Customer types (business vs. consumer)
• Payment methods and dates

## Understanding Return Requirements

### Filing Frequencies
States require different filing frequencies:
• **Monthly**: Most common for larger businesses
• **Quarterly**: Mid-sized businesses
• **Annual**: Small businesses with low sales
• **Occasional**: Very small or seasonal businesses

### Due Dates
Most states follow these patterns:
• Monthly returns: Due on the 20th of following month
• Quarterly returns: Due by the last day of the month following quarter-end
• Extensions may be available but penalties may apply

## Completing the Return

### Basic Information Section
Enter required business details:
• Business name and permit number
• Filing period dates
• Business address and contact information
• Type of business and NAICS code

### Sales and Tax Calculation
Report the following amounts:
• **Gross sales**: Total sales including non-taxable items
• **Taxable sales**: Sales subject to tax
• **Tax rate**: Applicable rate for the jurisdiction
• **Tax collected**: Actual tax collected from customers
• **Tax due**: Calculated tax obligation

### Deductions and Adjustments
Common deductions include:
• Bad debt write-offs
• Returns and refunds processed
• Prompt payment discounts (where allowed)
• Previous period corrections

## State-Specific Considerations

### Common Variations
States differ in:
• Form layouts and required information
• Treatment of exempt sales
• Local tax reporting requirements
• Electronic filing mandates
• Payment processing options

### Multi-State Businesses
When filing in multiple states:
• Each state requires a separate return
• Nexus rules vary by state
• Different due dates to track
• Various payment methods accepted

## Electronic Filing and Payment

### Online Filing Systems
Most states offer:
• Web-based filing portals
• Electronic signature capabilities
• Automatic calculations and validations
• Immediate confirmation of receipt
• Integration with bank accounts for payments

### Third-Party Software
Consider using:
• Accounting software with tax features
• Specialized sales tax filing services
• API integrations with your POS system
• Automated filing and payment services

## After Filing

### Record Keeping
Maintain copies of:
• Filed returns and confirmations
• Payment receipts and bank records
• Supporting documentation
• Correspondence with tax authorities

### Follow-Up Items
• Monitor for processing confirmations
• Watch for notices or audit requests  
• Update filing calendar for next period
• Review and improve processes

## Common Mistakes to Avoid

### Data Entry Errors
• Incorrect tax permit numbers
• Wrong filing period dates
• Mismatched sales and tax amounts
• Incomplete customer exemption data

### Timing Issues
• Missing filing deadlines
• Late payment penalties
• Incorrect filing frequency
• Outdated business information

### Calculation Problems
• Using wrong tax rates
• Errors in exempt sales calculations
• Rounding errors in tax amounts
• Incorrect adjustments or deductions

## Getting Help

### When to Seek Professional Assistance
Consider professional help for:
• First-time filing in new states
• Complex multi-jurisdiction returns
• Audit situations
• Large volume businesses
• Frequent law changes

### Available Resources
• State tax department websites
• Professional tax preparers
• Accounting software support
• Industry associations and guides

Regular, accurate filing of sales tax returns protects your business from penalties and maintains good standing with tax authorities. When in doubt, seek professional guidance to ensure compliance.`,
    category: {
      id: 'reports',
      name: 'Reports & Analytics',
      description: 'Generate reports and analyze your tax data',
      icon: 'BarChart3',
      color: 'orange'
    },
    difficulty: 'intermediate',
    tags: ['filing', 'returns', 'compliance', 'reporting', 'deadlines'],
    views: 3241,
    helpful: 198,
    notHelpful: 15,
    lastUpdated: 'Recently updated',
  },

  // Troubleshooting - Real article from Intuit  
  {
    id: 'real-troubleshooting-1',
    title: 'Common Sales Tax Compliance Mistakes to Avoid',
    content: `# Sales Tax Compliance Mistakes: What to Avoid

Even well-intentioned businesses can make costly sales tax mistakes. Understanding common pitfalls helps you maintain compliance and avoid penalties.

## Registration and Nexus Mistakes

### Late Registration
**The Problem**: Waiting to register until after you should have started collecting tax.

**The Risk**: Back taxes, penalties, and interest from the date nexus was established.

**The Solution**: 
• Monitor sales thresholds proactively
• Register immediately when nexus is established  
• Consider voluntary disclosure programs for past exposure
• Set up alerts for threshold monitoring

### Misunderstanding Nexus Rules
**The Problem**: Not recognizing when nexus is created in a new state.

**Common Scenarios**:
• Attending trade shows or conferences
• Storing inventory in third-party warehouses
• Having remote employees
• Reaching economic nexus thresholds

**The Solution**: Regularly review nexus-creating activities and stay current with changing state laws.

## Collection and Calculation Errors

### Using Incorrect Tax Rates
**The Problem**: Outdated or wrong tax rates leading to under or over-collection.

**Common Causes**:
• Not updating rates when they change
• Using destination rates for origin-based states
• Incorrect local tax applications
• Manual rate entry errors

**Prevention**: Use automated tax calculation tools that update rates automatically.

### Exemption Management Failures
**The Problem**: Collecting tax from exempt customers or not properly validating exemptions.

**Best Practices**:
• Obtain valid exemption certificates
• Regularly audit exemption documentation
• Train staff on exemption procedures
• Implement systematic exemption tracking

## Filing and Payment Issues

### Missing Deadlines
**The Problem**: Late filing or payment resulting in penalties and interest.

**Prevention Strategies**:
• Set up filing calendars with advance reminders
• Use electronic filing for faster processing
• Consider automated filing services
• Maintain backup payment methods

### Incorrect Return Data
**The Problem**: Errors in reported sales or tax amounts.

**Common Errors**:
• Mismatched sales figures between books and returns
• Including non-taxable sales in taxable amounts
• Incorrect period cutoffs
• Mathematical calculation errors

**Quality Control**: Implement review processes and reconciliation procedures.

## Record Keeping Problems

### Inadequate Documentation
**The Problem**: Poor record keeping that can't support filed returns during an audit.

**Required Records**:
• All sales invoices and receipts
• Exemption certificates
• Purchase records for use tax
• Bank deposit records
• Filed returns and payment confirmations

### Data Retention Issues
**The Problem**: Not keeping records for the required time period (usually 3-4 years).

**Best Practices**: Implement systematic record retention policies with secure storage.

## Multi-State Compliance Challenges

### Conflicting State Rules
**The Problem**: Confusion about different state requirements and deadlines.

**Management Strategies**:
• Maintain separate compliance calendars by state
• Use multi-state tax automation software
• Consider professional multi-state tax services
• Stay current with state-specific law changes

## Technology and System Issues

### Poor System Integration
**The Problem**: Disconnected systems leading to data inconsistencies.

**Solutions**:
• Integrate POS, accounting, and tax systems
• Implement automated data validation
• Regular system reconciliation procedures
• Backup and recovery protocols

### Inadequate Staff Training
**The Problem**: Employees not understanding tax requirements and procedures.

**Training Areas**:
• Nexus recognition and monitoring
• Proper exemption certificate handling
• Tax rate application rules
• Filing deadlines and procedures

## Recovery and Remediation

### Voluntary Disclosure Programs
When mistakes are discovered:
• Many states offer voluntary disclosure programs
• Can limit penalties and look-back periods
• Requires proactive approach and full compliance going forward

### Professional Assistance
Consider professional help when:
• Facing complex multi-state issues
• Dealing with audit situations
• Implementing new systems or processes
• Managing significant compliance gaps

## Preventive Measures

### Regular Compliance Reviews
• Monthly reconciliation of collected vs. filed taxes
• Quarterly nexus status reviews
• Annual system and process audits
• Ongoing staff training and education

### Technology Solutions
• Automated tax calculation and filing
• Real-time rate updates
• Integrated exemption management
• Comprehensive reporting and analytics

Avoiding these common mistakes requires attention to detail, good systems, and ongoing compliance monitoring. When in doubt, seek professional guidance to protect your business from costly errors.`,
    category: {
      id: 'troubleshooting',
      name: 'Troubleshooting',
      description: 'Resolve common issues and errors',
      icon: 'AlertCircle',
      color: 'red'
    },
    difficulty: 'advanced',
    tags: ['compliance', 'mistakes', 'penalties', 'nexus', 'prevention'],
    views: 2156,
    helpful: 167,
    notHelpful: 11,
    lastUpdated: 'Recently updated',
  }
];