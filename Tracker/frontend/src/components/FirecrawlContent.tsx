import React, { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { firecrawlService } from '@/services/FirecrawlService';

interface CrawledContent {
  url: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface FirecrawlContentProps {
  contentType: 'tax-rates' | 'filing-requirements' | 'pos-systems' | 'help-articles';
  title: string;
  description: string;
}

export default function FirecrawlContent({ contentType, title, description }: FirecrawlContentProps) {
  const [content, setContent] = useState<CrawledContent[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load cached content on component mount
    loadCachedContent();
  }, [contentType]);

  const loadCachedContent = () => {
    const cacheKey = `firecrawl-${contentType}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsedData = JSON.parse(cached);
        setContent(parsedData.content || []);
        setLastUpdated(new Date(parsedData.timestamp));
      } catch (err) {
        console.error('Failed to parse cached content:', err);
      }
    }
  };

  const saveCachedContent = (newContent: CrawledContent[]) => {
    const cacheKey = `firecrawl-${contentType}`;
    const cacheData = {
      content: newContent,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  };

  const crawlContent = async () => {
    const status = firecrawlService.getConfigurationStatus();
    if (!status.configured) {
      setError(status.message);
    }

    setLoading(true);
    setError(null);

    try {
      let newContent: CrawledContent[] = [];

      switch (contentType) {
        case 'tax-rates':
          const taxRates = await firecrawlService.crawlTaxRates();
          newContent = taxRates.map(rate => ({
            url: rate.source,
            title: `${rate.jurisdiction} Tax Rate`,
            content: `Current rate: ${rate.rate}% (Effective: ${rate.effectiveDate})`,
            timestamp: rate.lastUpdated,
          }));
          break;

        case 'filing-requirements':
          const filingReqs = await firecrawlService.crawlFilingRequirements();
          newContent = filingReqs.map(req => ({
            url: req.source,
            title: `${req.state} Filing Requirements`,
            content: `Frequency: ${req.frequency}\nDeadline: ${req.deadline}\nRequirements: ${req.requirements.join(', ')}`,
            timestamp: req.lastUpdated,
          }));
          break;

        case 'pos-systems':
          const posInfo = await firecrawlService.crawlPOSSystemInfo();
          newContent = posInfo.map(pos => ({
            url: pos.source,
            title: pos.name,
            content: `${pos.description}\nIntegration: ${pos.integrationMethod}\nFeatures: ${pos.features.join(', ')}`,
            timestamp: pos.lastUpdated,
          }));
          break;

        case 'help-articles':
          newContent = await firecrawlService.crawlHelpArticles();
          break;

        default:
          throw new Error('Invalid content type');
      }

      setContent(newContent);
      setLastUpdated(new Date());
      saveCachedContent(newContent);

    } catch (err: any) {
      setError(err.message || 'Failed to crawl content');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(timestamp);
  };

  const truncateContent = (content: string, maxLength: number = 300) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        
        <button
          onClick={crawlContent}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Crawling...' : 'Update Content'}</span>
        </button>
      </div>

      {/* Status */}
      <div className="mb-4">
        {error && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {lastUpdated && !error && (
          <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-green-700">
              Last updated: {formatTimestamp(lastUpdated)}
            </span>
          </div>
        )}

        {!firecrawlService.getConfigurationStatus().configured && (
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-3">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-yellow-700">
              {firecrawlService.getConfigurationStatus().message}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {content.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No content available. Click "Update Content" to crawl the latest information.</p>
          </div>
        ) : (
          content.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900">{item.title}</h4>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(item.timestamp)}</span>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-3 whitespace-pre-line">
                {truncateContent(item.content)}
              </div>
              
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  <span>View Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ))
        )}
      </div>

      {/* Demo Notice */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Firecrawl v2 Integration Demo</h4>
        <p className="text-sm text-blue-700 mb-3">
          This component demonstrates dynamic content crawling capabilities. The system can:
        </p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Automatically crawl the latest tax rates from government websites</li>
          <li>• Update filing requirements and deadlines in real-time</li>
          <li>• Discover new POS systems and integration methods</li>
          <li>• Collect help articles and guides from industry sources</li>
          <li>• Cache content locally for improved performance</li>
          <li>• Provide structured data extraction from web sources</li>
        </ul>
        <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-800">
          <strong>Status:</strong> {firecrawlService.getConfigurationStatus().message}
        </div>
      </div>
    </div>
  );
}