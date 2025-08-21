// Example implementation for POS Integration in React TypeScript
// This demonstrates how the automated configuration would work in your frontend

import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertCircle, Loader } from 'lucide-react';

// Types based on our research
export type POSSystemType = 'shopify' | 'square' | 'clover' | 'toast' | 'lightspeed' | 'paypal_here' | 'ncr';

export interface POSSystem {
  id: POSSystemType;
  name: string;
  description: string;
  logo: string;
  complexity: 'low' | 'medium' | 'high';
  marketFocus: string;
  features: string[];
  authMethod: 'oauth' | 'api_key' | 'custom';
}

export interface POSConfiguration {
  posType: POSSystemType;
  isConnected: boolean;
  lastSync?: Date;
  credentials?: {
    encrypted: boolean;
    hasCredentials: boolean;
  };
  webhooksConfigured: boolean;
  taxDataAvailable: boolean;
}

const POS_SYSTEMS: POSSystem[] = [
  {
    id: 'shopify',
    name: 'Shopify POS',
    description: 'Leading e-commerce and retail platform',
    logo: '/logos/shopify.svg',
    complexity: 'medium',
    marketFocus: 'E-commerce + Retail',
    features: ['Advanced Tax Calculation', 'Multi-jurisdiction', 'Real-time Webhooks', 'Tax Exemptions'],
    authMethod: 'oauth'
  },
  {
    id: 'square',
    name: 'Square POS',
    description: 'Popular small business solution',
    logo: '/logos/square.svg',
    complexity: 'low',
    marketFocus: 'Small-Medium Business',
    features: ['Good Tax Support', 'Simple Integration', 'Real-time Updates', 'Free Tier'],
    authMethod: 'oauth'
  },
  {
    id: 'clover',
    name: 'Clover POS',
    description: 'Comprehensive merchant services',
    logo: '/logos/clover.svg',
    complexity: 'medium',
    marketFocus: 'SMB + Restaurant',
    features: ['Detailed Tax Data', 'Hardware Integration', 'Merchant Services', 'Restaurant Features'],
    authMethod: 'oauth'
  },
  {
    id: 'toast',
    name: 'Toast POS',
    description: 'Restaurant-focused system',
    logo: '/logos/toast.svg',
    complexity: 'high',
    marketFocus: 'Restaurants Only',
    features: ['Restaurant-specific Tax', 'Alcohol Tax Handling', 'Delivery Tax', 'Order Management'],
    authMethod: 'oauth'
  }
];

