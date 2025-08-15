export const taxCalculationTestCases = [
  {
    name: 'California general merchandise',
    request: {
      items: [
        {
          id: 'item-001',
          name: 'Electronics Item',
          quantity: 1,
          unitPrice: 100.00,
          taxCategory: 'general'
        }
      ],
      address: {
        street: '123 Main St',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90210',
        country: 'US'
      }
    },
    expectedTax: 8.25, // 7.25% state + 1.0% county
    expectedSubtotal: 100.00,
    expectedTotal: 108.25
  },
  {
    name: 'California tax-exempt food',
    request: {
      items: [
        {
          id: 'item-002',
          name: 'Grocery Item',
          quantity: 2,
          unitPrice: 5.00,
          taxCategory: 'food'
        }
      ],
      address: {
        street: '456 Food St',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90210',
        country: 'US'
      }
    },
    expectedTax: 0.00, // Food is exempt in CA
    expectedSubtotal: 10.00,
    expectedTotal: 10.00
  },
  {
    name: 'New York clothing exemption',
    request: {
      items: [
        {
          id: 'item-003',
          name: 'T-Shirt',
          quantity: 1,
          unitPrice: 50.00,
          taxCategory: 'clothing'
        }
      ],
      address: {
        street: '789 Fashion Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      }
    },
    expectedTax: 0.00, // Clothing exempt in NY
    expectedSubtotal: 50.00,
    expectedTotal: 50.00
  },
  {
    name: 'New York general merchandise',
    request: {
      items: [
        {
          id: 'item-004',
          name: 'Book',
          quantity: 3,
          unitPrice: 15.00,
          taxCategory: 'general'
        }
      ],
      address: {
        street: '321 Book St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US'
      }
    },
    expectedTax: 3.60, // 8% on $45
    expectedSubtotal: 45.00,
    expectedTotal: 48.60
  },
  {
    name: 'Tax-exempt customer',
    request: {
      items: [
        {
          id: 'item-005',
          name: 'Office Supplies',
          quantity: 1,
          unitPrice: 200.00,
          taxCategory: 'general'
        }
      ],
      address: {
        street: '555 Business Blvd',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90210',
        country: 'US'
      },
      customerTaxExempt: true
    },
    expectedTax: 0.00,
    expectedSubtotal: 200.00,
    expectedTotal: 200.00
  }
];

export const squareWebhookPayloads = [
  {
    name: 'completed payment',
    payload: {
      merchant_id: 'test-merchant',
      location_id: 'test-location',
      type: 'payment.updated',
      event_id: 'test-event-001',
      created_at: '2023-01-01T12:00:00Z',
      data: {
        type: 'payment',
        id: 'payment-001',
        object: {
          payment: {
            id: 'payment-001',
            amount_money: {
              amount: 10825, // $108.25 in cents
              currency: 'USD'
            },
            status: 'COMPLETED',
            source_type: 'CARD',
            location_id: 'test-location',
            order_id: 'order-001',
            created_at: '2023-01-01T12:00:00Z',
            updated_at: '2023-01-01T12:00:00Z',
            receipt_number: 'RCP-001',
            receipt_url: 'https://squareup.com/receipt/test'
          }
        }
      }
    }
  },
  {
    name: 'failed payment',
    payload: {
      merchant_id: 'test-merchant',
      location_id: 'test-location',
      type: 'payment.updated',
      event_id: 'test-event-002',
      created_at: '2023-01-01T12:05:00Z',
      data: {
        type: 'payment',
        id: 'payment-002',
        object: {
          payment: {
            id: 'payment-002',
            amount_money: {
              amount: 5000,
              currency: 'USD'
            },
            status: 'FAILED',
            source_type: 'CARD',
            location_id: 'test-location',
            created_at: '2023-01-01T12:05:00Z',
            updated_at: '2023-01-01T12:05:00Z'
          }
        }
      }
    }
  }
];

export const businessTestData = {
  validBusiness: {
    businessId: 'test-business-002',
    name: 'E2E Test Business',
    taxId: '98-7654321',
    address: {
      street: '456 Test Ave',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
      country: 'US'
    },
    locations: [
      {
        id: 'loc-002',
        name: 'SF Store',
        address: {
          street: '456 Test Ave',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94102',
          country: 'US'
        },
        active: true
      }
    ],
    nexusStates: ['CA'],
    integrations: {
      pos: [],
      accounting: [],
      taxProviders: []
    },
    filingSchedule: [],
    settings: {
      autoSync: true,
      syncFrequency: 3600000,
      autoCalculateTax: true,
      emailNotifications: true,
      complianceAlerts: true
    }
  }
};