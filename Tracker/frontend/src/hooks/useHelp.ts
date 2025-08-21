import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpContext, QuickAction, HelpArticle, FAQ } from '@/types';
import { helpArticles, faqDatabase, searchArticles, searchFAQs } from '@/data/helpContent';

interface UseHelpOptions {
  userRole?: 'CLIENT' | 'ADMIN';
  contextData?: Record<string, any>;
}

interface UseHelpReturn {
  context: HelpContext;
  searchHelp: (query: string) => {
    articles: HelpArticle[];
    faqs: FAQ[];
  };
  getRelatedContent: (topic: string) => {
    articles: HelpArticle[];
    faqs: FAQ[];
  };
}

// Page-specific help content mapping
const PAGE_HELP_CONFIG = {
  '/': {
    page: 'landing',
    suggestedArticles: ['setup-account', 'dashboard-overview'],
    commonIssues: ['faq-001', 'faq-002'],
    quickActions: [
      { id: 'start-setup', title: 'Start Account Setup', description: 'Get your account configured', icon: 'Rocket' },
      { id: 'view-demo', title: 'View Demo', description: 'See the platform in action', icon: 'Play' }
    ]
  },
  '/dashboard': {
    page: 'dashboard',
    suggestedArticles: ['dashboard-overview', 'setup-account'],
    commonIssues: ['faq-003', 'faq-007'],
    quickActions: [
      { id: 'add-transaction', title: 'Add Transaction', description: 'Record a new sale', icon: 'Plus' },
      { id: 'view-insights', title: 'View Insights', description: 'See AI recommendations', icon: 'Lightbulb' },
      { id: 'generate-report', title: 'Generate Report', description: 'Create tax reports', icon: 'FileText' }
    ]
  },
  '/transactions': {
    page: 'transactions',
    suggestedArticles: ['pos-integration', 'tax-exemptions'],
    commonIssues: ['faq-004', 'faq-008', 'faq-012'],
    quickActions: [
      { id: 'import-data', title: 'Import Data', description: 'Upload transaction file', icon: 'Upload' },
      { id: 'sync-pos', title: 'Sync POS', description: 'Connect your point of sale', icon: 'RefreshCw' },
      { id: 'handle-refund', title: 'Process Refund', description: 'Handle returns and adjustments', icon: 'RotateCcw' }
    ]
  },
  '/reports': {
    page: 'reports',
    suggestedArticles: ['dashboard-overview'],
    commonIssues: ['faq-006', 'faq-015'],
    quickActions: [
      { id: 'monthly-report', title: 'Monthly Report', description: 'Generate this month\'s summary', icon: 'Calendar' },
      { id: 'tax-return', title: 'Tax Return', description: 'Create state tax filing', icon: 'FileCheck' },
      { id: 'custom-report', title: 'Custom Report', description: 'Build custom analytics', icon: 'BarChart' }
    ]
  },
  '/insights': {
    page: 'insights',
    suggestedArticles: ['dashboard-overview', 'nexus-states'],
    commonIssues: ['faq-007', 'faq-003'],
    quickActions: [
      { id: 'view-recommendations', title: 'View AI Recommendations', description: 'See optimization suggestions', icon: 'Brain' },
      { id: 'compliance-check', title: 'Compliance Check', description: 'Review nexus obligations', icon: 'Shield' },
      { id: 'trends-analysis', title: 'Trends Analysis', description: 'Analyze sales patterns', icon: 'TrendingUp' }
    ]
  },
  '/admin/dashboard': {
    page: 'admin-dashboard',
    suggestedArticles: ['setup-account'],
    commonIssues: ['faq-009', 'faq-010'],
    quickActions: [
      { id: 'manage-users', title: 'Manage Users', description: 'Add or remove team members', icon: 'Users' },
      { id: 'system-health', title: 'System Health', description: 'Check platform status', icon: 'Activity' },
      { id: 'audit-logs', title: 'Audit Logs', description: 'Review system activity', icon: 'FileSearch' }
    ]
  }
};

export function useHelp(options: UseHelpOptions = {}): UseHelpReturn {
  const location = useLocation();
  const { userRole, contextData } = options;

  const context = useMemo((): HelpContext => {
    const pathname = location.pathname;
    const config = PAGE_HELP_CONFIG[pathname as keyof typeof PAGE_HELP_CONFIG] || 
                   PAGE_HELP_CONFIG['/dashboard']; // fallback

    // Get suggested articles
    const suggestedArticles = config.suggestedArticles
      .map(id => helpArticles.find(article => article.id === id))
      .filter(Boolean) as HelpArticle[];

    // Get common issues (FAQs)
    const commonIssues = config.commonIssues
      .map(id => faqDatabase.find(faq => faq.id === id))
      .filter(Boolean) as FAQ[];

    // Convert quick actions to proper format with functions
    const quickActions: QuickAction[] = config.quickActions.map(action => ({
      ...action,
      action: () => {
        // Handle quick actions based on ID
        handleQuickAction(action.id, pathname, contextData);
      }
    }));

    return {
      page: config.page,
      userRole,
      suggestedArticles,
      commonIssues,
      quickActions
    };
  }, [location.pathname, userRole, contextData]);

  const searchHelp = useMemo(() => {
    return (query: string) => {
      const articles = searchArticles(query);
      const faqs = searchFAQs(query);
      return { articles, faqs };
    };
  }, []);

  const getRelatedContent = useMemo(() => {
    return (topic: string) => {
      const articles = searchArticles(topic);
      const faqs = searchFAQs(topic);
      return { articles, faqs };
    };
  }, []);

  return {
    context,
    searchHelp,
    getRelatedContent
  };
}

