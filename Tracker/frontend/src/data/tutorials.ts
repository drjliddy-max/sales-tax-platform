import React from 'react';
import { Tutorial } from '@/types/onboarding';

export const tutorials: Tutorial[] = [
  {
    id: 'pos-integration-intro',
    title: 'Introduction to POS Integration',
    description: 'Learn the basics of connecting your point-of-sale system for automatic sales tax tracking.',
    category: 'pos_integration',
    difficulty: 'beginner',
    estimatedDuration: 5,
    completionReward: {
      type: 'badge',
      value: 'POS Integration Starter'
    },
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to POS Integration',
        description: 'Let\'s get started with connecting your point-of-sale system to automate your sales tax tracking.',
        content: `
          <div class="space-y-3">
            <p>Connecting your POS system will allow us to:</p>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li>Automatically import your transactions</li>
              <li>Calculate sales tax in real-time</li>
              <li>Generate compliance reports</li>
              <li>Track multi-location sales</li>
            </ul>
          </div>
        `,
        skippable: false
      },
      {
        id: 'navigate-to-pos',
        title: 'Navigate to POS Integration',
        description: 'First, let\'s go to the POS integration page where you can manage your connections.',
        content: 'Click on the "POS Integrations" link in the navigation or the button below.',
        target: 'a[href="/pos"], button[data-tutorial="pos-nav"]',
        position: 'bottom',
        actionButton: {
          text: 'Go to POS Page',
          action: () => {
            // This would be implemented to navigate to the POS page
            if (typeof window !== 'undefined') {
              window.location.href = '/pos';
            }
          }
        },
        validationFn: () => {
          return typeof window !== 'undefined' && window.location.pathname === '/pos';
        }
      },
      {
        id: 'add-pos-button',
        title: 'Add Your First POS System',
        description: 'Click the "Add POS System" button to start connecting your point-of-sale system.',
        content: 'This button will open our POS discovery tool to help you find and connect your specific POS system.',
        target: 'button:contains("Add POS System"), [data-tutorial="add-pos-button"]',
        position: 'bottom',
        validationFn: () => {
          // Check if the discovery modal or page is open
          return document.querySelector('[data-tutorial="pos-discovery"]') !== null;
        }
      },
      {
        id: 'pos-selection',
        title: 'Choose Your POS System',
        description: 'Select your POS system from our supported list. We support popular systems like Square, Shopify, Clover, and Toast.',
        content: `
          <div class="space-y-2">
            <p class="text-sm">Don't see your POS system? You can:</p>
            <ul class="list-disc list-inside space-y-1 text-xs">
              <li>Use manual entry for now</li>
              <li>Request integration for your system</li>
              <li>Use our CSV import feature</li>
            </ul>
          </div>
        `,
        target: '[data-tutorial="pos-list"], .pos-system-card',
        position: 'right'
      },
      {
        id: 'completion',
        title: 'Tutorial Complete!',
        description: 'Great! You now know how to navigate to POS integrations and start connecting your systems.',
        content: `
          <div class="space-y-3">
            <p class="text-green-600 font-medium">🎉 Congratulations!</p>
            <p class="text-sm">You've completed the POS Integration introduction. Next steps:</p>
            <ul class="list-disc list-inside space-y-1 text-xs">
              <li>Complete the setup for your specific POS system</li>
              <li>Test the connection</li>
              <li>Import your first transactions</li>
            </ul>
          </div>
        `,
        skippable: false
      }
    ]
  },
  {
    id: 'square-pos-setup',
    title: 'Connecting Square POS',
    description: 'Step-by-step guide to connect your Square point-of-sale system.',
    category: 'pos_integration',
    difficulty: 'beginner',
    estimatedDuration: 10,
    prerequisites: ['pos-integration-intro'],
    steps: [
      {
        id: 'square-intro',
        title: 'Square POS Connection',
        description: 'Learn how to connect your Square POS system for automatic transaction import.',
        content: `
          <div class="space-y-3">
            <p>To connect Square, you'll need:</p>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li>Your Square account login</li>
              <li>Admin access to your Square account</li>
              <li>A few minutes to complete the setup</li>
            </ul>
            <p class="text-sm text-blue-600">This connection is secure and read-only.</p>
          </div>
        `
      },
      {
        id: 'select-square',
        title: 'Select Square from the List',
        description: 'Find and click on Square in the POS system list.',
        content: 'Look for the Square logo and click on it to start the connection process.',
        target: '[data-pos-type="square"], .pos-card[data-id="square"]',
        position: 'bottom',
        validationFn: () => {
          // Check if Square is selected or onboarding started
          return document.querySelector('[data-tutorial="square-selected"]') !== null;
        }
      },
      {
        id: 'oauth-connection',
        title: 'Authorize the Connection',
        description: 'Click "Connect with Square" to authorize our app to access your Square data.',
        content: `
          <div class="space-y-2">
            <p class="text-sm">You'll be redirected to Square to:</p>
            <ul class="list-disc list-inside space-y-1 text-xs">
              <li>Login to your Square account</li>
              <li>Authorize read access to transactions</li>
              <li>Select which locations to connect</li>
            </ul>
          </div>
        `,
        target: 'button:contains("Connect with Square"), [data-tutorial="square-oauth"]',
        position: 'bottom'
      },
      {
        id: 'test-connection',
        title: 'Test Your Connection',
        description: 'Once connected, we\'ll test the connection and import recent transactions.',
        content: 'This may take a few moments while we verify your connection and fetch sample data.',
        target: '[data-tutorial="connection-test"]',
        position: 'top'
      },
      {
        id: 'square-complete',
        title: 'Square Connection Complete!',
        description: 'Your Square POS is now connected and ready to sync transactions.',
        content: `
          <div class="space-y-3">
            <p class="text-green-600 font-medium">✅ Successfully Connected!</p>
            <p class="text-sm">Your Square POS will now:</p>
            <ul class="list-disc list-inside space-y-1 text-xs">
              <li>Automatically import new transactions</li>
              <li>Calculate sales tax for each sale</li>
              <li>Update your dashboard with real-time data</li>
            </ul>
          </div>
        `,
        skippable: false
      }
    ]
  },
  {
    id: 'dashboard-overview',
    title: 'Understanding Your Dashboard',
    description: 'Get familiar with your sales tax dashboard and key metrics.',
    category: 'dashboard',
    difficulty: 'beginner',
    estimatedDuration: 7,
    steps: [
      {
        id: 'dashboard-intro',
        title: 'Your Sales Tax Dashboard',
        description: 'Welcome to your sales tax tracking dashboard. Let\'s explore the key features.',
        content: `
          <div class="space-y-3">
            <p>Your dashboard provides:</p>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li>Real-time sales and tax metrics</li>
              <li>Monthly transaction summaries</li>
              <li>Compliance status indicators</li>
              <li>Quick access to key actions</li>
            </ul>
          </div>
        `
      },
      {
        id: 'metrics-overview',
        title: 'Key Metrics Cards',
        description: 'These cards show your most important sales tax metrics at a glance.',
        content: 'Monitor your monthly transactions, revenue, and tax collected here.',
        target: '.metrics-card, [data-tutorial="metrics"]',
        position: 'bottom'
      },
      {
        id: 'quick-actions',
        title: 'Quick Actions Panel',
        description: 'Access common tasks quickly from your dashboard.',
        content: 'Use these buttons to view transactions, generate reports, and check compliance.',
        target: '.quick-actions, [data-tutorial="quick-actions"]',
        position: 'top'
      },
      {
        id: 'recent-activity',
        title: 'Recent Activity',
        description: 'See your most recent transactions and their tax calculations.',
        content: 'This table shows your latest transactions with calculated tax amounts.',
        target: '.recent-activity, [data-tutorial="recent-activity"]',
        position: 'top'
      }
    ]
  },
  {
    id: 'transaction-management',
    title: 'Managing Transactions',
    description: 'Learn how to view, filter, and manage your transaction data.',
    category: 'dashboard',
    difficulty: 'intermediate',
    estimatedDuration: 12,
    steps: [
      {
        id: 'navigate-transactions',
        title: 'Go to Transactions',
        description: 'Navigate to the transactions page to see all your imported sales data.',
        content: 'Click on "View Transactions" or use the navigation menu.',
        target: 'a[href="/transactions"], button[data-tutorial="transactions-nav"]',
        position: 'bottom',
        actionButton: {
          text: 'Go to Transactions',
          action: () => {
            if (typeof window !== 'undefined') {
              window.location.href = '/transactions';
            }
          }
        }
      },
      {
        id: 'transaction-filters',
        title: 'Using Filters',
        description: 'Filter your transactions by date range, amount, location, or tax status.',
        content: 'These filters help you find specific transactions or analyze data for specific periods.',
        target: '.transaction-filters, [data-tutorial="filters"]',
        position: 'bottom'
      },
      {
        id: 'transaction-details',
        title: 'Transaction Details',
        description: 'Click on any transaction to see detailed tax calculations and breakdown.',
        content: 'Each transaction shows the tax breakdown by jurisdiction and tax type.',
        target: '.transaction-row, [data-tutorial="transaction-item"]',
        position: 'right'
      },
      {
        id: 'bulk-actions',
        title: 'Bulk Operations',
        description: 'Select multiple transactions to perform bulk operations like export or recalculation.',
        content: 'Use the checkboxes to select transactions and then choose a bulk action.',
        target: '.bulk-actions, [data-tutorial="bulk-actions"]',
        position: 'top'
      }
    ]
  },
  {
    id: 'report-generation',
    title: 'Generating Tax Reports',
    description: 'Learn how to create and export sales tax reports for compliance.',
    category: 'reports',
    difficulty: 'intermediate',
    estimatedDuration: 15,
    steps: [
      {
        id: 'reports-intro',
        title: 'Sales Tax Reporting',
        description: 'Generate comprehensive tax reports for compliance and filing.',
        content: `
          <div class="space-y-3">
            <p>Our reporting system can generate:</p>
            <ul class="list-disc list-inside space-y-1 text-sm">
              <li>Monthly/quarterly tax summaries</li>
              <li>Jurisdiction-specific reports</li>
              <li>Transaction detail reports</li>
              <li>Compliance-ready exports</li>
            </ul>
          </div>
        `
      },
      {
        id: 'navigate-reports',
        title: 'Go to Reports Page',
        description: 'Navigate to the reports section to start generating your tax reports.',
        content: 'Click on "Generate Reports" or use the navigation menu.',
        target: 'a[href="/reports"], button[data-tutorial="reports-nav"]',
        position: 'bottom',
        actionButton: {
          text: 'Go to Reports',
          action: () => {
            if (typeof window !== 'undefined') {
              window.location.href = '/reports';
            }
          }
        }
      },
      {
        id: 'select-report-type',
        title: 'Choose Report Type',
        description: 'Select the type of report you need based on your compliance requirements.',
        content: 'Different report types serve different purposes - choose based on your needs.',
        target: '.report-type-selector, [data-tutorial="report-types"]',
        position: 'right'
      },
      {
        id: 'configure-parameters',
        title: 'Configure Report Parameters',
        description: 'Set the date range, locations, and other parameters for your report.',
        content: 'Be sure to select the correct date range for your filing period.',
        target: '.report-config, [data-tutorial="report-parameters"]',
        position: 'left'
      },
      {
        id: 'generate-export',
        title: 'Generate and Export',
        description: 'Generate your report and export it in your preferred format (PDF, CSV, Excel).',
        content: 'Reports are generated in real-time and can be downloaded immediately.',
        target: '.report-generate, [data-tutorial="generate-report"]',
        position: 'top'
      }
    ]
  }
];

