// Test data for Sales Tax Platform E2E tests

export const testBusinesses = [
  {
    id: 'test_business_1',
    name: 'Test Restaurant LLC',
    businessType: 'restaurant',
    taxId: '12-3456789',
    address: {
      street: '123 Main St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'US'
    },
    nexusStates: ['TX', 'CA'],
    posProvider: 'square'
  }
]

export const testTransactions = [
  {
    id: 'test_txn_1',
    businessId: 'test_business_1',
    date: '2024-01-15',
    amount: 124.99,
    tax: 10.31,
    total: 135.30,
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    items: [
      { name: 'Burger', price: 89.99, category: 'food' },
      { name: 'Fries', price: 35.00, category: 'food' }
    ],
    location: {
      street: '123 Main St',
      city: 'Austin', 
      state: 'TX',
      zipCode: '78701'
    },
    status: 'completed'
  },
  {
    id: 'test_txn_2', 
    businessId: 'test_business_1',
    date: '2024-01-14',
    amount: 256.78,
    tax: 21.18,
    total: 277.96,
    customerName: 'Jane Smith',
    customerEmail: 'jane@example.com',
    items: [
      { name: 'Laptop', price: 256.78, category: 'electronics' }
    ],
    location: {
      street: '456 Oak Ave',
      city: 'San Francisco',
      state: 'CA', 
      zipCode: '94102'
    },
    status: 'completed'
  }
]

export const testTaxRates = {
  'TX': {
    state: 0.0625,
    county: 0.01,
    city: 0.02,
    total: 0.0925
  },
  'CA': {
    state: 0.0725,
    county: 0.0125,
    city: 0.0225,
    total: 0.1075
  },
  'NY': {
    state: 0.08,
    county: 0.015,
    city: 0.025,
    total: 0.12
  }
}

export const testUsers = [
  {
    id: 'test_user_1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    businessId: 'test_business_1'
  }
]

// Mock API responses
export const mockApiResponses = {
  healthCheck: { status: 'ok', timestamp: new Date().toISOString() },
  
  businesses: { businesses: testBusinesses },
  
  dashboard: {
    totalSales: 45678.90,
    totalTax: 3654.31,
    transactionCount: 156,
    recentTransactions: testTransactions.slice(0, 3)
  },
  
  taxCalculation: {
    subtotal: 124.99,
    taxAmount: 10.31,
    total: 135.30,
    breakdown: [
      { jurisdiction: 'Texas State', rate: 0.0625, amount: 7.81 },
      { jurisdiction: 'Travis County', rate: 0.01, amount: 1.25 },
      { jurisdiction: 'Austin City', rate: 0.02, amount: 2.50 }
    ]
  }
}

export const testFormData = {
  businessSetup: {
    step1: {
      businessName: 'Test Business LLC',
      businessType: 'retail', 
      taxId: '12-3456789'
    },
    step2: {
      address: {
        street: '123 Test Street',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701'
      },
      contact: {
        phone: '(555) 123-4567',
        email: 'test@testbusiness.com'
      }
    },
    step3: {
      nexusStates: ['TX', 'CA']
    },
    step4: {
      posProvider: 'square',
      accountingProvider: 'quickbooks'
    }
  },
  
  transactionEntry: {
    date: '2024-01-15',
    customerName: 'Test Customer',
    customerEmail: 'customer@test.com',
    items: [
      { name: 'Test Product', price: '99.99', category: 'general' }
    ],
    location: {
      street: '123 Customer St',
      city: 'Austin',
      state: 'TX', 
      zipCode: '78701'
    }
  }
}