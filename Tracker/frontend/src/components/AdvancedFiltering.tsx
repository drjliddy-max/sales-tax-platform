import React, { useState, useEffect } from 'react';
import {
  Filter,
  Search,
  X,
  Plus,
  Save,
  Bookmark,
  Calendar,
  DollarSign,
  Tag,
  MapPin,
  Users,
  Clock,
  MoreVertical,
  Check,
  AlertCircle,
  Trash2,
  Edit2,
  Copy,
  Download
} from 'lucide-react';

export interface FilterCriteria {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'ends_with' | 
           'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
  value: any;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'array';
}

export interface FilterGroup {
  id: string;
  name: string;
  criteria: FilterCriteria[];
  operator: 'and' | 'or';
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  usage: number;
}

export interface FilterField {
  key: string;
  label: string;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'array';
  operators: string[];
  options?: { value: any; label: string }[];
  placeholder?: string;
}

interface AdvancedFilteringProps {
  fields: FilterField[];
  initialFilters?: FilterCriteria[];
  onFiltersChange: (filters: FilterCriteria[]) => void;
  onSaveFilter?: (filter: FilterGroup) => void;
  savedFilters?: FilterGroup[];
  className?: string;
}

const operatorLabels = {
  equals: 'Equals',
  not_equals: 'Does not equal',
  contains: 'Contains',
  starts_with: 'Starts with',
  ends_with: 'Ends with',
  greater_than: 'Greater than',
  less_than: 'Less than',
  between: 'Between',
  in: 'In list',
  not_in: 'Not in list',
  is_null: 'Is empty',
  is_not_null: 'Is not empty'
};