export const getTutorialsByCategory = (category: string): Tutorial[] => {
  if (category === 'all') return tutorials;
  return tutorials.filter(tutorial => tutorial.category === category);
};

export const getTutorialById = (id: string): Tutorial | undefined => {
  return tutorials.find(tutorial => tutorial.id === id);
};

export const getPersonalizedTutorials = (context: any): Tutorial[] => {
  // Implement personalization logic based on user context
  const { selectedPOSType, technicalSkillLevel, hasExistingCredentials } = context;
  
  let recommended = [...tutorials];
  
  // Filter by POS type if specified
  if (selectedPOSType) {
    recommended = recommended.filter(tutorial => 
      tutorial.category !== 'pos_integration' || 
      tutorial.id.includes(selectedPOSType) ||
      tutorial.id === 'pos-integration-intro'
    );
  }
  
  // Filter by skill level
  if (technicalSkillLevel === 'beginner') {
    recommended = recommended.filter(tutorial => 
      tutorial.difficulty === 'beginner' || tutorial.difficulty === 'intermediate'
    );
  } else if (technicalSkillLevel === 'expert') {
    recommended = recommended.filter(tutorial => 
      tutorial.difficulty === 'intermediate' || tutorial.difficulty === 'advanced'
    );
  }
  
  // Sort by relevance (POS integration first for new users)
  recommended.sort((a, b) => {
    if (a.category === 'pos_integration' && b.category !== 'pos_integration') return -1;
    if (b.category === 'pos_integration' && a.category !== 'pos_integration') return 1;
    return 0;
  });
  
  return recommended;
};
