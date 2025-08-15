import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'

export default function TransactionEntry() {
  const { user } = useUser()
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    customerName: '',
    customerEmail: '',
    items: [{ name: '', price: '', category: 'general' }],
    location: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    },
    taxExemption: false,
    exemptionCertificate: '',
    notes: ''
  })
  
  const [taxCalculation, setTaxCalculation] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const itemCategories = [
    { value: 'general', label: 'General Merchandise' },
    { value: 'food', label: 'Food & Beverage' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'medical', label: 'Medical/Prescription' },
    { value: 'services', label: 'Services' }
  ]

  const usStates = [
    { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }
  ]

  const handleInputChange = (field, value, nested = null) => {
    if (nested) {
      setFormData(prev => ({
        ...prev,
        [nested]: {
          ...prev[nested],
          [field]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData(prev => ({
      ...prev,
      items: newItems
    }))
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', price: '', category: 'general' }]
    }))
  }

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index)
      setFormData(prev => ({
        ...prev,
        items: newItems
      }))
    }
  }

  const calculateTax = async () => {
    setIsCalculating(true)
    try {
      const totalAmount = formData.items.reduce((sum, item) => sum + parseFloat(item.price || 0), 0)
      
      const response = await fetch('http://localhost:3002/api/tax/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalAmount,
          location: formData.location,
          items: formData.items,
          exemption: formData.taxExemption
        })
      })

      if (response.ok) {
        const result = await response.json()
        setTaxCalculation(result)
      } else {
        // Fallback calculation for demo
        const taxRate = 0.0825 // 8.25% combined rate
        const taxAmount = formData.taxExemption ? 0 : totalAmount * taxRate
        setTaxCalculation({
          subtotal: totalAmount,
          taxAmount: taxAmount,
          total: totalAmount + taxAmount,
          breakdown: [
            { jurisdiction: 'Texas State', rate: 0.0625, amount: totalAmount * 0.0625 },
            { jurisdiction: 'Local', rate: 0.02, amount: totalAmount * 0.02 }
          ]
        })
      }
    } catch (error) {
      console.error('Error calculating tax:', error)
      // Fallback calculation
      const totalAmount = formData.items.reduce((sum, item) => sum + parseFloat(item.price || 0), 0)
      const taxAmount = formData.taxExemption ? 0 : totalAmount * 0.0825
      setTaxCalculation({
        subtotal: totalAmount,
        taxAmount: taxAmount,
        total: totalAmount + taxAmount,
        breakdown: [
          { jurisdiction: 'Default Rate', rate: 0.0825, amount: taxAmount }
        ]
      })
    } finally {
      setIsCalculating(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const totalAmount = formData.items.reduce((sum, item) => sum + parseFloat(item.price || 0), 0)
      
      const transactionData = {
        ...formData,
        amount: totalAmount,
        tax: taxCalculation?.taxAmount || 0,
        total: taxCalculation?.total || totalAmount,
        userId: user?.id,
        status: 'completed'
      }

      const response = await fetch('http://localhost:3002/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData)
      })

      if (response.ok) {
        // Reset form
        setFormData({
          date: new Date().toISOString().split('T')[0],
          amount: '',
          customerName: '',
          customerEmail: '',
          items: [{ name: '', price: '', category: 'general' }],
          location: {
            street: '',
            city: '',
            state: '',
            zipCode: ''
          },
          taxExemption: false,
          exemptionCertificate: '',
          notes: ''
        })
        setTaxCalculation(null)
        alert('Transaction saved successfully!')
      } else {
        alert('Failed to save transaction')
      }
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert('Error saving transaction')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Transaction</h1>
        <p className="mt-2 text-gray-600">
          Enter transaction details to calculate and record sales tax.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Date *
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                placeholder="Enter customer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.customerEmail}
                onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
            >
              + Add Item
            </button>
          </div>

          {formData.items.map((item, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 border border-gray-200 rounded-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={item.name}
                  onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                  placeholder="Product name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={item.price}
                  onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={item.category}
                  onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                >
                  {itemCategories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                {formData.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="w-full px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Location */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Transaction Location</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.location.street}
                onChange={(e) => handleInputChange('street', e.target.value, 'location')}
                placeholder="123 Main St"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.location.city}
                onChange={(e) => handleInputChange('city', e.target.value, 'location')}
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State *
              </label>
              <select
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.location.state}
                onChange={(e) => handleInputChange('state', e.target.value, 'location')}
              >
                <option value="">Select state</option>
                {usStates.map(state => (
                  <option key={state.value} value={state.value}>
                    {state.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP Code *
              </label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={formData.location.zipCode}
                onChange={(e) => handleInputChange('zipCode', e.target.value, 'location')}
                placeholder="12345"
              />
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="bg-white shadow rounded-lg p-6">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-left"
          >
            <h2 className="text-lg font-medium text-gray-900">Advanced Options</h2>
            <span className="text-gray-500">{showAdvanced ? '−' : '+'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="taxExemption"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={formData.taxExemption}
                  onChange={(e) => handleInputChange('taxExemption', e.target.checked)}
                />
                <label htmlFor="taxExemption" className="ml-2 text-sm text-gray-700">
                  Tax Exempt Transaction
                </label>
              </div>

              {formData.taxExemption && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exemption Certificate Number
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.exemptionCertificate}
                    onChange={(e) => handleInputChange('exemptionCertificate', e.target.value)}
                    placeholder="Certificate number"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Additional notes about this transaction"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tax Calculation */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Tax Calculation</h2>
            <button
              type="button"
              onClick={calculateTax}
              disabled={isCalculating || formData.items.every(item => !item.price)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCalculating ? 'Calculating...' : 'Calculate Tax'}
            </button>
          </div>

          {taxCalculation && (
            <div className="border border-gray-200 rounded-md p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-700">Subtotal:</span>
                  <span className="font-medium">${taxCalculation.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Tax:</span>
                  <span className="font-medium">${taxCalculation.taxAmount?.toFixed(2)}</span>
                </div>
                <hr className="my-2" />
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total:</span>
                  <span>${taxCalculation.total?.toFixed(2)}</span>
                </div>

                {taxCalculation.breakdown && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Tax Breakdown:</h4>
                    {taxCalculation.breakdown.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm text-gray-600">
                        <span>{item.jurisdiction} ({(item.rate * 100).toFixed(2)}%):</span>
                        <span>${item.amount?.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !taxCalculation}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Transaction'}
          </button>
        </div>
      </form>
    </div>
  )
}