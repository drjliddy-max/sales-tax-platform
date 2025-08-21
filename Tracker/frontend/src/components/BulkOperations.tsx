import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  Filter,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  Archive,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  ArrowRight,
  MoreHorizontal,
  Calendar,
  DollarSign,
  Tag,
  MapPin,
  Users
} from 'lucide-react';
import { ResponsiveLayout } from './ResponsiveLayout';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  tax: number;
  posSystem: string;
  location: string;
  category: string;
  customer?: string;
  status: 'completed' | 'pending' | 'failed' | 'disputed';
  description: string;
  jurisdiction: string;
}

interface BulkOperationResult {
  success: number;
  failed: number;
  errors: Array<{
    transactionId: string;
    error: string;
  }>;
}

interface FilterOptions {
  dateRange: {
    start: string;
    end: string;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
  posSystem: string[];
  location: string[];
  category: string[];
  status: string[];
  jurisdiction: string[];
}

interface BulkOperationsProps {
  className?: string;
}

export const BulkOperations: React.FC<BulkOperationsProps> = ({
  className = ''
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    amountRange: { min: null, max: null },
    posSystem: [],
    location: [],
    category: [],
    status: [],
    jurisdiction: []
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [operationResult, setOperationResult] = useState<BulkOperationResult | null>(null);

  // Available filter options (would come from API in real app)
  const filterOptions = {
    posSystem: ['Square', 'Clover', 'Toast', 'Shopify'],
    location: ['Main Store', 'Downtown', 'Mall Location', 'Online'],
    category: ['Food & Beverage', 'Retail', 'Services', 'Digital'],
    status: ['completed', 'pending', 'failed', 'disputed'],
    jurisdiction: ['California', 'New York', 'Texas', 'Florida']
  };

  const bulkActions = [
    { value: 'export', label: 'Export Selected', icon: Download },
    { value: 'recalculate', label: 'Recalculate Tax', icon: RefreshCw },
    { value: 'archive', label: 'Archive', icon: Archive },
    { value: 'delete', label: 'Delete', icon: Trash2 },
    { value: 'mark_reviewed', label: 'Mark as Reviewed', icon: CheckCircle },
    { value: 'dispute', label: 'Flag as Disputed', icon: AlertTriangle }
  ];

  useEffect(() => {
    loadTransactions();
  }, [filters, searchQuery]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        ...filters.dateRange,
        search: searchQuery,
        posSystem: filters.posSystem.join(','),
        location: filters.location.join(','),
        category: filters.category.join(','),
        status: filters.status.join(','),
        jurisdiction: filters.jurisdiction.join(','),
        minAmount: filters.amountRange.min?.toString() || '',
        maxAmount: filters.amountRange.max?.toString() || ''
      });

      const response = await fetch(`/api/transactions/bulk?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTransaction = (transactionId: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(transactions.map(t => t.id)));
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedTransactions.size === 0) return;

    setIsProcessing(true);
    setOperationResult(null);

    try {
      const response = await fetch('/api/transactions/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        },
        body: JSON.stringify({
          action,
          transactionIds: Array.from(selectedTransactions)
        })
      });

      if (response.ok) {
        const result = await response.json();
        setOperationResult(result);
        
        // Reload transactions if the operation modified them
        if (['delete', 'archive', 'recalculate'].includes(action)) {
          await loadTransactions();
          setSelectedTransactions(new Set());
        }
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf' | 'excel') => {
    const transactionIds = selectedTransactions.size > 0 
      ? Array.from(selectedTransactions)
      : transactions.map(t => t.id);

    try {
      const response = await fetch('/api/transactions/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('clerk-db-jwt')}`
        },
        body: JSON.stringify({
          transactionIds,
          format,
          filters
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transactions-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'disputed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        transaction.description.toLowerCase().includes(query) ||
        transaction.customer?.toLowerCase().includes(query) ||
        transaction.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout
      title="Bulk Operations"
      subtitle="Manage multiple transactions with bulk actions and advanced filtering"
      className={className}
    >
      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by description, customer, or transaction ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-4 py-2 border rounded-lg ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-300 text-gray-700'
            }`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {Object.values(filters).some(f => Array.isArray(f) ? f.length > 0 : f.min !== null || f.max !== null) && (
              <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full"></span>
            )}
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <select
              onChange={(e) => e.target.value && handleExport(e.target.value as 'csv' | 'pdf' | 'excel')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
              defaultValue=""
            >
              <option value="" disabled>Export As...</option>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Range</label>
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="Min amount"
                    value={filters.amountRange.min || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      amountRange: { ...prev.amountRange, min: e.target.value ? parseFloat(e.target.value) : null }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max amount"
                    value={filters.amountRange.max || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      amountRange: { ...prev.amountRange, max: e.target.value ? parseFloat(e.target.value) : null }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>

              {/* POS System Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">POS System</label>
                <select
                  multiple
                  value={filters.posSystem}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    posSystem: Array.from(e.target.selectedOptions, option => option.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  size={3}
                >
                  {filterOptions.posSystem.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  multiple
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    status: Array.from(e.target.selectedOptions, option => option.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                  size={3}
                >
                  {filterOptions.status.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex justify-end">
              <button
                onClick={() => setFilters({
                  dateRange: {
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    end: new Date().toISOString().split('T')[0]
                  },
                  amountRange: { min: null, max: null },
                  posSystem: [],
                  location: [],
                  category: [],
                  status: [],
                  jurisdiction: []
                })}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedTransactions.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm font-medium text-blue-900">
                {selectedTransactions.size} transaction{selectedTransactions.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center space-x-2">
              {bulkActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.value}
                    onClick={() => handleBulkAction(action.value)}
                    disabled={isProcessing}
                    className="flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-white border border-blue-200 rounded hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Operation Result */}
      {operationResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-green-900">
                Operation completed successfully
              </p>
              <p className="text-sm text-green-700">
                {operationResult.success} successful, {operationResult.failed} failed
              </p>
            </div>
            <button
              onClick={() => setOperationResult(null)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={handleSelectAll}
                className="mr-4 text-gray-400 hover:text-gray-600"
              >
                {selectedTransactions.size === transactions.length ? (
                  <CheckSquare className="w-5 h-5" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
              <h3 className="text-lg font-semibold text-gray-900">
                Transactions ({filteredTransactions.length})
              </h3>
            </div>
            <button
              onClick={loadTransactions}
              disabled={isLoading}
              className="flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  POS System
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className={`hover:bg-gray-50 ${selectedTransactions.has(transaction.id) ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleSelectTransaction(transaction.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {selectedTransactions.has(transaction.id) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {transaction.description}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {transaction.id.substring(0, 8)}...
                      </div>
                      {transaction.customer && (
                        <div className="text-sm text-gray-500">
                          Customer: {transaction.customer}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(transaction.tax)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {transaction.posSystem}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your filters or search query
              </p>
            </div>
          )}
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default BulkOperations;
