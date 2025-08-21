import React, { useEffect, useState } from 'react';
import { AlertCircle, Shield, Clock } from 'lucide-react';
import { useDataIntegrity } from '@/services/DataIntegrityService';

interface DataIntegrityWrapperProps {
  data: any;
  sourceId: string;
  children: React.ReactNode;
  showAttribution?: boolean;
  fallbackMessage?: string;
}

/**
 * Wrapper component that enforces data integrity policy
 * Only displays data from verified, real sources
 */
export function DataIntegrityWrapper({ 
  data, 
  sourceId, 
  children, 
  showAttribution = true,
  fallbackMessage = "Data unavailable - only verified real data sources are displayed"
}: DataIntegrityWrapperProps) {
  const { shouldDisplayData, generateAttribution, validateData, reportViolation } = useDataIntegrity();
  const [isValidated, setIsValidated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<string>('');

  useEffect(() => {
    const performValidation = async () => {
      try {
        // Validate data integrity
        const validation = await validateData(data, sourceId);
        
        if (!validation.isValid) {
          setValidationError(validation.errors.join('; '));
          reportViolation(sourceId, 'Invalid data blocked from display', data);
          return;
        }

        // Check if data should be displayed
        if (!shouldDisplayData(data, sourceId)) {
          setValidationError('Data source not approved for display');
          reportViolation(sourceId, 'Unapproved data source blocked', data);
          return;
        }

        setIsValidated(true);
        setAttribution(generateAttribution(sourceId));
        
      } catch (error) {
        console.error('Data validation error:', error);
        setValidationError('Data validation failed');
        reportViolation(sourceId, 'Validation system error', { error: error?.toString() });
      }
    };

    if (data) {
      performValidation();
    }
  }, [data, sourceId]);

  // Show validation error if data is not approved
  if (validationError) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800 mb-1">
              Data Integrity Policy Enforced
            </h3>
            <p className="text-sm text-yellow-700 mb-2">
              {fallbackMessage}
            </p>
            <p className="text-xs text-yellow-600">
              Technical details: {validationError}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state during validation
  if (!isValidated) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-sm text-gray-600">Validating data sources...</span>
        </div>
      </div>
    );
  }

  // Display validated data with attribution
  return (
    <div className="relative">
      {/* Real data indicator */}
      <div className="mb-2">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Shield className="h-3 w-3 mr-1" />
          Verified Real Data
        </span>
      </div>

      {/* Actual content */}
      {children}

      {/* Data attribution */}
      {showAttribution && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-500">
            <Clock className="h-3 w-3 mr-1" />
            {attribution}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Higher-order component for enforcing data integrity on any component
 */
export function withDataIntegrity<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  sourceId: string,
  fallbackMessage?: string
) {
  return function DataIntegrityEnhancedComponent(props: T & { data?: any }) {
    const { data, ...otherProps } = props;
    
    return (
      <DataIntegrityWrapper 
        data={data} 
        sourceId={sourceId}
        fallbackMessage={fallbackMessage}
      >
        <WrappedComponent {...otherProps as T} />
      </DataIntegrityWrapper>
    );
  };
}

/**
 * Component for displaying data source information
 */
export function DataSourceInfo({ sourceId }: { sourceId: string }) {
  const { generateAttribution, isSourceApproved } = useDataIntegrity();
  const attribution = generateAttribution(sourceId);
  const approved = isSourceApproved(sourceId);

  return (
    <div className={`rounded-lg p-3 ${approved ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      <div className="flex items-center">
        <Shield className={`h-4 w-4 mr-2 ${approved ? 'text-green-600' : 'text-red-600'}`} />
        <div className="text-sm">
          <div className={`font-medium ${approved ? 'text-green-800' : 'text-red-800'}`}>
            {approved ? 'Verified Data Source' : 'Unverified Source'}
          </div>
          <div className={`${approved ? 'text-green-600' : 'text-red-600'}`}>
            {attribution}
          </div>
        </div>
      </div>
    </div>
  );
}