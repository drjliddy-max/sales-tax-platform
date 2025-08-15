export const jurisdictionTestData = {
  taxRates: [
    // California - Complex multi-jurisdiction
    {
      jurisdiction: 'California',
      jurisdictionType: 'state',
      state: 'CA',
      rate: 7.25,
      productCategories: [
        { category: 'general', rate: 7.25, exempt: false },
        { category: 'food', rate: 0, exempt: true },
        { category: 'clothing', rate: 7.25, exempt: false },
        { category: 'medicine', rate: 0, exempt: true }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    },
    {
      jurisdiction: 'Los Angeles County',
      jurisdictionType: 'county',
      state: 'CA',
      county: 'Los Angeles',
      rate: 1.0,
      productCategories: [
        { category: 'general', rate: 1.0, exempt: false },
        { category: 'food', rate: 0, exempt: true }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    },
    {
      jurisdiction: 'Los Angeles City',
      jurisdictionType: 'city',
      state: 'CA',
      county: 'Los Angeles',
      city: 'Los Angeles',
      rate: 0.5,
      productCategories: [
        { category: 'general', rate: 0.5, exempt: false }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    },
    // New York - Different exemption rules
    {
      jurisdiction: 'New York',
      jurisdictionType: 'state',
      state: 'NY',
      rate: 8.0,
      productCategories: [
        { category: 'general', rate: 8.0, exempt: false },
        { category: 'clothing', rate: 0, exempt: true }, // Under $110
        { category: 'food', rate: 0, exempt: true }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    },
    // Texas - No state income tax, higher sales tax
    {
      jurisdiction: 'Texas',
      jurisdictionType: 'state',
      state: 'TX',
      rate: 6.25,
      productCategories: [
        { category: 'general', rate: 6.25, exempt: false },
        { category: 'food', rate: 0, exempt: true }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    },
    {
      jurisdiction: 'Harris County',
      jurisdictionType: 'county',
      state: 'TX',
      county: 'Harris',
      rate: 2.0,
      productCategories: [
        { category: 'general', rate: 2.0, exempt: false }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    },
    // Delaware - No sales tax
    {
      jurisdiction: 'Delaware',
      jurisdictionType: 'state',
      state: 'DE',
      rate: 0,
      productCategories: [
        { category: 'general', rate: 0, exempt: true },
        { category: 'food', rate: 0, exempt: true },
        { category: 'clothing', rate: 0, exempt: true }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    }
  ],
  
  complexScenarios: [
    {
      name: 'Los Angeles complex transaction',
      items: [
        { id: '1', name: 'Electronics', quantity: 1, unitPrice: 500.00, taxCategory: 'general' },
        { id: '2', name: 'Groceries', quantity: 3, unitPrice: 15.00, taxCategory: 'food' },
        { id: '3', name: 'Clothing', quantity: 2, unitPrice: 75.00, taxCategory: 'clothing' }
      ],
      address: {
        street: '100 Universal City Plaza',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '91608',
        country: 'US'
      },
      expected: {
        subtotal: 695.00, // $500 + $45 + $150
        taxableAmount: 650.00, // $500 + $150 (food exempt)
        stateTax: 47.12, // $650 * 7.25%
        countyTax: 6.50, // $650 * 1.0%
        cityTax: 3.25, // $650 * 0.5%
        totalTax: 56.87,
        grandTotal: 751.87
      }
    },
    {
      name: 'New York clothing exemption',
      items: [
        { id: '1', name: 'Expensive Jacket', quantity: 1, unitPrice: 200.00, taxCategory: 'clothing' },
        { id: '2', name: 'Cheap T-Shirt', quantity: 1, unitPrice: 25.00, taxCategory: 'clothing' },
        { id: '3', name: 'Electronics', quantity: 1, unitPrice: 150.00, taxCategory: 'general' }
      ],
      address: {
        street: '350 Fifth Avenue',
        city: 'New York',
        state: 'NY',
        zipCode: '10118',
        country: 'US'
      },
      expected: {
        subtotal: 375.00,
        taxableAmount: 150.00, // Only electronics (clothing exempt in NY)
        totalTax: 12.00, // $150 * 8%
        grandTotal: 387.00
      }
    },
    {
      name: 'Texas high-volume transaction',
      items: [
        { id: '1', name: 'Restaurant Equipment', quantity: 1, unitPrice: 2500.00, taxCategory: 'general' },
        { id: '2', name: 'Food Supplies', quantity: 10, unitPrice: 50.00, taxCategory: 'food' }
      ],
      address: {
        street: '1600 Smith Street',
        city: 'Houston',
        state: 'TX',
        zipCode: '77002',
        country: 'US'
      },
      expected: {
        subtotal: 3000.00,
        taxableAmount: 2500.00, // Food exempt
        stateTax: 156.25, // $2500 * 6.25%
        countyTax: 50.00, // $2500 * 2.0%
        totalTax: 206.25,
        grandTotal: 3206.25
      }
    },
    {
      name: 'Delaware no-tax transaction',
      items: [
        { id: '1', name: 'Any Product', quantity: 5, unitPrice: 100.00, taxCategory: 'general' }
      ],
      address: {
        street: '1007 North Orange Street',
        city: 'Wilmington',
        state: 'DE',
        zipCode: '19801',
        country: 'US'
      },
      expected: {
        subtotal: 500.00,
        totalTax: 0.00,
        grandTotal: 500.00
      }
    }
  ],

  edgeCases: [
    {
      name: 'Zero-dollar transaction',
      items: [
        { id: '1', name: 'Free Sample', quantity: 1, unitPrice: 0.00, taxCategory: 'general' }
      ],
      expected: { subtotal: 0.00, totalTax: 0.00, grandTotal: 0.00 }
    },
    {
      name: 'Fractional penny amounts',
      items: [
        { id: '1', name: 'Fractional Item', quantity: 3, unitPrice: 0.333, taxCategory: 'general' }
      ],
      expected: { subtotal: 0.999 }
    },
    {
      name: 'Large quantity transaction',
      items: [
        { id: '1', name: 'Bulk Item', quantity: 10000, unitPrice: 0.01, taxCategory: 'general' }
      ],
      expected: { subtotal: 100.00 }
    },
    {
      name: 'High-value transaction',
      items: [
        { id: '1', name: 'Luxury Item', quantity: 1, unitPrice: 999999.99, taxCategory: 'general' }
      ],
      expected: { subtotal: 999999.99 }
    }
  ],

  businessScenarios: [
    {
      name: 'Multi-location restaurant chain',
      business: {
        businessId: 'restaurant-chain-001',
        name: 'Pizza Palace Chain',
        type: 'restaurant',
        locations: [
          { id: 'loc-ca-001', state: 'CA', city: 'Los Angeles' },
          { id: 'loc-ny-001', state: 'NY', city: 'New York' },
          { id: 'loc-tx-001', state: 'TX', city: 'Houston' }
        ],
        nexusStates: ['CA', 'NY', 'TX']
      }
    },
    {
      name: 'Online retail business',
      business: {
        businessId: 'online-retail-001',
        name: 'E-Commerce Store',
        type: 'retail',
        locations: [
          { id: 'warehouse-001', state: 'CA', city: 'San Francisco' }
        ],
        nexusStates: ['CA', 'NY', 'TX', 'FL', 'WA'] // Economic nexus in multiple states
      }
    },
    {
      name: 'Professional services',
      business: {
        businessId: 'consulting-001',
        name: 'Tech Consulting LLC',
        type: 'services',
        locations: [
          { id: 'office-001', state: 'DE', city: 'Wilmington' }
        ],
        nexusStates: ['DE'], // Services often have different tax rules
        servicesTaxable: false
      }
    }
  ]
};