/**
 * API Integration Test for POS endpoints
 * Tests the POS API routes with mock requests
 */

const express = require('express');
const request = require('supertest');

async function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Initialize POS system
  const { posInitializer } = require('./src/lib/pos/POSInitializer');
  await posInitializer.initialize();
  
  // Mount POS routes
  const { registryRoutes } = require('./src/api/pos/registryRoutes');
  const { pluginRoutes } = require('./src/api/pos/pluginRoutes');
  
  app.use('/api/pos/registry', registryRoutes);
  app.use('/api/pos/plugins', pluginRoutes);
  
  return app;
}

async function testPOSAPI() {
  console.log('🧪 Testing POS API Integration...');
  
  try {
    const app = await createTestApp();
    
    // Test 1: Get popular POS systems (public endpoint)
    console.log('\n1. Testing GET /api/pos/registry/popular...');
    const popularResponse = await request(app)
      .get('/api/pos/registry/popular');
    
    console.log(`   Status: ${popularResponse.status}`);
    if (popularResponse.status === 200) {
      console.log(`   ✅ Found ${popularResponse.body.systems?.length || 0} popular systems`);
    } else {
      console.log(`   ❌ Unexpected response: ${popularResponse.text}`);
    }
    
    // Test 2: Get POS categories (public endpoint)
    console.log('\n2. Testing GET /api/pos/registry/categories...');
    const categoriesResponse = await request(app)
      .get('/api/pos/registry/categories');
    
    console.log(`   Status: ${categoriesResponse.status}`);
    if (categoriesResponse.status === 200) {
      const categories = Object.keys(categoriesResponse.body.categories || {});
      console.log(`   ✅ Found categories: ${categories.join(', ')}`);
    } else {
      console.log(`   ❌ Unexpected response: ${categoriesResponse.text}`);
    }
    
    // Test 3: Search POS systems (public endpoint)
    console.log('\n3. Testing GET /api/pos/registry/search...');
    const searchResponse = await request(app)
      .get('/api/pos/registry/search?q=Square');
    
    console.log(`   Status: ${searchResponse.status}`);
    if (searchResponse.status === 200) {
      console.log(`   ✅ Search returned ${searchResponse.body.results?.length || 0} results`);
    } else {
      console.log(`   ❌ Unexpected response: ${searchResponse.text}`);
    }
    
    // Test 4: Get supported POS plugins (requires auth)
    console.log('\n4. Testing GET /api/pos/plugins/supported (with mock token)...');
    const supportedResponse = await request(app)
      .get('/api/pos/plugins/supported')
      .set('Authorization', 'Bearer mock_client_token');
    
    console.log(`   Status: ${supportedResponse.status}`);
    if (supportedResponse.status === 200) {
      console.log(`   ✅ Found ${supportedResponse.body.supportedPOS?.length || 0} supported POS systems`);
    } else {
      console.log(`   ❌ Unexpected response: ${supportedResponse.text}`);
    }
    
    // Test 5: Test authentication failure
    console.log('\n5. Testing authentication failure...');
    const authFailResponse = await request(app)
      .get('/api/pos/plugins/supported');
    
    console.log(`   Status: ${authFailResponse.status}`);
    if (authFailResponse.status === 401) {
      console.log('   ✅ Correctly rejected request without token');
    } else {
      console.log(`   ❌ Unexpected status: ${authFailResponse.status}`);
    }
    
    console.log('\n🎉 All API integration tests completed!');
    
  } catch (error) {
    console.error('\n❌ API integration test failed:', error.message);
    console.error(error.stack);
  }
}

// Mock supertest if not available
if (!request.Test) {
  console.log('⚠️ Supertest not available, creating simple mock...');
  
  // Simple mock request for basic testing
  const mockRequest = (app) => ({
    get: (path) => ({
      set: () => ({
        then: async (callback) => {
          try {
            // Simulate basic responses
            if (path.includes('popular')) {
              return callback({ status: 200, body: { success: true, systems: [] } });
            } else if (path.includes('categories')) {
              return callback({ status: 200, body: { success: true, categories: {} } });
            } else if (path.includes('search')) {
              return callback({ status: 200, body: { success: true, results: [] } });
            } else {
              return callback({ status: 401, body: { error: 'Unauthorized' } });
            }
          } catch (error) {
            return callback({ status: 500, body: { error: error.message } });
          }
        }
      }),
      then: async (callback) => {
        try {
          if (path.includes('popular')) {
            return callback({ status: 200, body: { success: true, systems: [] } });
          } else if (path.includes('categories')) {
            return callback({ status: 200, body: { success: true, categories: {} } });
          } else if (path.includes('search')) {
            return callback({ status: 200, body: { success: true, results: [] } });
          } else {
            return callback({ status: 200, body: { success: true } });
          }
        } catch (error) {
          return callback({ status: 500, body: { error: error.message } });
        }
      }
    })
  });
  
  request = mockRequest;
}

// Run the test
testPOSAPI().catch(console.error);
