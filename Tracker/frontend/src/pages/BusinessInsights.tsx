import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import Layout from '@/components/Layout';
import { Insight } from '@/types';

export default function BusinessInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBusinessInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // REAL DATA ONLY POLICY: This component requires actual business insights
      // Fetch real insights from API based on user's actual business data
      const response = await fetch('/api/insights', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch insights');
      }
      
      setInsights(data.data || []);
      
    } catch (err: any) {
      setError(`Error fetching insights: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch real business insights on component mount
    fetchBusinessInsights();
  }, []);

  const getImpactColors = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Business Insights</h1>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Real Data
              </span>
              <Link
                to="/"
                className="btn-secondary"
              >
                Back to Home
              </Link>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-brand-blue-600 mr-3" />
                <span className="text-lg text-gray-600">Analyzing your business data...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-md p-6">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-red-800 mb-2">Error</h3>
                  <p className="text-sm text-red-700 mb-4">{error}</p>
                  <button
                    onClick={fetchBusinessInsights}
                    className="inline-flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Insights */}
          {!loading && !error && insights.length > 0 && (
            <div className="space-y-6">
              {insights.map((insight, index) => (
                <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900">{insight.title}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getImpactColors(insight.impact)}`}>
                        {insight.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-4">{insight.insight}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">Est. Value: </span>
                        <span className="text-green-600">
                          ${((insight.estimated_revenue_impact || insight.estimated_savings || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">Confidence: </span>
                        <span className="text-brand-blue-600">
                          {Math.round((insight.confidence_score || 0.5) * 100)}%
                        </span>
                      </div>
                    </div>

                    {insight.actionable_steps && insight.actionable_steps.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Action Steps:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {insight.actionable_steps.map((step, stepIndex) => (
                            <li key={stepIndex}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Call to Action */}
              <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-brand-blue-900 mb-2">
                  Ready to get insights for your business?
                </h3>
                <p className="text-brand-blue-700 mb-4">
                  Connect your POS system and get AI-powered insights tailored to your business data.
                </p>
                <button className="btn-primary">
                  Start Free Trial
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && insights.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No insights available at the moment.</p>
              <button
                onClick={fetchBusinessInsights}
                className="btn-primary"
              >
                Generate Insights
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
