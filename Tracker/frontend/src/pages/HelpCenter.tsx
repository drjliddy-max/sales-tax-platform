import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, BookOpen, MessageCircle, Star, ThumbsUp, ThumbsDown, ExternalLink, Clock, Users, Tag, Mail, RefreshCw, Globe, AlertCircle, Home, BarChart3 } from 'lucide-react';
import { helpCategories, helpArticles as staticHelpArticles, faqDatabase, searchArticles as staticSearchArticles, searchFAQs, getPopularArticles, getTopFAQs } from '@/data/helpContent';
import { HelpArticle, FAQ, HelpCategory } from '@/types';
import AIChat from '@/components/help/AIChat';
import ContactForm from '@/components/help/ContactForm';
import { useHelpContent } from '@/hooks/useHelpContent';

// Icon mapping for dynamic category icons
const IconMap: Record<string, React.ComponentType<any>> = {
  Rocket: () => <div className="w-5 h-5 bg-current rounded" />,
  Receipt: () => <div className="w-5 h-5 bg-current rounded" />,
  Calculator: () => <div className="w-5 h-5 bg-current rounded" />,
  BarChart3: () => <div className="w-5 h-5 bg-current rounded" />,
  Link: () => <div className="w-5 h-5 bg-current rounded" />,
  AlertCircle: () => <div className="w-5 h-5 bg-current rounded" />,
  Settings: () => <div className="w-5 h-5 bg-current rounded" />,
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'beginner': return 'bg-green-100 text-green-800';
    case 'intermediate': return 'bg-yellow-100 text-yellow-800';
    case 'advanced': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryColor = (color: string) => {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    orange: 'text-orange-600 bg-orange-50',
    cyan: 'text-cyan-600 bg-cyan-50',
    red: 'text-red-600 bg-red-50',
    gray: 'text-gray-600 bg-gray-50',
  };
  return colorMap[color as keyof typeof colorMap] || 'text-gray-600 bg-gray-50';
};

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [activeTab, setActiveTab] = useState<'articles' | 'faq' | 'popular'>('articles');
  const [showChat, setShowChat] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [popularResults, setPopularResults] = useState<HelpArticle[]>([]);
  
  // Use the help content hook for live article fetching
  const { 
    articles: liveArticles, 
    loading, 
    error, 
    lastUpdated, 
    refreshArticles, 
    searchArticles, 
    getTrendingArticles, 
    isConfigured, 
    configStatus 
  } = useHelpContent();

  // Load trending articles on component mount
  useEffect(() => {
    const loadTrending = async () => {
      try {
        const trending = await getTrendingArticles(10);
        setPopularResults(trending);
      } catch (err) {
        console.error('Failed to load trending articles:', err);
      }
    };
    loadTrending();
  }, [getTrendingArticles]);

  // Handle live search
  useEffect(() => {
    const handleLiveSearch = async () => {
      if (searchQuery.trim()) {
        try {
          const results = await searchArticles(searchQuery, selectedCategory || undefined);
          setSearchResults(results);
        } catch (err) {
          console.error('Failed to search articles:', err);
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(handleLiveSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedCategory, searchArticles]);

  // Combine static and live articles
  const allArticles = useMemo(() => {
    return [...staticHelpArticles, ...liveArticles];
  }, [liveArticles]);

  const filteredArticles = useMemo(() => {
    if (searchQuery.trim()) {
      // Use live search when available, fall back to static search
      return searchResults.length > 0 ? searchResults : staticSearchArticles(searchQuery, selectedCategory || undefined);
    }
    return selectedCategory 
      ? allArticles.filter(article => article.category.id === selectedCategory)
      : allArticles;
  }, [searchQuery, selectedCategory, allArticles, searchResults]);

  const filteredFAQs = useMemo(() => {
    if (searchQuery.trim()) {
      return searchFAQs(searchQuery, selectedCategory || undefined);
    }
    return selectedCategory
      ? faqDatabase.filter(faq => faq.category.id === selectedCategory)
      : getTopFAQs(15);
  }, [searchQuery, selectedCategory]);

  const popularArticles = useMemo(() => {
    // Use live trending articles if available, fall back to static popular articles
    return popularResults.length > 0 ? popularResults : getPopularArticles(10);
  }, [popularResults]);

  const handleArticleClick = (article: HelpArticle) => {
    setSelectedArticle(article);
    // In a real app, you'd increment the view count here
  };

  const handleBackToList = () => {
    setSelectedArticle(null);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedArticle(null);
    // Load fresh articles for this category
    refreshArticles(categoryId, 3);
  };

  const handleRefreshContent = async () => {
    if (selectedCategory) {
      await refreshArticles(selectedCategory, 5);
    } else {
      // Refresh trending articles
      const trending = await getTrendingArticles(10);
      setPopularResults(trending);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is handled by the useMemo hooks
  };

  // AI Chat context
  const chatContext = {
    page: selectedArticle ? 'help-article' : 'help-center',
    additionalInfo: selectedArticle ? { articleId: selectedArticle.id } : undefined
  };

  if (selectedArticle) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Top Navigation Bar - Article View */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <BookOpen className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Help Center</h2>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600 truncate max-w-md">{selectedArticle.title}</span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBackToList}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200"
                >
                  ← Back to Help Center
                </button>
                <Link
                  to="/"
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all duration-200"
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </Link>
                <Link
                  to="/insights"
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg transition-all duration-200"
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto py-8 px-4">
          {/* Article Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={handleBackToList}
                className="text-blue-600 hover:text-blue-700 inline-flex items-center text-sm"
              >
                ← Back to Help Center
              </button>
              <div className="flex items-center space-x-3">
                <Link
                  to="/"
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Home className="w-3 h-3" />
                  <span>Home</span>
                </Link>
                <Link
                  to="/insights"
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>Dashboard</span>
                </Link>
              </div>
            </div>
            
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedArticle.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(selectedArticle.category.color)}`}>
                    {selectedArticle.category.name}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(selectedArticle.difficulty)}`}>
                    {selectedArticle.difficulty}
                  </span>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>Updated {selectedArticle.lastUpdated}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{selectedArticle.views.toLocaleString()} views</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Article Tags */}
            <div className="flex items-center space-x-2 mb-4">
              <Tag className="w-4 h-4 text-gray-500" />
              {selectedArticle.tags.map((tag, index) => (
                <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Article Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="prose max-w-none">
              <div className="whitespace-pre-wrap">{selectedArticle.content}</div>
            </div>
          </div>

          {/* Article Feedback */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Was this article helpful?</h3>
            <div className="flex items-center space-x-4 mb-4">
              <button className="flex items-center space-x-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">
                <ThumbsUp className="w-4 h-4" />
                <span>Yes ({selectedArticle.helpful})</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
                <ThumbsDown className="w-4 h-4" />
                <span>No ({selectedArticle.notHelpful})</span>
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Your feedback helps us improve our documentation. For immediate assistance, try our AI chat or contact support.
            </p>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Help Center</h2>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to="/"
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all duration-200"
              >
                <Home className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>
              <Link
                to="/insights"
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-lg transition-all duration-200"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-6xl mx-auto py-12 px-4">
          {/* Navigation buttons */}
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <Link
                to="/"
                className="flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all duration-200"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <Link
                to="/insights"
                className="flex items-center space-x-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all duration-200"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
            </div>
          </div>

          <div className="text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-90" />
            <h1 className="text-4xl font-bold mb-4">Help Center</h1>
            <p className="text-xl text-blue-100 mb-8">
              Find answers, learn features, and get help with Sales Tax Insights
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for help articles, FAQs, or topics..."
                  className="w-full pl-12 pr-4 py-4 rounded-lg border border-transparent focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent text-gray-900 text-lg"
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Categories */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Browse by Category</h2>
            <div className="flex items-center space-x-3">
              {/* Status indicator */}
              <div className="flex items-center space-x-2 text-sm">
                <Globe className="w-4 h-4 text-blue-600" />
                <span className={`px-2 py-1 rounded-full text-xs ${isConfigured ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {isConfigured ? 'Live Articles' : 'Mock Data'}
                </span>
                {lastUpdated && (
                  <span className="text-gray-500 text-xs">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
              
              {/* Refresh button */}
              <button
                onClick={handleRefreshContent}
                disabled={loading}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              
              {/* Test Firecrawl API button */}
              <button
                onClick={() => window.open('/test-firecrawl', '_blank')}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-200 rounded-lg hover:bg-green-50"
              >
                <Globe className="w-3 h-3" />
                <span>Test API</span>
              </button>
              
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory('')}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Show All Categories
                </button>
              )}
            </div>
          </div>
          
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            </div>
          )}
          
          {/* Configuration status */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-700">
              <strong>Firecrawl Integration:</strong> {configStatus}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {helpCategories.map((category) => {
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategorySelect(category.id)}
                  className={`p-4 rounded-lg border border-gray-200 text-left hover:shadow-md transition-all ${
                    isSelected 
                      ? `${getCategoryColor(category.color)} border-current shadow-md` 
                      : 'bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg mb-3 flex items-center justify-center ${getCategoryColor(category.color)}`}>
                    <div className="w-5 h-5 bg-current rounded" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('articles')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'articles'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Help Articles ({filteredArticles.length})
              </button>
              <button
                onClick={() => setActiveTab('faq')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'faq'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                FAQ ({filteredFAQs.length})
              </button>
              <button
                onClick={() => setActiveTab('popular')}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'popular'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Popular Articles
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'articles' && (
              <div className="space-y-4">
                {filteredArticles.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No articles found</h3>
                    <p className="text-gray-600">Try adjusting your search or browse by category.</p>
                  </div>
                ) : (
                  filteredArticles.map((article) => (
                    <div key={article.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <button
                            onClick={() => handleArticleClick(article)}
                            className="text-left hover:text-blue-600 transition-colors"
                          >
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{article.title}</h3>
                          </button>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(article.category.color)}`}>
                              {article.category.name}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(article.difficulty)}`}>
                              {article.difficulty}
                            </span>
                            <div className="flex items-center space-x-1">
                              <Users className="w-4 h-4" />
                              <span>{article.views.toLocaleString()} views</span>
                            </div>
                          </div>
                          <p className="text-gray-600 text-sm line-clamp-2">
                            {article.content.substring(0, 150).replace(/\n/g, ' ')}...
                          </p>
                        </div>
                        <ExternalLink className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'faq' && (
              <div className="space-y-4">
                {filteredFAQs.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No FAQs found</h3>
                    <p className="text-gray-600">Try adjusting your search or browse by category.</p>
                  </div>
                ) : (
                  filteredFAQs.map((faq) => (
                    <div key={faq.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{faq.question}</h3>
                      <p className="text-gray-700 mb-3">{faq.answer}</p>
                      <div className="flex items-center space-x-3 text-sm text-gray-600">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(faq.category.color)}`}>
                          {faq.category.name}
                        </span>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <span>Priority {faq.priority}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'popular' && (
              <div className="space-y-4">
                {popularArticles.map((article, index) => (
                  <div key={article.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                    <div className="flex items-start space-x-4">
                      <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <button
                          onClick={() => handleArticleClick(article)}
                          className="text-left hover:text-blue-600 transition-colors"
                        >
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{article.title}</h3>
                        </button>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(article.category.color)}`}>
                            {article.category.name}
                          </span>
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{article.views.toLocaleString()} views</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <ThumbsUp className="w-4 h-4 text-green-500" />
                            <span>{article.helpful} helpful</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <MessageCircle className="w-6 h-6 text-blue-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Still need help?</h3>
              <p className="text-gray-700 mb-4">
                Can't find what you're looking for? Our support team and AI assistant are here to help.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowChat(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat with AI Assistant</span>
                </button>
                <button
                  onClick={() => setShowContactForm(true)}
                  className="px-4 py-2 bg-white text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center space-x-2"
                >
                  <Mail className="w-4 h-4" />
                  <span>Contact Support</span>
                </button>
                <a
                  href="mailto:info@salestaxbot.com"
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Email Direct
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat */}
      <AIChat 
        isOpen={showChat} 
        onClose={() => setShowChat(false)} 
        context={chatContext} 
      />
      
      {/* Contact Form */}
      <ContactForm 
        isOpen={showContactForm} 
        onClose={() => setShowContactForm(false)} 
        context={{ page: 'help-center' }}
      />
      
      {/* Floating Help Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-4 right-4 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
