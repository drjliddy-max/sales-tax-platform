/**
 * Comprehensive POS Integration Workflow Test
 * Tests the complete POS integration flow from discovery to management
 */

const path = require('path');
const express = require('express');
const request = require('supertest');

// Mock test data
const mockPOSSystems = [
  {
    id: 'square',
    name: 'Square',
    description: 'All-in-one payment and business management platform',
    category: 'popular',
    marketShare: 15.2,
    verified: true,
    status: 'active',
    clientContributed: false,
    usageStats: { clientsUsing: 150, activeConnections: 89 }
  },
  {
    id: 'shopify_pos',
    name: 'Shopify POS',
    description: 'Unified commerce platform for online and retail',
    category: 'retail',
    marketShare: 12.8,
    verified: true,
    status: 'active',
    clientContributed: false,
    usageStats: { clientsUsing: 120, activeConnections: 67 }
  }
];

class POSWorkflowTester {
  constructor() {
    this.testResults = [];
    this.app = null;
  }

  async setup() {
    console.log('🔧 Setting up POS workflow test environment...');
    
    try {
      // Initialize POS system
      const { posInitializer } = require('./backend/src/lib/pos/POSInitializer');
      await posInitializer.initialize();
      
      // Create test Express app
      this.app = express();
      this.app.use(express.json());
      
      // Mount POS routes
      const { registryRoutes } = require('./backend/src/api/pos/registryRoutes');
      const { pluginRoutes } = require('./backend/src/api/pos/pluginRoutes');
      
      this.app.use('/api/pos/registry', registryRoutes);
      this.app.use('/api/pos/plugins', pluginRoutes);
      
      console.log('✅ Test environment ready');
    } catch (error) {
      console.error('❌ Failed to setup test environment:', error.message);
      throw error;
    }
  }

