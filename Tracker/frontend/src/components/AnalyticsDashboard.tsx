import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  FileText,
  Download,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  LineChart,
  MapPin,
  Users,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  Bar,
  Cell,
  Pie,
  Area,
  AreaChart
} from 'recharts';
import { ResponsiveLayout } from './ResponsiveLayout';

interface AnalyticsData {
  overview: {
    totalRevenue: number;
    totalTax: number;
    transactionCount: number;
    averageOrderValue: number;
    taxRate: number;
    complianceScore: number;
  };
  trends: {
    revenue: Array<{ date: string; amount: number; tax: number }>;
    taxByJurisdiction: Array<{ jurisdiction: string; amount: number; percentage: number }>;
    transactionsByCategory: Array<{ category: string; count: number; amount: number }>;
    monthlyComparison: Array<{ month: string; currentYear: number; previousYear: number }>;
  };
  locations: Array<{
    id: string;
    name: string;
    revenue: number;
    tax: number;
    transactions: number;
    complianceStatus: 'compliant' | 'warning' | 'non_compliant';
  }>;
  insights: Array<{
    id: string;
    type: 'opportunity' | 'warning' | 'info';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    actionable: boolean;
  }>;
}

interface DateRange {
  start: Date;
  end: Date;
  preset: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
}

interface AnalyticsDashboardProps {
  className?: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  className = '' 
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)),
    end: new Date(),
    preset: 'month'
  });
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'locations' | 'insights'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const datePresets = [
    { key: 'today', label: 'Today', days: 0 },
    { key: 'week', label: 'Last 7 days', days: 7 },
    { key: 'month', label: 'Last 30 days', days: 30 },
    { key: 'quarter', label: 'Last 90 days', days: 90 },
    { key: 'year', label: 'Last year', days: 365 }
  ];

  useEffect(() => {
    loadAnalyticsData();
  }, [dateRange]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString()
      });

      const response = await fetch(`/api/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        }
      });

      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatePresetChange = (preset: string) => {
    const presetData = datePresets.find(p => p.key === preset);
    if (presetData) {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - presetData.days);
      
      setDateRange({
        start,
        end,
        preset: preset as DateRange['preset']
      });
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        format
      });

      const response = await fetch(`/api/analytics/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${dateRange.start.toISOString().split('T')[0]}-to-${dateRange.end.toISOString().split('T')[0]}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'non_compliant': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'info': return <CheckCircle className="w-5 h-5 text-blue-600" />;
      default: return <CheckCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout
      title="Analytics Dashboard"
      subtitle="Comprehensive insights into your sales tax data and compliance"
      className={className}
      headerActions={
        <div className="flex flex-col sm:flex-row gap-4 mt-4 lg:mt-0">
          {/* Date Range Selector */}
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={dateRange.preset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {datePresets.map(preset => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </button>
            
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </button>
          </div>
        </div>
      }
    >
      {/* View Toggle */}
      <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'trends', label: 'Trends', icon: LineChart },
          { key: 'locations', label: 'Locations', icon: MapPin },
          { key: 'insights', label: 'Insights', icon: TrendingUp }
        ].map(view => {
          const Icon = view.icon;
          return (
            <button
              key={view.key}
              onClick={() => setSelectedView(view.key as typeof selectedView)}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === view.key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {view.label}
            </button>
          );
        })}
      </div>

      {data && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(data.overview.totalRevenue)}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-sm text-green-600 font-medium">+12.5%</span>
                <span className="text-sm text-gray-500 ml-2">vs last period</span>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tax Collected</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(data.overview.totalTax)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <FileText className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm font-medium text-gray-900">
                  {formatPercentage(data.overview.taxRate)} avg rate
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Transactions</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {data.overview.transactionCount.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <ShoppingCart className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(data.overview.averageOrderValue)} AOV
                </span>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {Math.round(data.overview.complianceScore * 100)}%
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <CheckCircle className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                {data.overview.complianceScore >= 0.9 ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                    <span className="text-sm text-green-600 font-medium">Excellent</span>
                  </>
                ) : data.overview.complianceScore >= 0.7 ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-yellow-600 mr-1" />
                    <span className="text-sm text-yellow-600 font-medium">Good</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-600 mr-1" />
                    <span className="text-sm text-red-600 font-medium">Needs Attention</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Based on Selected View */}
          {selectedView === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.trends.revenue}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), '']} />
                    <Area type="monotone" dataKey="amount" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="tax" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Tax by Jurisdiction */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax by Jurisdiction</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={data.trends.taxByJurisdiction}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="amount"
                      label={({ jurisdiction, percentage }) => `${jurisdiction} (${formatPercentage(percentage)})`}
                    >
                      {data.trends.taxByJurisdiction.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Tax Amount']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {selectedView === 'trends' && (
            <div className="space-y-6">
              {/* Monthly Comparison */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Year-over-Year Comparison</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsBarChart data={data.trends.monthlyComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), '']} />
                    <Legend />
                    <Bar dataKey="currentYear" fill="#3B82F6" name="Current Year" />
                    <Bar dataKey="previousYear" fill="#94A3B8" name="Previous Year" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>

              {/* Transactions by Category */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Transactions by Category</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsBarChart data={data.trends.transactionsByCategory} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="category" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10B981" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                  
                  <div className="space-y-4">
                    {data.trends.transactionsByCategory.map((category, index) => (
                      <div key={category.category} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{category.category}</p>
                          <p className="text-sm text-gray-600">{category.count} transactions</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">{formatCurrency(category.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedView === 'locations' && (
            <div className="bg-white rounded-lg border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Location Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tax Collected
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transactions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Compliance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.locations.map((location) => (
                      <tr key={location.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{location.name}</div>
                              <div className="text-sm text-gray-500">ID: {location.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(location.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(location.tax)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {location.transactions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getComplianceStatusColor(location.complianceStatus)}`}>
                            {location.complianceStatus === 'compliant' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {location.complianceStatus === 'warning' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {location.complianceStatus === 'non_compliant' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {location.complianceStatus.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedView === 'insights' && (
            <div className="space-y-6">
              {data.insights.map((insight) => (
                <div key={insight.id} className="bg-white rounded-lg border p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-4">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{insight.title}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                          insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {insight.impact.toUpperCase()} IMPACT
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4">{insight.description}</p>
                      {insight.actionable && (
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          Take Action →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ResponsiveLayout>
  );
};

export default AnalyticsDashboard;
