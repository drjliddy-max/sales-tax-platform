/**
 * Manual Credentials Input Component
 * Handles API key and manual credential input for POS systems
 */

import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, AlertCircle, CheckCircle, ExternalLink, Loader } from 'lucide-react';

interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email';
  required: boolean;
  placeholder: string;
  helpText?: string;
  validation?: RegExp;
}

interface POSCredentialConfig {
  posType: string;
  posName: string;
  fields: CredentialField[];
  instructions: string[];
  documentationUrl?: string;
  testEndpoint?: string;
}

// POS configurations are now loaded dynamically from the backend

interface ManualCredentialsProps {
  posType: string;
  onSubmit: (credentials: { [key: string]: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export const ManualCredentials: React.FC<ManualCredentialsProps> = ({
  posType,
  onSubmit,
  onCancel,
  isLoading = false,
  error
}) => {
  const [config, setConfig] = useState<POSCredentialConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  
  // Load POS configuration dynamically
  useEffect(() => {
    loadPOSConfiguration();
  }, [posType]);
  
  const loadPOSConfiguration = async () => {
    setConfigLoading(true);
    try {
      const response = await fetch(`/api/pos/plugins/${posType}/config`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const pluginData = await response.json();
        setConfig({
          posType: pluginData.id,
          posName: pluginData.name,
          fields: pluginData.fields,
          instructions: pluginData.instructions,
          documentationUrl: pluginData.documentationUrl,
          testEndpoint: pluginData.connectionTest?.endpoint
        });
      } else {
        setConfig(null);
      }
    } catch (error) {
      console.error('Failed to load POS configuration:', error);
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  };
  const [credentials, setCredentials] = useState<{ [key: string]: string }>({});
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (configLoading) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Configuration</h2>
        <p className="text-gray-600">
          Loading POS system configuration...
        </p>
      </div>
    );
  }
  
  if (!config) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Configuration Not Found</h2>
        <p className="text-gray-600 mb-6">
          Could not load configuration for POS type "{posType}". This POS system may not be supported or there may be a connectivity issue.
        </p>
        <div className="flex justify-center space-x-4">
          <button
            onClick={loadPOSConfiguration}
            className="bg-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-600"
          >
            Retry
          </button>
          <button
            onClick={onCancel}
            className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleInputChange = (fieldName: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear field error when user starts typing
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => ({
        ...prev,
        [fieldName]: ''
      }));
    }

    // Clear connection test result
    if (connectionTestResult) {
      setConnectionTestResult(null);
    }
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const validateFields = (): boolean => {
    const errors: { [key: string]: string } = {};
    let isValid = true;

    config.fields.forEach(field => {
      const value = credentials[field.name] || '';

      if (field.required && !value.trim()) {
        errors[field.name] = `${field.label} is required`;
        isValid = false;
      } else if (value && field.validation && !field.validation.test(value)) {
        errors[field.name] = `${field.label} format is invalid`;
        isValid = false;
      }
    });

    setFieldErrors(errors);
    return isValid;
  };

  const handleTestConnection = async () => {
    if (!validateFields()) {
      return;
    }

    setIsTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const response = await fetch('/api/pos/onboarding/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          posType,
          credentials
        })
      });

      const result = await response.json();
      setConnectionTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Connection successful!' : 'Connection failed')
      });
    } catch (error) {
      setConnectionTestResult({
        success: false,
        message: 'Failed to test connection'
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateFields()) {
      return;
    }

    onSubmit(credentials);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Key className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Connect to {config.posName}
        </h2>
        <p className="text-gray-600">
          Enter your {config.posName} API credentials to enable automatic sales tax tracking.
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-blue-900 mb-3">Setup Instructions:</h3>
        <ol className="text-sm text-blue-800 space-y-2">
          {config.instructions.map((instruction, index) => (
            <li key={index} className="flex items-start">
              <span className="font-semibold mr-2">{index + 1}.</span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
        {config.documentationUrl && (
          <div className="mt-4">
            <a
              href={config.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center text-sm"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              View Official Documentation
            </a>
          </div>
        )}
      </div>

      {/* Credential Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {config.fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            <div className="relative">
              <input
                type={
                  field.type === 'password' && !showPasswords[field.name]
                    ? 'password'
                    : 'text'
                }
                value={credentials[field.name] || ''}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors[field.name] ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isLoading}
              />

              {field.type === 'password' && (
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility(field.name)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPasswords[field.name] ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {fieldErrors[field.name] && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {fieldErrors[field.name]}
              </p>
            )}

            {field.helpText && !fieldErrors[field.name] && (
              <p className="text-sm text-gray-500">{field.helpText}</p>
            )}
          </div>
        ))}

        {/* Connection Test Result */}
        {connectionTestResult && (
          <div
            className={`p-4 rounded-lg flex items-center ${
              connectionTestResult.success
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {connectionTestResult.success ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            <span>{connectionTestResult.message}</span>
          </div>
        )}

        {/* Global Error */}
        {error && (
          <div className="p-4 bg-red-50 text-red-800 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            disabled={isLoading || isTestingConnection}
          >
            Cancel
          </button>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isLoading || isTestingConnection}
              className="px-6 py-2 border border-blue-500 text-blue-500 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50"
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </button>

            <button
              type="submit"
              disabled={isLoading || isTestingConnection}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ManualCredentials;
