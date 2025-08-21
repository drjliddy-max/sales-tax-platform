import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, HelpCircle, BookOpen, X, ExternalLink, Lightbulb, Search, Mail } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import AIChat from './AIChat';
import ContactForm from './ContactForm';
import { getTopFAQs, searchFAQs, helpCategories } from '@/data/helpContent';
import { FAQ } from '@/types';

interface HelpWidgetProps {
  context?: {
    page?: string;
    userRole?: string;
    additionalInfo?: Record<string, any>;
  };
}

const getPageContext = (pathname: string) => {
  if (pathname.includes('/dashboard')) return 'dashboard';
  if (pathname.includes('/transactions')) return 'transactions';
  if (pathname.includes('/reports')) return 'reports';
  if (pathname.includes('/insights')) return 'insights';
  if (pathname.includes('/admin')) return 'admin';
  return 'general';
};

const getContextualSuggestions = (page: string): { title: string; description: string; action: string }[] => {
  const suggestions = {
    dashboard: [
      { title: 'Understanding Your Dashboard', description: 'Learn what each metric means', action: 'article' },
      { title: 'How to read compliance scores?', description: 'Quick FAQ about compliance indicators', action: 'faq' },
      { title: 'Customize dashboard view', description: 'Personalize your dashboard layout', action: 'chat' }
    ],
    transactions: [
      { title: 'Managing Transactions', description: 'Learn to import and organize sales data', action: 'article' },
      { title: 'How do I handle refunds?', description: 'Processing returns and adjustments', action: 'faq' },
      { title: 'Transaction troubleshooting', description: 'Resolve sync and import issues', action: 'chat' }
    ],
    reports: [
      { title: 'Generating Reports', description: 'Create tax returns and summaries', action: 'article' },
      { title: 'Can I schedule reports?', description: 'Setting up automated reporting', action: 'faq' },
      { title: 'Custom report formats', description: 'Create reports for specific needs', action: 'chat' }
    ],
    insights: [
      { title: 'Business Insights Guide', description: 'Understanding AI recommendations', action: 'article' },
      { title: 'How accurate are insights?', description: 'Learn about our AI analysis', action: 'faq' },
      { title: 'Implementing suggestions', description: 'Get help acting on recommendations', action: 'chat' }
    ],
    admin: [
      { title: 'Admin Features Overview', description: 'Managing users and system settings', action: 'article' },
      { title: 'How do I add new users?', description: 'User management best practices', action: 'faq' },
      { title: 'System configuration help', description: 'Get help with admin settings', action: 'chat' }
    ],
    general: [
      { title: 'Getting Started Guide', description: 'Complete setup walkthrough', action: 'article' },
      { title: 'What POS systems work?', description: 'Integration compatibility info', action: 'faq' },
      { title: 'General platform help', description: 'Ask about any feature', action: 'chat' }
    ]
  };

  return suggestions[page as keyof typeof suggestions] || suggestions.general;
};

export default function HelpWidget({ context }: HelpWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'help' | 'faq' | 'search'>('help');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FAQ[]>([]);
  const location = useLocation();
  
  const widgetRef = useRef<HTMLDivElement>(null);
  const page = getPageContext(location.pathname);
  const suggestions = getContextualSuggestions(page);
  const topFAQs = getTopFAQs(5);

  // Close widget when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Search FAQs
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchFAQs(searchQuery).slice(0, 5);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSuggestionClick = (action: string, title: string) => {
    if (action === 'chat') {
      setShowChat(true);
      setIsOpen(false);
    } else if (action === 'article') {
      // In a real app, you'd navigate to the specific article
      window.open('/help', '_blank');
      setIsOpen(false);
    } else if (action === 'faq') {
      setActiveTab('faq');
    }
  };

  const handleFAQClick = (faq: FAQ) => {
    // In a real app, you might show the FAQ in a modal or navigate to it
    alert(`${faq.question}\n\n${faq.answer}`);
  };

  if (showChat) {
    return (
      <AIChat 
        isOpen={showChat} 
        onClose={() => setShowChat(false)} 
        context={{ 
          page, 
          userRole: context?.userRole,
          ...context?.additionalInfo 
        }} 
      />
    );
  }

  return (
    <>
      {/* Contact Form */}
      <ContactForm 
        isOpen={showContactForm} 
        onClose={() => setShowContactForm(false)} 
        context={{ 
          page, 
          userRole: context?.userRole,
          ...context?.additionalInfo 
        }}
      />
      
      {/* Help Widget */}
      <div ref={widgetRef} className="fixed bottom-4 right-4 z-50">
        {isOpen && (
          <div className="mb-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-blue-50 border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Quick Help</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-4 mt-3">
                <button
                  onClick={() => setActiveTab('help')}
                  className={`text-sm font-medium ${
                    activeTab === 'help' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Suggestions
                </button>
                <button
                  onClick={() => setActiveTab('faq')}
                  className={`text-sm font-medium ${
                    activeTab === 'faq' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  FAQ
                </button>
                <button
                  onClick={() => setActiveTab('search')}
                  className={`text-sm font-medium ${
                    activeTab === 'search' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Search
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'help' && (
                <div className="p-4 space-y-3">
                  <div className="text-xs text-gray-600 uppercase font-medium">
                    For {page.charAt(0).toUpperCase() + page.slice(1)} Page
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion.action, suggestion.title)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-6 h-6 flex-shrink-0 mt-0.5">
                          {suggestion.action === 'article' && <BookOpen className="w-5 h-5 text-blue-600" />}
                          {suggestion.action === 'faq' && <HelpCircle className="w-5 h-5 text-green-600" />}
                          {suggestion.action === 'chat' && <MessageCircle className="w-5 h-5 text-purple-600" />}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-gray-900">{suggestion.title}</h4>
                          <p className="text-xs text-gray-600 mt-1">{suggestion.description}</p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'faq' && (
                <div className="p-4 space-y-3">
                  <div className="text-xs text-gray-600 uppercase font-medium">
                    Frequently Asked
                  </div>
                  {topFAQs.map((faq) => (
                    <button
                      key={faq.id}
                      onClick={() => handleFAQClick(faq)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start space-x-3">
                        <HelpCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-sm text-gray-900">{faq.question}</h4>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {faq.answer.substring(0, 80)}...
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'search' && (
                <div className="p-4">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search help topics..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  
                  {searchQuery.trim() && (
                    <div className="space-y-2">
                      {searchResults.length === 0 ? (
                        <p className="text-sm text-gray-600 text-center py-4">
                          No results found. Try different keywords.
                        </p>
                      ) : (
                        searchResults.map((result) => (
                          <button
                            key={result.id}
                            onClick={() => handleFAQClick(result)}
                            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <h4 className="font-medium text-sm text-gray-900">{result.question}</h4>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {result.answer.substring(0, 60)}...
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setShowChat(true);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat with AI Assistant</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setShowContactForm(true);
                      setIsOpen(false);
                    }}
                    className="px-3 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Contact</span>
                  </button>
                  <button
                    onClick={() => {
                      window.open('/help', '_blank');
                      setIsOpen(false);
                    }}
                    className="px-3 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Help</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Floating Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-12 h-12 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center ${
            isOpen 
              ? 'bg-gray-600 text-white rotate-45' 
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-110'
          }`}
        >
          {isOpen ? <X className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
        </button>

        {/* Help badge for new users */}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
            ?
          </div>
        )}
      </div>
    </>
  );
}