// Quick action handler
function handleQuickAction(actionId: string, pathname: string, contextData?: Record<string, any>) {
  switch (actionId) {
    case 'start-setup':
      console.log('Starting account setup...');
      // In real app, would navigate to setup wizard
      window.location.href = '/setup';
      break;
      
    case 'view-demo':
      window.location.href = '/demo';
      break;
      
    case 'add-transaction':
      console.log('Adding new transaction...');
      // Would open transaction creation modal/form
      break;
      
    case 'view-insights':
      window.location.href = '/insights';
      break;
      
    case 'generate-report':
      console.log('Generating report...');
      // Would open report generation wizard
      break;
      
    case 'import-data':
      console.log('Starting data import...');
      // Would open file upload dialog
      break;
      
    case 'sync-pos':
      console.log('Starting POS sync...');
      // Would open POS integration setup
      break;
      
    case 'handle-refund':
      console.log('Processing refund...');
      // Would open refund processing form
      break;
      
    case 'monthly-report':
      console.log('Generating monthly report...');
      // Would start monthly report generation
      break;
      
    case 'tax-return':
      console.log('Creating tax return...');
      // Would open tax return wizard
      break;
      
    case 'custom-report':
      console.log('Building custom report...');
      // Would open report builder
      break;
      
    case 'view-recommendations':
      console.log('Loading AI recommendations...');
      // Would highlight insights section
      break;
      
    case 'compliance-check':
      console.log('Running compliance check...');
      // Would start compliance analysis
      break;
      
    case 'trends-analysis':
      console.log('Loading trends analysis...');
      // Would open trends dashboard
      break;
      
    case 'manage-users':
      window.location.href = '/admin/users';
      break;
      
    case 'system-health':
      console.log('Checking system health...');
      // Would open system status page
      break;
      
    case 'audit-logs':
      window.location.href = '/admin/audit';
      break;
      
    default:
      console.log(`Unhandled quick action: ${actionId}`);
  }
}

// Helper hook for getting page-specific tooltips and hints
export function usePageHelp() {
  const location = useLocation();
  
  const getFieldHelp = (fieldName: string): string | null => {
    const pathname = location.pathname;
    
    const fieldHelpMap: Record<string, Record<string, string>> = {
      '/dashboard': {
        'compliance-score': 'Your overall compliance rating based on tax collection accuracy, nexus management, and reporting status.',
        'tax-collected': 'Total sales tax collected across all jurisdictions this period.',
        'transaction-count': 'Number of sales transactions processed this month.',
        'revenue': 'Total sales amount before tax across all locations.'
      },
      '/transactions': {
        'amount': 'The pre-tax sale amount for this transaction.',
        'tax-amount': 'Sales tax calculated and collected for this sale.',
        'location': 'The jurisdiction where the sale took place, affecting tax rates.',
        'exemption': 'Tax exemption status - requires valid exemption certificate.',
        'product-category': 'Product type that may have special tax treatment.'
      },
      '/reports': {
        'date-range': 'Select the reporting period for your tax analysis.',
        'jurisdictions': 'Choose which states/localities to include in the report.',
        'format': 'Export format - PDF for filing, Excel for analysis.',
        'report-type': 'Different report types serve different compliance and analysis needs.'
      },
      '/insights': {
        'confidence-score': 'AI confidence level in this recommendation (higher is more reliable).',
        'impact': 'Estimated business impact - High impacts should be prioritized.',
        'revenue-impact': 'Projected effect on your revenue from implementing this suggestion.',
        'actionable-steps': 'Specific steps you can take to implement this recommendation.'
      }
    };

    return fieldHelpMap[pathname]?.[fieldName] || null;
  };

  return { getFieldHelp };
}

// Hook for tracking help usage and feedback
export function useHelpAnalytics() {
  const trackHelpAction = (action: string, context?: Record<string, any>) => {
    // In a real app, this would send analytics data
    console.log('Help action tracked:', { action, context, timestamp: new Date() });
  };

  const trackArticleView = (articleId: string, helpful?: boolean) => {
    trackHelpAction('article_view', { articleId, helpful });
  };

  const trackFAQView = (faqId: string, helpful?: boolean) => {
    trackHelpAction('faq_view', { faqId, helpful });
  };

  const trackChatInteraction = (messageCount: number, resolved?: boolean) => {
    trackHelpAction('chat_interaction', { messageCount, resolved });
  };

  const trackQuickAction = (actionId: string, context?: string) => {
    trackHelpAction('quick_action', { actionId, context });
  };

  return {
    trackHelpAction,
    trackArticleView,
    trackFAQView,
    trackChatInteraction,
    trackQuickAction
  };
}