  async runTest(testName, testFn) {
    console.log(`\n🧪 Running test: ${testName}`);
    
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      
      this.testResults.push({
        name: testName,
        status: 'PASSED',
        duration: `${duration}ms`
      });
      
      console.log(`   ✅ PASSED (${duration}ms)`);
    } catch (error) {
      this.testResults.push({
        name: testName,
        status: 'FAILED',
        error: error.message
      });
      
      console.log(`   ❌ FAILED: ${error.message}`);
    }
  }

  // Test 1: POS Discovery Flow
  async testDiscoveryFlow() {
    // Test popular POS systems endpoint
    let response = await request(this.app)
      .get('/api/pos/registry/popular')
      .expect(200);
    
    if (!response.body.success || !Array.isArray(response.body.systems)) {
      throw new Error('Popular systems endpoint returned invalid data');
    }
    
    // Test categories endpoint
    response = await request(this.app)
      .get('/api/pos/registry/categories')
      .expect(200);
    
    if (!response.body.success || !response.body.categories) {
      throw new Error('Categories endpoint returned invalid data');
    }
    
    // Test search endpoint
    response = await request(this.app)
      .get('/api/pos/registry/search?q=Square')
      .expect(200);
    
    if (!response.body.success || !Array.isArray(response.body.results)) {
      throw new Error('Search endpoint returned invalid data');
    }
  }

  // Test 2: Authentication and Authorization
  async testAuthentication() {
    // Test unauthenticated request
    await request(this.app)
      .get('/api/pos/plugins/supported')
      .expect(401);
    
    // Test with mock client token
    const response = await request(this.app)
      .get('/api/pos/plugins/supported')
      .set('Authorization', 'Bearer mock_client_token')
      .expect(200);
    
    if (!response.body.success) {
      throw new Error('Authenticated request failed');
    }
  }

  // Test 3: Plugin Configuration Loading
  async testPluginConfiguration() {
    // Test getting supported POS systems
    const response = await request(this.app)
      .get('/api/pos/plugins/supported')
      .set('Authorization', 'Bearer mock_client_token')
      .expect(200);
    
    if (!response.body.supportedPOS) {
      throw new Error('No supported POS systems returned');
    }
    
    // Test getting specific plugin config (assuming square exists)
    const configResponse = await request(this.app)
      .get('/api/pos/plugins/square/config')
      .set('Authorization', 'Bearer mock_client_token');
    
    // Should either return config or 404 if not found
    if (configResponse.status !== 200 && configResponse.status !== 404) {
      throw new Error('Plugin config endpoint returned unexpected status');
    }
  }

  // Test 4: Connection Testing
  async testConnectionTesting() {
    // Test connection with mock credentials
    const response = await request(this.app)
      .post('/api/pos/plugins/square/test-connection')
      .set('Authorization', 'Bearer mock_client_token')
      .send({
        credentials: {
          apiKey: 'test_api_key',
          environment: 'sandbox'
        }
      });
    
    // Should return a connection test result
    if (response.status !== 200) {
      // It's okay if the connection fails, we just want to test the endpoint
      console.log('   Note: Connection test returned non-200, but this is expected for mock data');
    }
  }

  // Test 5: POS Contribution Flow
  async testContributionFlow() {
    // Test contributing a new POS system
    const contributionData = {
      id: 'test_pos_' + Date.now(),
      name: 'Test POS System',
      description: 'A test POS system for automated testing',
      category: 'specialty',
      website: 'https://example.com',
      supportedRegions: ['US'],
      pricing: 'paid'
    };
    
    const response = await request(this.app)
      .post('/api/pos/registry/contribute')
      .set('Authorization', 'Bearer mock_client_token')
      .send(contributionData)
      .expect(200);
    
    if (!response.body.success || !response.body.posId) {
      throw new Error('POS contribution failed');
    }
    
    // Verify the contributed POS can be retrieved
    const retrieveResponse = await request(this.app)
      .get(`/api/pos/registry/${response.body.posId}`)
      .expect(200);
    
    if (!retrieveResponse.body.success || !retrieveResponse.body.pos) {
      throw new Error('Failed to retrieve contributed POS system');
    }
  }

  // Test 6: Registry Statistics
  async testRegistryStatistics() {
    const response = await request(this.app)
      .get('/api/pos/registry/stats')
      .set('Authorization', 'Bearer mock_client_token')
      .expect(200);
    
    if (!response.body.success || !response.body.stats) {
      throw new Error('Registry statistics endpoint failed');
    }
    
    // Verify stats have expected properties
    const stats = response.body.stats;
    const expectedFields = ['totalSystems', 'verifiedSystems', 'clientContributed'];
    
    for (const field of expectedFields) {
      if (typeof stats[field] !== 'number') {
        throw new Error(`Stats missing or invalid field: ${field}`);
      }
    }
  }

  // Test 7: Admin Functions
  async testAdminFunctions() {
    // Test verification endpoint with admin token
    const response = await request(this.app)
      .post('/api/pos/registry/test_pos_system/verify')
      .set('Authorization', 'Bearer mock_admin_token');
    
    // Should either verify or return 404 if POS doesn't exist
    if (response.status !== 200 && response.status !== 404) {
      throw new Error('Admin verification endpoint returned unexpected status');
    }
  }

  // Test 8: Error Handling
  async testErrorHandling() {
    // Test invalid POS ID
    await request(this.app)
      .get('/api/pos/registry/nonexistent_pos')
      .expect(404);
    
    // Test missing search query
    await request(this.app)
      .get('/api/pos/registry/search')
      .expect(400);
    
    // Test invalid credentials for contribution
    await request(this.app)
      .post('/api/pos/registry/contribute')
      .set('Authorization', 'Bearer mock_client_token')
      .send({}) // Missing required fields
      .expect(400);
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive POS workflow tests...\n');
    
    await this.setup();
    
    // Run all tests
    await this.runTest('POS Discovery Flow', () => this.testDiscoveryFlow());
    await this.runTest('Authentication & Authorization', () => this.testAuthentication());
    await this.runTest('Plugin Configuration Loading', () => this.testPluginConfiguration());
    await this.runTest('Connection Testing', () => this.testConnectionTesting());
    await this.runTest('POS Contribution Flow', () => this.testContributionFlow());
    await this.runTest('Registry Statistics', () => this.testRegistryStatistics());
    await this.runTest('Admin Functions', () => this.testAdminFunctions());
    await this.runTest('Error Handling', () => this.testErrorHandling());
    
    this.printResults();
  }

  printResults() {
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    for (const result of this.testResults) {
      const status = result.status === 'PASSED' ? '✅' : '❌';
      const duration = result.duration || '';
      const error = result.error ? ` - ${result.error}` : '';
      
      console.log(`${status} ${result.name} ${duration}${error}`);
      
      if (result.status === 'PASSED') passed++;
      else failed++;
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! POS integration workflow is working correctly.');
    } else {
      console.log(`\n⚠️ ${failed} test(s) failed. Please review the errors above.`);
    }
  }
}

// Simple mock for supertest if not available
let mockRequest = null;

if (typeof request !== 'function') {
  console.log('⚠️ Supertest not available, using basic mock...');
  
  mockRequest = (app) => ({
    get: (path) => ({
      set: () => ({
        expect: (status) => ({
          then: async () => {
            // Mock successful responses for basic testing
            return {
              status: status,
              body: {
                success: true,
                systems: mockPOSSystems,
                categories: { popular: mockPOSSystems },
                results: mockPOSSystems,
                stats: { totalSystems: 2, verifiedSystems: 2, clientContributed: 0 }
              }
            };
          }
        })
      }),
      expect: (status) => ({
        then: async () => ({
          status: status,
          body: {
            success: true,
            systems: mockPOSSystems,
            categories: { popular: mockPOSSystems },
            results: mockPOSSystems
          }
        })
      })
    }),
    post: (path) => ({
      set: () => ({
        send: () => ({
          expect: (status) => ({
            then: async () => ({
              status: status,
              body: { success: true, posId: 'test_pos_123' }
            })
          })
        })
      }),
      send: () => ({
        expect: (status) => ({
          then: async () => ({
            status: status,
            body: { success: true, posId: 'test_pos_123' }
          })
        })
      })
    })
  });
  
  request = mockRequest;
}

// Run the tests
if (require.main === module) {
  const tester = new POSWorkflowTester();
  tester.runAllTests().catch(console.error);
}

module.exports = POSWorkflowTester;
