import React, { useState } from 'react';
import { helpContentService } from '@/services/HelpContentService';

export default function FirecrawlTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');

  const testCrawling = async () => {
    setLoading(true);
    setResult('Testing Firecrawl integration...');
    
    try {
      console.log('🔥 Starting Firecrawl test...');
      const articles = await helpContentService.crawlCategoryArticles('getting-started', 2);
      
      console.log('✅ Firecrawl test results:', articles);
      setResult(`Success! Crawled ${articles.length} articles:\n\n${articles.map(a => `• ${a.title}\n  Source: ${a.source}\n  Length: ${a.content.length} chars`).join('\n\n')}`);
    } catch (error) {
      console.error('❌ Firecrawl test failed:', error);
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const configStatus = helpContentService.getConfigurationStatus();

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">🔥 Firecrawl API Test</h2>
      
      <div className="mb-4 p-3 bg-blue-50 rounded">
        <strong>Status:</strong> {configStatus.message}
      </div>
      
      <button
        onClick={testCrawling}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '🔄 Testing...' : '🚀 Test Live Crawling'}
      </button>
      
      {result && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <pre className="whitespace-pre-wrap text-sm">{result}</pre>
        </div>
      )}
    </div>
  );
}