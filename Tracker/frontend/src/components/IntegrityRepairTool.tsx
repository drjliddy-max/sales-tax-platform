import React, { useState } from 'react';
import { migrationValidationService } from '@/services/migrationValidation';
import { useTenant } from '@/contexts/TenantContext';

interface IntegrityRepairToolProps {
  className?: string;
  onRepairComplete?: (result: any) => void;
}

export function IntegrityRepairTool({ className = '', onRepairComplete }: IntegrityRepairToolProps) {
  const { tenant: currentTenant } = useTenant();
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<any>(null);
  const [repairOptions, setRepairOptions] = useState({
    fixOrphanedRecords: true,
    fixBrokenReferences: true,
    createMissingRecords: false,
    deleteInvalidRecords: false,
  });
  const [integrityStatus, setIntegrityStatus] = useState<any>(null);

  const checkIntegrity = async () => {
    if (!currentTenant) return;
    
    setIsRepairing(true);
    try {
      const status = await migrationValidationService.checkReferentialIntegrity(currentTenant.id);
      setIntegrityStatus(status);
    } catch (error) {
      console.error('Error checking integrity:', error);
    } finally {
      setIsRepairing(false);
    }
  };

  const runRepair = async () => {
    if (!currentTenant) return;
    
    setIsRepairing(true);
    try {
      const result = await migrationValidationService.fixIntegrityIssues(currentTenant.id, repairOptions);
      setRepairResult(result);
      onRepairComplete?.(result);
      
      // Re-check integrity after repair
      await checkIntegrity();
    } catch (error) {
      console.error('Error running repair:', error);
      setRepairResult({
        success: false,
        fixed: { orphanedRecords: 0, brokenReferences: 0, createdRecords: 0, deletedRecords: 0 },
        errors: ['Repair operation failed'],
      });
    } finally {
      setIsRepairing(false);
    }
  };

  React.useEffect(() => {
    if (currentTenant) {
      checkIntegrity();
    }
  }, [currentTenant]);

  if (!currentTenant) {
    return (
      <div className={`p-6 bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
        <p className="text-gray-600">Please select a tenant to use integrity repair tools</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Data Integrity Repair Tool</h3>
        <p className="text-gray-600">Detect and fix data integrity issues in your tenant</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Integrity Status */}
        {integrityStatus && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-gray-900">Current Status</h4>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                integrityStatus.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {integrityStatus.passed ? 'Healthy' : 'Issues Found'}
              </span>
            </div>

            {!integrityStatus.passed && (
              <div className="space-y-3">
                {integrityStatus.orphanedRecords.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h5 className="font-medium text-red-800 mb-2">Orphaned Records</h5>
                    {integrityStatus.orphanedRecords.map((record: any, index: number) => (
                      <div key={index} className="text-red-700 text-sm">
                        {record.table}: {record.count} orphaned records
                      </div>
                    ))}
                  </div>
                )}

                {integrityStatus.brokenReferences.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h5 className="font-medium text-orange-800 mb-2">Broken References</h5>
                    {integrityStatus.brokenReferences.map((ref: any, index: number) => (
                      <div key={index} className="text-orange-700 text-sm">
                        {ref.table}.{ref.field}: {ref.count} broken references
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Repair Options */}
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">Repair Options</h4>
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={repairOptions.fixOrphanedRecords}
                onChange={(e) => setRepairOptions(prev => ({
                  ...prev,
                  fixOrphanedRecords: e.target.checked
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">Fix Orphaned Records</span>
                <p className="text-sm text-gray-600">Remove records without valid parent references</p>
              </div>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={repairOptions.fixBrokenReferences}
                onChange={(e) => setRepairOptions(prev => ({
                  ...prev,
                  fixBrokenReferences: e.target.checked
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">Fix Broken References</span>
                <p className="text-sm text-gray-600">Repair references to missing records</p>
              </div>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={repairOptions.createMissingRecords}
                onChange={(e) => setRepairOptions(prev => ({
                  ...prev,
                  createMissingRecords: e.target.checked
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">Create Missing Records</span>
                <p className="text-sm text-gray-600">Create placeholder records for broken references</p>
              </div>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={repairOptions.deleteInvalidRecords}
                onChange={(e) => setRepairOptions(prev => ({
                  ...prev,
                  deleteInvalidRecords: e.target.checked
                }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-gray-900">Delete Invalid Records</span>
                <p className="text-sm text-gray-600 text-red-600">⚠️ Permanently remove invalid data</p>
              </div>
            </label>
          </div>
        </div>

        {/* Repair Results */}
        {repairResult && (
          <div className={`p-4 rounded-lg ${repairResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h4 className={`font-medium mb-3 ${repairResult.success ? 'text-green-800' : 'text-red-800'}`}>
              Repair {repairResult.success ? 'Completed Successfully' : 'Failed'}
            </h4>
            
            {repairResult.success && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-green-700">
                  <div>Orphaned records fixed: {repairResult.fixed.orphanedRecords}</div>
                  <div>Broken references fixed: {repairResult.fixed.brokenReferences}</div>
                </div>
                <div className="text-green-700">
                  <div>Records created: {repairResult.fixed.createdRecords}</div>
                  <div>Records deleted: {repairResult.fixed.deletedRecords}</div>
                </div>
              </div>
            )}

            {repairResult.errors && repairResult.errors.length > 0 && (
              <div className="mt-3">
                <h5 className="font-medium text-red-800 mb-1">Errors:</h5>
                <ul className="text-red-700 text-sm">
                  {repairResult.errors.map((error: string, index: number) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <button
            onClick={checkIntegrity}
            disabled={isRepairing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isRepairing ? 'Checking...' : 'Check Integrity'}
          </button>
          
          {integrityStatus && !integrityStatus.passed && (
            <button
              onClick={runRepair}
              disabled={isRepairing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {isRepairing ? 'Repairing...' : 'Run Repair'}
            </button>
          )}
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600">⚠️</span>
            <div className="text-yellow-800">
              <h5 className="font-medium">Important Notice</h5>
              <p className="text-sm mt-1">
                Data repair operations can permanently modify your data. Always create a backup before running repairs.
                Test repairs in a staging environment first when possible.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IntegrityRepairTool;