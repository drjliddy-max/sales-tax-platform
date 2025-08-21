/**
 * POS Onboarding Component
 * Complete onboarding flow for connecting POS systems with OAuth integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, CheckCircle, AlertCircle, Loader, ArrowRight, ExternalLink, RefreshCw, X } from 'lucide-react';

interface POSSystem {
  id: string;
  name: string;
  description: string;
  authMethod: 'oauth' | 'api_key';
  features: string[];
  marketFocus: string;
  logo?: string;
}

interface OnboardingProgress {
  step: number;
  totalSteps: number;
  currentStep: string;
  completedSteps: string[];
}

interface OnboardingSession {
  sessionId: string;
  status: 'initiated' | 'authenticating' | 'configuring' | 'testing' | 'completed' | 'failed';
  progress: OnboardingProgress;
  error?: string;
}

interface LocationInfo {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

interface OnboardingResult {
  success: boolean;
  sessionId?: string;
  status: 'initiated' | 'authenticating' | 'configuring' | 'testing' | 'completed' | 'failed';
  progress: OnboardingProgress;
  configuration?: any;
  locations?: LocationInfo[];
  sampleData?: any[];
  nextAction?: {
    type: 'oauth_redirect' | 'manual_credentials' | 'complete';
    url?: string;
    data?: any;
  };
  error?: string;
}

export const POSOnboardingFlow: React.FC = () => {
  const [step, setStep] = useState<'selection' | 'authentication' | 'progress' | 'completed' | 'error'>('selection');
  const [selectedPOS, setSelectedPOS] = useState<POSSystem | null>(null);
  const [supportedPOS, setSupportedPOS] = useState<POSSystem[]>([]);
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationInfo[]>([]);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Real-time progress tracking
  const [realTimeProgress, setRealTimeProgress] = useState<{
    currentStep: string;
    description: string;
    completed: boolean;
  }>({ currentStep: '', description: '', completed: false });

  // Load supported POS systems on mount
  useEffect(() => {
    loadSupportedPOS();
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const shop = urlParams.get('shop');
    
    if (code && state) {
      handleOAuthCallback(code, state, shop);
    }
  }, []);

  const loadSupportedPOS = async () => {
    try {
      const response = await fetch('/api/pos/onboarding/supported', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSupportedPOS(data.supportedPOS);
      }
    } catch (error) {
      console.error('Failed to load supported POS systems:', error);
    }
  };

  const startOnboarding = async (posType?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pos/onboarding/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ posType })
      });

      const result: OnboardingResult = await response.json();

      if (result.success) {
        setSession({
          sessionId: result.sessionId!,
          status: result.status,
          progress: result.progress,
          error: result.error
        });

        // Start real-time progress tracking
        if (result.sessionId) {
          setupEventSource(result.sessionId);
        }

        if (result.nextAction?.type === 'oauth_redirect') {
          setStep('authentication');
        } else {
          setStep('progress');
          continueOnboarding(result.sessionId!);
        }
      } else {
        setError(result.error || 'Failed to start onboarding');
      }
    } catch (error) {
      setError('Failed to start onboarding process');
      console.error('Onboarding error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const continueOnboarding = async (sessionId: string, data?: any) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/pos/onboarding/continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ sessionId, ...data })
      });

      const result: OnboardingResult = await response.json();
      
      setSession(prev => prev ? {
        ...prev,
        status: result.status,
        progress: result.progress,
        error: result.error
      } : null);

      if (result.success && result.status === 'completed') {
        setStep('completed');
        setLocations(result.locations || []);
        setSampleData(result.sampleData || []);
        
        // Clean up event source
        if (eventSource) {
          eventSource.close();
          setEventSource(null);
        }
      } else if (!result.success) {
        setStep('error');
        setError(result.error || 'Onboarding failed');
      }
    } catch (error) {
      setError('Failed to continue onboarding');
      console.error('Continue onboarding error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupEventSource = (sessionId: string) => {
    const token = localStorage.getItem('token');
    const url = `/api/pos/onboarding/events/${sessionId}${token ? `?token=${token}` : ''}`;
    const es = new EventSource(url);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('SSE event:', data);
    };

    es.addEventListener('step_started', (event) => {
      const data = JSON.parse(event.data);
      setRealTimeProgress({
        currentStep: data.step,
        description: data.description,
        completed: false
      });
    });

    es.addEventListener('step_completed', (event) => {
      const data = JSON.parse(event.data);
      setRealTimeProgress(prev => ({
        ...prev,
        completed: true
      }));
    });

    es.addEventListener('step_failed', (event) => {
      const data = JSON.parse(event.data);
      setError(`Step failed: ${data.error}`);
      setStep('error');
    });

    es.addEventListener('completed', (event) => {
      const data = JSON.parse(event.data);
      setStep('completed');
      es.close();
    });

    es.onerror = (error) => {
      console.error('EventSource error:', error);
    };

    setEventSource(es);
  };

  const handleOAuthCallback = async (code: string, state: string, shop?: string | null) => {
    if (!session) {
      setError('No active onboarding session');
      return;
    }

    const data: any = { oauthCode: code, oauthState: state };
    if (shop) {
      data.shopDomain = shop;
    }

    await continueOnboarding(session.sessionId, data);
  };

  const handleOAuthStart = async () => {
    if (!session || !selectedPOS) return;

    try {
      let requestData: any = {
        sessionId: session.sessionId,
        posType: selectedPOS.id
      };

      // For Shopify, we need the shop domain
      if (selectedPOS.id === 'shopify') {
        const shopDomain = prompt('Please enter your Shopify shop domain (e.g., mystore.myshopify.com):');
        if (!shopDomain) return;
        requestData.shopDomain = shopDomain;
      }

      const response = await fetch('/api/pos/onboarding/oauth/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      
      if (result.success) {
        // Redirect to OAuth URL
        window.location.href = result.oauthUrl;
      } else {
        setError('Failed to generate OAuth URL');
      }
    } catch (error) {
      setError('Failed to start OAuth flow');
      console.error('OAuth start error:', error);
    }
  };

  const handleManualCredentials = (credentials: any) => {
    if (!session) return;
    continueOnboarding(session.sessionId, { 
      posType: selectedPOS?.id, 
      credentials 
    });
  };

  const handleRetry = () => {
    setStep('selection');
    setError(null);
    setSession(null);
    setSelectedPOS(null);
    
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
  };

  const renderPOSSelection = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Connect Your POS System</h2>
        <p className="text-gray-600 text-lg">
          Choose your point-of-sale system to start tracking sales tax automatically
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {supportedPOS.map((pos) => (
          <div
            key={pos.id}
            className={`border-2 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${
              selectedPOS?.id === pos.id 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedPOS(pos)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{pos.name}</h3>
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                {/* POS logo would go here */}
                <Shield className="w-6 h-6 text-gray-600" />
              </div>
            </div>
            
            <p className="text-gray-600 mb-4">{pos.description}</p>
            <p className="text-sm font-medium text-gray-700 mb-2">Market Focus: {pos.marketFocus}</p>
            
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Key Features:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {pos.features.slice(0, 3).map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Auth: {pos.authMethod.toUpperCase()}
              </span>
              {selectedPOS?.id === pos.id && (
                <CheckCircle className="w-5 h-5 text-blue-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedPOS && (
        <div className="mt-8 text-center">
          <button
            onClick={() => startOnboarding(selectedPOS.id)}
            disabled={isLoading}
            className="bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
          >
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-5 h-5 mr-2" />
            )}
            Connect {selectedPOS.name}
          </button>
        </div>
      )}
    </div>
  );

  const renderAuthentication = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Authenticate with {selectedPOS?.name}
        </h2>
        <p className="text-gray-600">
          You'll be redirected to {selectedPOS?.name} to authorize our application to access your sales data.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-3">What we'll access:</h3>
        <ul className="text-sm text-gray-600 space-y-2 text-left">
          <li className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            Sales transactions and order data
          </li>
          <li className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            Tax calculation details
          </li>
          <li className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            Store location information
          </li>
          <li className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            Real-time transaction updates (webhooks)
          </li>
        </ul>
      </div>

      <button
        onClick={handleOAuthStart}
        disabled={isLoading}
        className="bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 flex items-center mx-auto"
      >
        {isLoading ? (
          <Loader className="w-5 h-5 animate-spin mr-2" />
        ) : (
          <ExternalLink className="w-5 h-5 mr-2" />
        )}
        Authorize Access
      </button>
    </div>
  );

  const renderProgress = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Setting up your integration</h2>
        <p className="text-gray-600">
          We're configuring your {selectedPOS?.name} integration. This may take a few moments.
        </p>
      </div>

      {session && (
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-700">
              Progress: {session.progress.step} of {session.progress.totalSteps}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round((session.progress.step / session.progress.totalSteps) * 100)}%
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{
                width: `${(session.progress.step / session.progress.totalSteps) * 100}%`
              }}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              {realTimeProgress.completed ? (
                <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
              ) : (
                <Loader className="w-5 h-5 text-blue-500 animate-spin mr-3" />
              )}
              <div>
                <p className="font-medium text-gray-900">{realTimeProgress.currentStep || session.progress.currentStep}</p>
                <p className="text-sm text-gray-600">{realTimeProgress.description}</p>
              </div>
            </div>

            {session.progress.completedSteps.map((step, index) => (
              <div key={index} className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                <span className="text-gray-700 capitalize">{step.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCompleted = () => (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Integration Complete!</h2>
        <p className="text-gray-600">
          Your {selectedPOS?.name} is now connected and ready to track sales tax automatically.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Connected Locations</h3>
          {locations.length > 0 ? (
            <div className="space-y-3">
              {locations.slice(0, 3).map((location) => (
                <div key={location.id} className="flex items-start">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900">{location.name}</p>
                    <p className="text-sm text-gray-600">
                      {location.address.city}, {location.address.state}
                    </p>
                  </div>
                </div>
              ))}
              {locations.length > 3 && (
                <p className="text-sm text-gray-500">
                  And {locations.length - 3} more locations...
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No locations found</p>
          )}
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Transactions</h3>
          {sampleData.length > 0 ? (
            <div className="space-y-3">
              {sampleData.slice(0, 3).map((transaction, index) => (
                <div key={index} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-900">
                      ${transaction.totalAmount?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-sm text-gray-600">
                      Tax: ${transaction.totalTax?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {sampleData.length === 0 && (
                <p className="text-gray-500">No recent transactions</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No transaction data available</p>
          )}
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-600"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  const renderError = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Failed</h2>
      <p className="text-gray-600 mb-6">
        {error || 'Something went wrong while setting up your POS integration.'}
      </p>
      
      <div className="flex justify-center space-x-4">
        <button
          onClick={handleRetry}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-600 flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 flex items-center"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {step === 'selection' && renderPOSSelection()}
        {step === 'authentication' && renderAuthentication()}
        {step === 'progress' && renderProgress()}
        {step === 'completed' && renderCompleted()}
        {step === 'error' && renderError()}
      </div>
    </div>
  );
};

export default POSOnboardingFlow;
