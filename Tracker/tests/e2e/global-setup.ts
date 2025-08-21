import { chromium, FullConfig } from '@playwright/test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

async function globalSetup(config: FullConfig) {
  // Start in-memory MongoDB for tests
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Set environment variables for tests
  process.env.DATABASE_URL = mongoUri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.PORT = '3001'; // Use different port for tests
  
  // Connect to test database
  await mongoose.connect(mongoUri, {
    dbName: 'sales_tax_tracker_test'
  });

  // Seed test data
  await seedTestData();

  console.log('Playwright global setup completed');
}

async function seedTestData() {
  const { TaxRate, Business } = require('../../src/models');

  // Seed tax rates for different jurisdictions
  const taxRates = [
    {
      jurisdiction: 'California',
      jurisdictionType: 'state',
      state: 'CA',
      rate: 7.25,
      productCategories: [
        { category: 'general', rate: 7.25, exempt: false },
        { category: 'food', rate: 0, exempt: true },
        { category: 'clothing', rate: 7.25, exempt: false }
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
        { category: 'general', rate: 1.0, exempt: false }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    },
    {
      jurisdiction: 'New York',
      jurisdictionType: 'state',
      state: 'NY',
      rate: 8.0,
      productCategories: [
        { category: 'general', rate: 8.0, exempt: false },
        { category: 'clothing', rate: 0, exempt: true }
      ],
      effectiveDate: new Date('2023-01-01'),
      source: 'manual',
      active: true
    }
  ];

  for (const rate of taxRates) {
    await TaxRate.create(rate);
  }

  // Seed test business
  await Business.create({
    businessId: 'test-business-001',
    name: 'Test Business Inc',
    taxId: '12-3456789',
    address: {
      street: '123 Business St',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90210',
      country: 'US'
    },
    locations: [
      {
        id: 'loc-001',
        name: 'Main Store',
        address: {
          street: '123 Business St',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90210',
          country: 'US'
        },
        active: true
      }
    ],
    nexusStates: ['CA', 'NY'],
    integrations: {
      pos: [
        {
          type: 'square',
          enabled: true,
          credentials: { accessToken: 'test-token' },
          lastSync: new Date()
        }
      ],
      accounting: [],
      taxProviders: []
    },
    filingSchedule: [
      {
        state: 'CA',
        frequency: 'monthly',
        dueDay: 20,
        nextDue: new Date()
      }
    ],
    settings: {
      autoSync: true,
      syncFrequency: 3600000,
      autoCalculateTax: true,
      emailNotifications: false,
      complianceAlerts: true
    }
  });
}

export default globalSetup;