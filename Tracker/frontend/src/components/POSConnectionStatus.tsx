/**
 * POS Connection Status Component
 * Shows the status of connected POS systems with actions
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Settings, 
  Trash2,
  Activity,
  Calendar,
  DollarSign
} from 'lucide-react';

interface POSConnection {
  id: string;
  posType: string;
  posName: string;
  status: 'connected' | 'error' | 'warning' | 'disconnected';
  lastSync: Date;
  locationsCount: number;
  todaysSales: number;
  todaysTax: number;
  errorMessage?: string;
  warningMessage?: string;
  metrics: {
    uptime: number;
    totalTransactions: number;
    averageResponseTime: number;
  };
}

interface POSConnectionStatusProps {
  connections: POSConnection[];
  onRefresh: (connectionId: string) => void;
  onReconfigure: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
  isLoading?: boolean;
}

const getStatusColor = (status: POSConnection['status']) => {
  switch (status) {
    case 'connected':
      return 'text-green-600 bg-green-50';
    case 'warning':
      return 'text-yellow-600 bg-yellow-50';
    case 'error':
    case 'disconnected':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

const getStatusIcon = (status: POSConnection['status']) => {
  switch (status) {
    case 'connected':
      return <CheckCircle className="w-5 h-5" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5" />;
    case 'error':
    case 'disconnected':
      return <XCircle className="w-5 h-5" />;
    default:
      return <XCircle className="w-5 h-5" />;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export const POSConnectionStatus: React.FC<POSConnectionStatusProps> = ({
  connections,
  onRefresh,
  onReconfigure,
  onDisconnect,
  isLoading = false
}) => {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<{[key: string]: string}>({});

  const toggleExpanded = (connectionId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(connectionId)) {
        newSet.delete(connectionId);
      } else {
        newSet.add(connectionId);
      }
      return newSet;
    });
  };

  const handleAction = async (
    connectionId: string, 
    action: 'refresh' | 'reconfigure' | 'disconnect',
    callback: (id: string) => void
  ) => {
    setActionLoading(prev => ({ ...prev, [connectionId]: action }));
    
    try {
      await callback(connectionId);
    } finally {
      setTimeout(() => {
        setActionLoading(prev => {
          const newState = { ...prev };
          delete newState[connectionId];
          return newState;
        });
      }, 1000);
    }
  };

  if (connections.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No POS Connections</h3>
        <p className="text-gray-600 mb-4">
          Connect your first POS system to start tracking sales tax automatically.
        </p>
        <button className="bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-600">
          Add POS Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {connections.map((connection) => (
        <div
          key={connection.id}
          className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
        >
          {/* Header */}
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`p-2 rounded-lg ${getStatusColor(connection.status)}`}>
                  {getStatusIcon(connection.status)}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {connection.posName}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {connection.locationsCount} location{connection.locationsCount !== 1 ? 's' : ''} • 
                    Last sync: {formatRelativeTime(connection.lastSync)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleAction(connection.id, 'refresh', onRefresh)}
                  disabled={actionLoading[connection.id] === 'refresh'}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  title="Refresh connection"
                >
                  <RefreshCw 
                    className={`w-4 h-4 ${
                      actionLoading[connection.id] === 'refresh' ? 'animate-spin' : ''
                    }`} 
                  />
                </button>

                <button
                  onClick={() => handleAction(connection.id, 'reconfigure', onReconfigure)}
                  disabled={!!actionLoading[connection.id]}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  title="Reconfigure"
                >
                  <Settings className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleAction(connection.id, 'disconnect', onDisconnect)}
                  disabled={!!actionLoading[connection.id]}
                  className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
                  title="Disconnect"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => toggleExpanded(connection.id)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <span className="text-sm">
                    {expandedCards.has(connection.id) ? 'Less' : 'More'}
                  </span>
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {connection.errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <XCircle className="w-4 h-4 text-red-600 mr-2" />
                  <span className="text-sm text-red-800">{connection.errorMessage}</span>
                </div>
              </div>
            )}

            {connection.warningMessage && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                  <span className="text-sm text-yellow-800">{connection.warningMessage}</span>
                </div>
              </div>
            )}

            {/* Today's Summary */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <DollarSign className="w-5 h-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Today's Sales</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(connection.todaysSales)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center">
                  <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <p className="text-sm text-gray-600">Today's Tax</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(connection.todaysTax)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedCards.has(connection.id) && (
            <div className="px-6 pb-6 border-t border-gray-200">
              <div className="pt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Connection Metrics</h4>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {connection.metrics.uptime.toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600">Uptime</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {connection.metrics.totalTransactions.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600">Total Transactions</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {connection.metrics.averageResponseTime}ms
                    </p>
                    <p className="text-sm text-gray-600">Avg Response</p>
                  </div>
                </div>

                {/* Action buttons for loading states */}
                {actionLoading[connection.id] && (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center text-sm text-gray-600">
                      <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      {actionLoading[connection.id] === 'refresh' && 'Refreshing connection...'}
                      {actionLoading[connection.id] === 'reconfigure' && 'Opening configuration...'}
                      {actionLoading[connection.id] === 'disconnect' && 'Disconnecting...'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default POSConnectionStatus;
