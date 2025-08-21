import React, { useState, useEffect } from 'react';
import { migrationValidationService, IntegrityCheckResult, DataIntegrityReport, ValidationResult } from '@/services/migrationValidation';
import { useTenant } from '@/contexts/TenantContext';

interface ValidationDashboardProps {
  className?: string;
}

export function ValidationDashboard({ className = '' }: ValidationDashboardProps) {
  const { tenant: currentTenant } = useTenant();
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null);
  const [tenantReport, setTenantReport] = useState<DataIntegrityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'rules'>('overview');

  const runIntegrityCheck = async () => {
    if (!currentTenant) return;
    
    setLoading(true);
    try {
      const [integrityCheck, tenantData] = await Promise.all([
        migrationValidationService.validateDataIntegrity(currentTenant.id),
        migrationValidationService.validateTenantData(currentTenant.id)
      ]);
      
      setIntegrityResult(integrityCheck);
      setTenantReport(tenantData);
    } catch (error) {
      console.error('Error running integrity check:', error);
    } finally {
      setLoading(false);
    }
  };

  const runTenantIsolationCheck = async () => {
    setLoading(true);
    try {
      const result = await migrationValidationService.validateTenantIsolation();
      setIntegrityResult(result);
    } catch (error) {
      console.error('Error running tenant isolation check:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentTenant) {
      runIntegrityCheck();
    }
  }, [currentTenant]);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'warnings': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  if (!currentTenant) {
    return (
      <div className={`p-6 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <p className="text-gray-600">Please select a tenant to view validation dashboard</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Data Validation Dashboard</h2>
          <div className="flex space-x-2">
            <button
              onClick={runIntegrityCheck}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Running...' : 'Run Full Check'}
            </button>
            <button
              onClick={runTenantIsolationCheck}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              Isolation Check
            </button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="mt-4">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'details', label: 'Detailed Results' },
              { id: 'rules', label: 'Validation Rules' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Running validation checks...</span>
          </div>
        )}

        {!loading && activeTab === 'overview' && integrityResult && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Integrity Score</h3>
                  <p className="text-gray-600">Overall data quality and consistency</p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${getScoreColor(integrityResult.score)}`}>
                    {integrityResult.score}%
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(integrityResult.overall)}`}>
                    {integrityResult.overall.toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{integrityResult.summary.passed}</div>
                <div className="text-sm text-green-700">Checks Passed</div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{integrityResult.summary.failed}</div>
                <div className="text-sm text-red-700">Checks Failed</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{integrityResult.summary.warnings}</div>
                <div className="text-sm text-yellow-700">Warnings</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{integrityResult.executionTime}ms</div>
                <div className="text-sm text-blue-700">Execution Time</div>
              </div>
            </div>

            {/* Tenant-Specific Report */}
            {tenantReport && (
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Tenant Data Health</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">Referential Integrity</h5>
                    <div className={`p-3 rounded ${tenantReport.checks.referentialIntegrity.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                      {tenantReport.checks.referentialIntegrity.passed ? (
                        <span className="text-green-700">✅ All references valid</span>
                      ) : (
                        <div className="text-red-700">
                          <div>❌ {tenantReport.checks.referentialIntegrity.orphanedRecords} orphaned records</div>
                          <div className="text-sm mt-1">
                            {tenantReport.checks.referentialIntegrity.brokenReferences.slice(0, 3).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">Data Consistency</h5>
                    <div className={`p-3 rounded ${tenantReport.checks.dataConsistency.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                      {tenantReport.checks.dataConsistency.passed ? (
                        <span className="text-green-700">✅ Data consistent</span>
                      ) : (
                        <div className="text-red-700">
                          <div>❌ {tenantReport.checks.dataConsistency.duplicateRecords} duplicates found</div>
                          <div className="text-sm mt-1">
                            {tenantReport.checks.dataConsistency.inconsistencies.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">Tenant Isolation</h5>
                    <div className={`p-3 rounded ${tenantReport.checks.tenantIsolation.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                      {tenantReport.checks.tenantIsolation.passed ? (
                        <span className="text-green-700">✅ Properly isolated</span>
                      ) : (
                        <div className="text-red-700">
                          <div>❌ {tenantReport.checks.tenantIsolation.missingTenantIds} missing tenant IDs</div>
                          <div className="text-sm mt-1">
                            {tenantReport.checks.tenantIsolation.crossTenantReferences.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-800 mb-2">Business Rules</h5>
                    <div className={`p-3 rounded ${tenantReport.checks.businessRules.passed ? 'bg-green-100' : 'bg-red-100'}`}>
                      {tenantReport.checks.businessRules.passed ? (
                        <span className="text-green-700">✅ Rules compliant</span>
                      ) : (
                        <div className="text-red-700">
                          <div>❌ {tenantReport.checks.businessRules.invalidTransactions} invalid transactions</div>
                          <div className="text-sm mt-1">
                            {tenantReport.checks.businessRules.violations.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {integrityResult.recommendations.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-3">Recommendations</h4>
                <ul className="space-y-2">
                  {integrityResult.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start text-blue-800">
                      <span className="text-blue-600 mr-2">💡</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'details' && integrityResult && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Detailed Validation Results</h3>
            {integrityResult.results.map((result, index) => (
              <div key={index} className={`p-4 rounded-lg border ${
                result.passed ? 'bg-green-50 border-green-200' : 
                result.severity === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-lg">{getSeverityIcon(result.severity)}</span>
                    <div>
                      <h4 className="font-medium text-gray-900">{result.ruleId}</h4>
                      <p className="text-gray-700 mt-1">{result.message}</p>
                      {result.recommendation && (
                        <p className="text-sm text-gray-600 mt-2">
                          <strong>Recommendation:</strong> {result.recommendation}
                        </p>
                      )}
                      {result.affectedItems && result.affectedItems.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-sm text-gray-600 cursor-pointer">
                            Affected items ({result.affectedItems.length})
                          </summary>
                          <ul className="mt-1 text-sm text-gray-600 ml-4">
                            {result.affectedItems.slice(0, 10).map((item, i) => (
                              <li key={i}>• {item}</li>
                            ))}
                            {result.affectedItems.length > 10 && (
                              <li>... and {result.affectedItems.length - 10} more</li>
                            )}
                          </ul>
                        </details>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    result.passed ? 'bg-green-200 text-green-800' : 
                    result.severity === 'error' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                  }`}>
                    {result.passed ? 'PASSED' : result.severity.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'rules' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Available Validation Rules</h3>
            <p className="text-gray-600">Configure which validation rules to run during integrity checks.</p>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Validation Categories</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong className="text-blue-800">Data Integrity:</strong>
                  <ul className="text-blue-700 ml-4 mt-1">
                    <li>• Referential integrity checks</li>
                    <li>• Orphaned record detection</li>
                    <li>• Duplicate data identification</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-blue-800">Tenant Isolation:</strong>
                  <ul className="text-blue-700 ml-4 mt-1">
                    <li>• Cross-tenant reference validation</li>
                    <li>• Missing tenant ID detection</li>
                    <li>• Access control verification</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-blue-800">Performance:</strong>
                  <ul className="text-blue-700 ml-4 mt-1">
                    <li>• Query performance analysis</li>
                    <li>• Index utilization checks</li>
                    <li>• Data size optimization</li>
                  </ul>
                </div>
                <div>
                  <strong className="text-blue-800">Compliance:</strong>
                  <ul className="text-blue-700 ml-4 mt-1">
                    <li>• Data retention policy compliance</li>
                    <li>• Audit trail completeness</li>
                    <li>• Encryption requirements</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !integrityResult && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Validation Results</h3>
            <p className="text-gray-600 mb-4">Run an integrity check to see validation results</p>
            <button
              onClick={runIntegrityCheck}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Start Validation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ValidationDashboard;