/**
 * POS Discovery Component
 * Shows popular POS systems, categories, and allows client contributions
 */

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Star, 
  Users, 
  TrendingUp, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  Filter,
  Grid,
  List,
  Clock
} from 'lucide-react';

interface POSSystem {
  id: string;
  name: string;
  description: string;
  category: string;
  marketShare: 'high' | 'medium' | 'low';
  logo?: string;
  website?: string;
  pricing: 'free' | 'paid' | 'freemium' | 'enterprise';
  verified: boolean;
  status: 'active' | 'deprecated' | 'beta';
  clientsUsing: number;
  activeConnections: number;
  clientContributed?: boolean;
  contributedBy?: string;
  lastUpdated?: Date;
}

interface POSDiscoveryProps {
  onSelectPOS: (posId: string) => void;
  onContributeNew: () => void;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'popular' | 'restaurant' | 'retail' | 'enterprise' | 'mobile' | 'specialty' | 'client-contributed';

export const POSDiscovery: React.FC<POSDiscoveryProps> = ({ onSelectPOS, onContributeNew }) => {
  const [posSystems, setPOSSystems] = useState<{ [category: string]: POSSystem[] }>({});
  const [searchResults, setSearchResults] = useState<POSSystem[]>([]);
  const [recentSystems, setRecentSystems] = useState<POSSystem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showContributeForm, setShowContributeForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPOSSystems();
    loadRecentSystems();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      searchPOS();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const loadPOSSystems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/pos/registry/categories');
      
      if (response.ok) {
        const data = await response.json();
        setPOSSystems(data.categories);
      } else {
        setError('Failed to load POS systems');
      }
    } catch (error) {
      setError('Network error while loading POS systems');
      console.error('Error loading POS systems:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentSystems = async () => {
    try {
      const response = await fetch('/api/pos/registry/recent?limit=5');
      
      if (response.ok) {
        const data = await response.json();
        setRecentSystems(data.systems);
      }
    } catch (error) {
      console.error('Error loading recent systems:', error);
    }
  };

  const searchPOS = async () => {
    try {
      const response = await fetch(`/api/pos/registry/search?q=${encodeURIComponent(searchQuery)}`);
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Error searching POS systems:', error);
    }
  };

  const getDisplayedSystems = (): POSSystem[] => {
    if (searchQuery && searchResults.length > 0) {
      return searchResults;
    }

    if (activeFilter === 'all') {
      return Object.values(posSystems).flat();
    }

    if (activeFilter === 'client-contributed') {
      return Object.values(posSystems).flat().filter(pos => pos.clientContributed);
    }

    return posSystems[activeFilter] || [];
  };

  const getMarketShareColor = (marketShare: string) => {
    switch (marketShare) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getPricingBadgeColor = (pricing: string) => {
    switch (pricing) {
      case 'free': return 'bg-green-100 text-green-800';
      case 'freemium': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderPOSCard = (pos: POSSystem) => (
    <div
      key={pos.id}
      className={`bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all cursor-pointer ${
        viewMode === 'list' ? 'p-4' : 'p-6'
      }`}
      onClick={() => onSelectPOS(pos.id)}
    >
      <div className={`flex ${viewMode === 'list' ? 'items-center space-x-4' : 'flex-col'}`}>
        {/* Logo/Icon */}
        <div className={`${viewMode === 'list' ? 'w-12 h-12' : 'w-16 h-16 mx-auto mb-4'} bg-gray-100 rounded-lg flex items-center justify-center`}>
          {pos.logo ? (
            <img src={pos.logo} alt={pos.name} className="w-full h-full object-contain rounded-lg" />
          ) : (
            <div className="text-2xl font-bold text-gray-400">
              {pos.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 ${viewMode === 'grid' ? 'text-center' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-semibold text-gray-900 ${viewMode === 'grid' ? 'text-lg' : 'text-base'}`}>
              {pos.name}
            </h3>
            
            {/* Status badges */}
            <div className="flex items-center space-x-1">
              {pos.verified && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {pos.status === 'beta' && (
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
              )}
              {pos.clientContributed && (
                <Star className="w-4 h-4 text-blue-500" />
              )}
            </div>
          </div>

          <p className={`text-gray-600 mb-3 ${viewMode === 'list' ? 'text-sm' : ''}`}>
            {pos.description}
          </p>

          {/* Stats and badges */}
          <div className={`flex ${viewMode === 'grid' ? 'flex-col space-y-2' : 'items-center justify-between'}`}>
            <div className={`flex ${viewMode === 'grid' ? 'justify-center' : ''} items-center space-x-3 text-sm text-gray-500`}>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                <span>{pos.clientsUsing} clients</span>
              </div>
              {viewMode === 'list' && (
                <div className="flex items-center">
                  <TrendingUp className={`w-4 h-4 mr-1 ${getMarketShareColor(pos.marketShare)}`} />
                  <span className="capitalize">{pos.marketShare} usage</span>
                </div>
              )}
            </div>

            <div className={`flex ${viewMode === 'grid' ? 'justify-center' : ''} items-center space-x-2`}>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPricingBadgeColor(pos.pricing)}`}>
                {pos.pricing.charAt(0).toUpperCase() + pos.pricing.slice(1)}
              </span>
              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium capitalize">
                {pos.category}
              </span>
            </div>
          </div>

          {/* Website link */}
          {pos.website && (
            <div className={`mt-3 ${viewMode === 'grid' ? 'text-center' : ''}`}>
              <a
                href={pos.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Learn more
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderFilterButtons = () => (
    <div className="flex flex-wrap gap-2 mb-6">
      {[
        { key: 'all', label: 'All Systems', count: Object.values(posSystems).flat().length },
        { key: 'popular', label: 'Popular', count: posSystems.popular?.length || 0 },
        { key: 'restaurant', label: 'Restaurant', count: posSystems.restaurant?.length || 0 },
        { key: 'retail', label: 'Retail', count: posSystems.retail?.length || 0 },
        { key: 'enterprise', label: 'Enterprise', count: posSystems.enterprise?.length || 0 },
        { key: 'mobile', label: 'Mobile', count: posSystems.mobile?.length || 0 },
        { key: 'specialty', label: 'Specialty', count: posSystems.specialty?.length || 0 },
        { key: 'client-contributed', label: 'Client Added', count: Object.values(posSystems).flat().filter(p => p.clientContributed).length }
      ].map(filter => (
        <button
          key={filter.key}
          onClick={() => setActiveFilter(filter.key as FilterType)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeFilter === filter.key
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {filter.label} ({filter.count})
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading POS systems...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Choose Your POS System</h1>
        <p className="text-gray-600 text-lg">
          Connect to your point-of-sale system for automated sales tax tracking
        </p>
      </div>

      {/* Search and Controls */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search POS systems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* View controls */}
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={onContributeNew}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-600 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New POS
            </button>
          </div>
        </div>

        {/* Filters */}
        {renderFilterButtons()}
      </div>

      {/* Recently Added */}
      {!searchQuery && recentSystems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Clock className="w-5 h-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Recently Added</h2>
          </div>
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {recentSystems.map((pos) => (
              <div
                key={pos.id}
                className="flex-shrink-0 w-64 bg-white rounded-lg border p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => onSelectPOS(pos.id)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    {pos.logo ? (
                      <img src={pos.logo} alt={pos.name} className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <div className="font-bold text-gray-400">{pos.name.charAt(0)}</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 text-sm">{pos.name}</h3>
                    <p className="text-xs text-gray-600 truncate">{pos.description}</p>
                  </div>
                  {pos.clientContributed && (
                    <Star className="w-4 h-4 text-blue-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* POS Systems Grid */}
      <div className="mb-8">
        {searchQuery && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Search Results for "{searchQuery}" ({searchResults.length})
            </h2>
          </div>
        )}

        <div className={viewMode === 'grid' 
          ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
        }>
          {getDisplayedSystems().map(renderPOSCard)}
        </div>

        {getDisplayedSystems().length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No POS systems found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery 
                ? `No systems match "${searchQuery}". Try a different search term.`
                : `No systems found in the ${activeFilter} category.`
              }
            </p>
            <button
              onClick={onContributeNew}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-600"
            >
              Add your POS system
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSDiscovery;