const POSIntegrationComponent: React.FC = () => {
  const [selectedPOS, setSelectedPOS] = useState<POSSystemType | null>(null);
  const [configurations, setConfigurations] = useState<Record<POSSystemType, POSConfiguration>>({} as Record<POSSystemType, POSConfiguration>);
  const [isDetecting, setIsDetecting] = useState(false);
  const [setupStep, setSetupStep] = useState<'select' | 'credentials' | 'detecting' | 'configuring' | 'complete'>('select');

  // Load existing configurations
  useEffect(() => {
    loadExistingConfigurations();
  }, []);

  const loadExistingConfigurations = async () => {
    try {
      const response = await fetch('/api/pos/configurations');
      const configs = await response.json();
      setConfigurations(configs);
    } catch (error) {
      console.error('Failed to load POS configurations:', error);
    }
  };

  const handlePOSSelection = (posType: POSSystemType) => {
    setSelectedPOS(posType);
    setSetupStep('credentials');
  };

  const handleAutoDetect = async (credentials: any) => {
    setIsDetecting(true);
    setSetupStep('detecting');
    
    try {
      const response = await fetch('/api/pos/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      
      if (response.ok) {
        const { posType, configuration } = await response.json();
        setSelectedPOS(posType);
        await configureAutomatically(posType, configuration);
      } else {
        throw new Error('POS detection failed');
      }
    } catch (error) {
      console.error('Auto-detection failed:', error);
      // Fallback to manual configuration
      setSetupStep('credentials');
    } finally {
      setIsDetecting(false);
    }
  };

  const configureAutomatically = async (posType: POSSystemType, config: any) => {
    setSetupStep('configuring');
    
    try {
      // Step 1: Save credentials securely
      await fetch('/api/pos/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posType, credentials: config.credentials })
      });

      // Step 2: Setup webhooks automatically
      await fetch('/api/pos/webhooks/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posType })
      });

      // Step 3: Test data access
      const testResponse = await fetch(`/api/pos/test-connection/${posType}`);
      if (!testResponse.ok) throw new Error('Connection test failed');

      // Step 4: Update configuration
      setConfigurations(prev => ({
        ...prev,
        [posType]: {
          posType,
          isConnected: true,
          lastSync: new Date(),
          credentials: { encrypted: true, hasCredentials: true },
          webhooksConfigured: true,
          taxDataAvailable: true
        }
      }));

      setSetupStep('complete');
    } catch (error) {
      console.error('Auto-configuration failed:', error);
      // Handle error appropriately
    }
  };

  const ComplexityBadge: React.FC<{ complexity: string }> = ({ complexity }) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[complexity as keyof typeof colors]}`}>
        {complexity.toUpperCase()}
      </span>
    );
  };

  const ConnectionStatus: React.FC<{ config?: POSConfiguration }> = ({ config }) => {
    if (!config) return null;
    
    return (
      <div className="flex items-center space-x-2">
        {config.isConnected ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-500" />
        )}
        <span className={`text-sm ${config.isConnected ? 'text-green-700' : 'text-red-700'}`}>
          {config.isConnected ? 'Connected' : 'Not Connected'}
        </span>
      </div>
    );
  };

  if (setupStep === 'detecting') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Detecting POS System</h3>
        <p className="text-gray-600 text-center">
          We're analyzing your credentials to automatically identify and configure your POS system...
        </p>
      </div>
    );
  }

  if (setupStep === 'configuring') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Configuring Integration</h3>
        <p className="text-gray-600 text-center">
          Setting up webhooks, testing connections, and configuring tax data mapping...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">POS System Integration</h1>
        <p className="text-gray-600">
          Connect your Point of Sale system to automatically track sales tax data. 
          Our system will automatically configure itself for your specific POS platform.
        </p>
      </div>

      {setupStep === 'complete' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-green-900">Integration Complete!</h3>
              <p className="text-green-700">
                Your {POS_SYSTEMS.find(p => p.id === selectedPOS)?.name} is now connected and 
                automatically tracking sales tax data.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {POS_SYSTEMS.map((pos) => {
          const config = configurations[pos.id];
          
          return (
            <div
              key={pos.id}
              className={`bg-white rounded-lg shadow-md border-2 transition-all cursor-pointer hover:shadow-lg ${
                selectedPOS === pos.id ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handlePOSSelection(pos.id)}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <img src={pos.logo} alt={pos.name} className="w-12 h-12" />
                  <ComplexityBadge complexity={pos.complexity} />
                </div>
                
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{pos.name}</h3>
                <p className="text-gray-600 text-sm mb-3">{pos.description}</p>
                
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Market Focus:</p>
                  <p className="text-sm text-gray-600">{pos.marketFocus}</p>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Key Features:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {pos.features.slice(0, 3).map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="w-3 h-3 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="border-t pt-4">
                  <ConnectionStatus config={config} />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500">
                      Auth: {pos.authMethod.toUpperCase()}
                    </span>
                    {config?.isConnected ? (
                      <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                        Manage
                      </button>
                    ) : (
                      <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <div className="bg-gray-50 rounded-lg p-6">
          <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Automatic Configuration</h3>
          <p className="text-gray-600 mb-4">
            Our system automatically detects your POS type, configures data mapping, 
            sets up webhooks, and ensures secure data transmission - all without manual setup.
          </p>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">1</div>
              <span>Detect POS</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">2</div>
              <span>Configure Data</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">3</div>
              <span>Setup Webhooks</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mb-2">4</div>
              <span>Start Tracking</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSIntegrationComponent;