export const AdvancedFiltering: React.FC<AdvancedFilteringProps> = ({
  fields,
  initialFilters = [],
  onFiltersChange,
  onSaveFilter,
  savedFilters = [],
  className = ''
}) => {
  const [filters, setFilters] = useState<FilterCriteria[]>(initialFilters);
  const [isOpen, setIsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [selectedSavedFilter, setSelectedSavedFilter] = useState<string>('');
  const [groupOperator, setGroupOperator] = useState<'and' | 'or'>('and');

  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const addFilter = () => {
    const newFilter: FilterCriteria = {
      id: `filter_${Date.now()}`,
      field: fields[0]?.key || '',
      operator: 'equals',
      value: '',
      dataType: fields[0]?.dataType || 'string'
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterCriteria>) => {
    setFilters(prevFilters =>
      prevFilters.map(filter =>
        filter.id === id ? { ...filter, ...updates } : filter
      )
    );
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(filter => filter.id !== id));
  };

  const clearAllFilters = () => {
    setFilters([]);
  };

  const handleFieldChange = (id: string, fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey);
    if (field) {
      updateFilter(id, {
        field: fieldKey,
        dataType: field.dataType,
        operator: field.operators[0] as FilterCriteria['operator'],
        value: field.dataType === 'boolean' ? false : ''
      });
    }
  };

  const handleOperatorChange = (id: string, operator: FilterCriteria['operator']) => {
    updateFilter(id, { operator });
  };

  const handleValueChange = (id: string, value: any) => {
    updateFilter(id, { value });
  };

  const applySavedFilter = (savedFilter: FilterGroup) => {
    setFilters(savedFilter.criteria);
    setGroupOperator(savedFilter.operator);
    setSelectedSavedFilter(savedFilter.id);
  };

  const saveCurrentFilter = () => {
    if (!filterName.trim() || !onSaveFilter) return;

    const newFilter: FilterGroup = {
      id: `saved_${Date.now()}`,
      name: filterName.trim(),
      criteria: filters,
      operator: groupOperator,
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usage: 0
    };

    onSaveFilter(newFilter);
    setFilterName('');
    setSaveDialogOpen(false);
  };

  const getFieldByKey = (key: string) => {
    return fields.find(field => field.key === key);
  };

  const renderValueInput = (filter: FilterCriteria) => {
    const field = getFieldByKey(filter.field);
    if (!field) return null;

    // No value input needed for null checks
    if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
      return null;
    }

    // Between operator needs two inputs
    if (filter.operator === 'between') {
      return (
        <div className="flex space-x-2">
          <input
            type={field.dataType === 'number' ? 'number' : field.dataType === 'date' ? 'date' : 'text'}
            value={filter.value?.start || ''}
            onChange={(e) => handleValueChange(filter.id, {
              ...filter.value,
              start: e.target.value
            })}
            placeholder="From"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type={field.dataType === 'number' ? 'number' : field.dataType === 'date' ? 'date' : 'text'}
            value={filter.value?.end || ''}
            onChange={(e) => handleValueChange(filter.id, {
              ...filter.value,
              end: e.target.value
            })}
            placeholder="To"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      );
    }

    // Array/list operators
    if (filter.operator === 'in' || filter.operator === 'not_in') {
      if (field.options) {
        return (
          <select
            multiple
            value={Array.isArray(filter.value) ? filter.value : []}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions, option => option.value);
              handleValueChange(filter.id, values);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            size={Math.min(field.options.length, 4)}
          >
            {field.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      } else {
        return (
          <textarea
            value={Array.isArray(filter.value) ? filter.value.join('\n') : ''}
            onChange={(e) => {
              const values = e.target.value.split('\n').filter(v => v.trim());
              handleValueChange(filter.id, values);
            }}
            placeholder="Enter values, one per line"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      }
    }

    // Boolean field
    if (field.dataType === 'boolean') {
      return (
        <select
          value={filter.value}
          onChange={(e) => handleValueChange(filter.id, e.target.value === 'true')}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    // Dropdown options
    if (field.options) {
      return (
        <select
          value={filter.value}
          onChange={(e) => handleValueChange(filter.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select...</option>
          {field.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    // Default input
    return (
      <input
        type={field.dataType === 'number' ? 'number' : field.dataType === 'date' ? 'date' : 'text'}
        value={filter.value || ''}
        onChange={(e) => handleValueChange(filter.id, e.target.value)}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    );
  };

  const getFilterSummary = () => {
    if (filters.length === 0) return 'No filters applied';
    if (filters.length === 1) return '1 filter applied';
    return `${filters.length} filters applied (${groupOperator.toUpperCase()})`;
  };

  return (
    <div className={className}>
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center px-4 py-2 border rounded-lg transition-colors ${
          isOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 
          filters.length > 0 ? 'bg-orange-50 border-orange-200 text-orange-700' :
          'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Filter className="w-4 h-4 mr-2" />
        Advanced Filters
        {filters.length > 0 && (
          <span className="ml-2 w-2 h-2 bg-orange-500 rounded-full"></span>
        )}
      </button>

      {/* Filter Summary */}
      <div className="mt-2 text-sm text-gray-600">
        {getFilterSummary()}
      </div>

      {/* Advanced Filter Panel */}
      {isOpen && (
        <div className="mt-4 p-6 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Saved Filters */}
          {savedFilters.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Saved Filters</h4>
              <div className="flex flex-wrap gap-2">
                {savedFilters.map(savedFilter => (
                  <button
                    key={savedFilter.id}
                    onClick={() => applySavedFilter(savedFilter)}
                    className={`flex items-center px-3 py-1.5 text-sm border rounded-full transition-colors ${
                      selectedSavedFilter === savedFilter.id
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Bookmark className="w-3 h-3 mr-1" />
                    {savedFilter.name}
                    {savedFilter.usage > 0 && (
                      <span className="ml-1 text-xs text-gray-500">({savedFilter.usage})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Group Operator */}
          {filters.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Apply filters using
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="groupOperator"
                    value="and"
                    checked={groupOperator === 'and'}
                    onChange={(e) => setGroupOperator(e.target.value as 'and' | 'or')}
                    className="mr-2"
                  />
                  <span className="text-sm">AND (all conditions must match)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="groupOperator"
                    value="or"
                    checked={groupOperator === 'or'}
                    onChange={(e) => setGroupOperator(e.target.value as 'and' | 'or')}
                    className="mr-2"
                  />
                  <span className="text-sm">OR (any condition can match)</span>
                </label>
              </div>
            </div>
          )}

          {/* Filter Criteria */}
          <div className="space-y-4">
            {filters.map((filter, index) => {
              const field = getFieldByKey(filter.field);
              return (
                <div key={filter.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                  {/* Field Selector */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Field</label>
                    <select
                      value={filter.field}
                      onChange={(e) => handleFieldChange(filter.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {fields.map(field => (
                        <option key={field.key} value={field.key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Operator Selector */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Condition</label>
                    <select
                      value={filter.operator}
                      onChange={(e) => handleOperatorChange(filter.id, e.target.value as FilterCriteria['operator'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {field?.operators.map(op => (
                        <option key={op} value={op}>
                          {operatorLabels[op as keyof typeof operatorLabels]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Value Input */}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
                    {renderValueInput(filter)}
                  </div>

                  {/* Remove Button */}
                  <div className="pt-6">
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={addFilter}
                className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Filter
              </button>
              
              {filters.length > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear All
                </button>
              )}
            </div>

            <div className="flex space-x-2">
              {onSaveFilter && filters.length > 0 && (
                <button
                  onClick={() => setSaveDialogOpen(true)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                >
                  <Save className="w-4 h-4 mr-1" />
                  Save Filter
                </button>
              )}
              
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Filter Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Filter</h3>
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Enter filter name"
              className="w-full px-3 py-2 border border-gray-300 rounded mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setSaveDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveCurrentFilter}
                disabled={!filterName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFiltering;
