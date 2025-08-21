import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, RefreshCw, Globe } from 'lucide-react';
import Layout from '@/components/Layout';
import FirecrawlContent from '@/components/FirecrawlContent';

export default function ContentCrawler() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-4 mb-2">
              <Link
                to="/help"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Help</span>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Dynamic Content Crawler</h1>
            <p className="text-gray-600 mt-2">
              Real-time crawling of sales tax information using Firecrawl v2
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              <Globe className="w-4 h-4" />
              <span>Firecrawl v2</span>
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 mb-3">
            Automated Content Collection
          </h2>
          <p className="text-blue-700 mb-4">
            This demonstration shows how Firecrawl v2 can automatically gather and update sales tax information 
            from official government websites, POS system documentation, and industry resources.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Tax Rates</span>
              </div>
              <p className="text-xs text-blue-700">Live government data</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Search className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Filing Info</span>
              </div>
              <p className="text-xs text-blue-700">Requirements & deadlines</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">POS Systems</span>
              </div>
              <p className="text-xs text-blue-700">Integration guides</p>
            </div>
            <div className="bg-white p-3 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-900">Help Articles</span>
              </div>
              <p className="text-xs text-blue-700">Industry resources</p>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Tax Rates */}
          <FirecrawlContent
            contentType="tax-rates"
            title="Sales Tax Rates"
            description="Current tax rates crawled from state revenue department websites"
          />

          {/* Filing Requirements */}
          <FirecrawlContent
            contentType="filing-requirements"
            title="Filing Requirements"
            description="Up-to-date filing schedules and requirements from government sources"
          />

          {/* POS Systems */}
          <FirecrawlContent
            contentType="pos-systems"
            title="POS Integration Information"
            description="Latest API documentation and integration guides from POS providers"
          />

          {/* Help Articles */}
          <FirecrawlContent
            contentType="help-articles"
            title="Industry Help Articles"
            description="Sales tax guides and best practices from industry experts"
          />
        </div>

        {/* Integration Guide */}
        <div className="mt-12 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Firecrawl v2 Integration</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Features Demonstrated</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• URL scraping with content extraction</li>
                <li>• Batch crawling for multiple sources</li>
                <li>• Content parsing and structuring</li>
                <li>• Local caching for performance</li>
                <li>• Error handling and retry logic</li>
                <li>• Metadata extraction and tagging</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Benefits for Sales Tax Platform</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Always up-to-date tax rate information</li>
                <li>• Automated compliance requirement tracking</li>
                <li>• Dynamic POS system integration guides</li>
                <li>• Fresh help content and best practices</li>
                <li>• Reduced manual content maintenance</li>
                <li>• Enhanced user experience with current data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}