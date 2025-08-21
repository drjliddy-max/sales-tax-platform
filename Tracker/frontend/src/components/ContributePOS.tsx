/**
 * Contribute POS Component
 * Allows clients to contribute new POS systems to the registry
 */

import React, { useState } from 'react';
import { 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  Upload,
  X,
  Info
} from 'lucide-react';

interface ContributePOSProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface POSContributionForm {
  id: string;
  name: string;
  description: string;
  category: 'restaurant' | 'retail' | 'enterprise' | 'mobile' | 'specialty';
  website: string;
  logo: string;
  supportedRegions: string[];
  pricing: 'free' | 'paid' | 'freemium' | 'enterprise';
  authMethod: 'oauth' | 'api_key' | 'basic_auth';
  apiDocumentation: string;
  webhookSupport: boolean;
  multiLocation: boolean;
  taxDetailsSupport: boolean;
  contactEmail: string;
  additionalNotes: string;
}

const REGIONS = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'GLOBAL', name: 'Global/Worldwide' }
];

export const ContributePOS: React.FC<ContributePOSProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState<POSContributionForm>({
    id: '',
    name: '',
    description: '',
    category: 'specialty',
    website: '',
    logo: '',
    supportedRegions: [],
    pricing: 'paid',
    authMethod: 'api_key',
    apiDocumentation: '',
    webhookSupport: false,
    multiLocation: false,
    taxDetailsSupport: true,
    contactEmail: '',
    additionalNotes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const handleInputChange = (field: keyof POSContributionForm, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleRegionToggle = (regionCode: string) => {
    const currentRegions = formData.supportedRegions;
    if (currentRegions.includes(regionCode)) {
      handleInputChange('supportedRegions', currentRegions.filter(r => r !== regionCode));
    } else {
      handleInputChange('supportedRegions', [...currentRegions, regionCode]);
    }
  };

  const generateIdFromName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'POS system name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.website.trim()) {
      newErrors.website = 'Website URL is required';
    } else if (!isValidUrl(formData.website)) {
      newErrors.website = 'Please enter a valid URL';
    }

    if (formData.supportedRegions.length === 0) {
      newErrors.supportedRegions = 'Please select at least one supported region';
    }

    if (!formData.contactEmail.trim()) {
      newErrors.contactEmail = 'Contact email is required';
    } else if (!isValidEmail(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }

    if (formData.apiDocumentation && !isValidUrl(formData.apiDocumentation)) {
      newErrors.apiDocumentation = 'Please enter a valid documentation URL';
    }

    if (formData.logo && !isValidUrl(formData.logo)) {
      newErrors.logo = 'Please enter a valid logo URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Auto-generate ID if not provided
      const posId = formData.id.trim() || generateIdFromName(formData.name);

      const contributionData = {
        id: posId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        website: formData.website.trim(),
        logo: formData.logo.trim() || undefined,
        supportedRegions: formData.supportedRegions,
        pricing: formData.pricing,
        configuration: {
          authMethod: formData.authMethod,
          apiDocumentation: formData.apiDocumentation.trim(),
          webhookSupport: formData.webhookSupport,
          multiLocation: formData.multiLocation,
          taxDetailsSupport: formData.taxDetailsSupport,
          contactEmail: formData.contactEmail.trim(),
          additionalNotes: formData.additionalNotes.trim()
        }
      };

      const response = await fetch('/api/pos/registry/contribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(contributionData)
      });

      const result = await response.json();

      if (result.success) {
        setSubmitStatus('success');
        setSubmitMessage('Thank you for contributing! Your POS system has been submitted and will be reviewed by our team.');
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        setSubmitStatus('error');
        setSubmitMessage(result.error || 'Failed to submit POS system');
      }
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage('Network error. Please try again.');
      console.error('Error contributing POS system:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contribute a POS System</h2>
            <p className="text-gray-600 mt-1">
              Help expand our registry by adding a POS system that's not currently listed
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900">Review Process</h3>
              <p className="text-sm text-blue-800 mt-1">
                Contributed POS systems undergo a verification process. Once approved, they'll be available 
                to all users. We may contact you for additional information or clarification.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  POS System Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="e.g., MyPOS System"
                />
                {errors.name && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  System ID (optional)
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => handleInputChange('id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Auto-generated if empty"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty to auto-generate from name
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Brief description of the POS system and its primary use cases..."
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.description}
                </p>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="restaurant">Restaurant</option>
                  <option value="retail">Retail</option>
                  <option value="enterprise">Enterprise</option>
                  <option value="mobile">Mobile</option>
                  <option value="specialty">Specialty</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing Model *
                </label>
                <select
                  value={formData.pricing}
                  onChange={(e) => handleInputChange('pricing', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="free">Free</option>
                  <option value="freemium">Freemium</option>
                  <option value="paid">Paid</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website *
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.website ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://example.com"
                />
                {errors.website && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.website}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo URL (optional)
                </label>
                <input
                  type="url"
                  value={formData.logo}
                  onChange={(e) => handleInputChange('logo', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.logo ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://example.com/logo.png"
                />
                {errors.logo && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.logo}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Supported Regions */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Supported Regions *</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {REGIONS.map((region) => (
                <label key={region.code} className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.supportedRegions.includes(region.code)}
                    onChange={() => handleRegionToggle(region.code)}
                    className="mr-2"
                  />
                  <span className="text-sm">{region.name}</span>
                </label>
              ))}
            </div>
            {errors.supportedRegions && (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                {errors.supportedRegions}
              </p>
            )}
          </div>

          {/* Technical Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Technical Details</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Authentication Method *
                </label>
                <select
                  value={formData.authMethod}
                  onChange={(e) => handleInputChange('authMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="api_key">API Key</option>
                  <option value="oauth">OAuth</option>
                  <option value="basic_auth">Basic Auth</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Documentation
                </label>
                <input
                  type="url"
                  value={formData.apiDocumentation}
                  onChange={(e) => handleInputChange('apiDocumentation', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.apiDocumentation ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="https://docs.example.com/api"
                />
                {errors.apiDocumentation && (
                  <p className="text-sm text-red-600 mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.apiDocumentation}
                  </p>
                )}
              </div>
            </div>

            {/* Feature Support */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Feature Support
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.webhookSupport}
                    onChange={(e) => handleInputChange('webhookSupport', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Webhook/Real-time notifications support</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.multiLocation}
                    onChange={(e) => handleInputChange('multiLocation', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Multi-location support</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.taxDetailsSupport}
                    onChange={(e) => handleInputChange('taxDetailsSupport', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm">Detailed tax information in transactions</span>
                </label>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Email *
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.contactEmail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="your@email.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                We may contact you for verification or additional information
              </p>
              {errors.contactEmail && (
                <p className="text-sm text-red-600 mt-1 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.contactEmail}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                value={formData.additionalNotes}
                onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any additional information about integration specifics, special requirements, or notes for our team..."
              />
            </div>
          </div>

          {/* Submit Status */}
          {submitStatus === 'success' && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800">{submitMessage}</span>
              </div>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-800">{submitMessage}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-6 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || submitStatus === 'success'}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center"
            >
              {isSubmitting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContributePOS;
