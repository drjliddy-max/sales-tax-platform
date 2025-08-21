/**
 * Simple test script to validate POS system integration
 * Run with: node test-pos-integration.js
 */

async function testPOSIntegration() {
  console.log('🧪 Testing POS Integration...');
  
  try {
    // Test database adapter
    console.log('\n1. Testing POSAdapter...');
    const { posAdapter } = require('./src/lib/database/POSAdapter');
    
    await posAdapter.initializeDefaults();
    const systems = await posAdapter.getAllPOSSystems();
    console.log(`   ✅ Found ${systems.length} POS systems in adapter`);
    
    // Test search functionality
    const searchResults = await posAdapter.searchPOSSystems('Square');
    console.log(`   ✅ Search for 'Square' returned ${searchResults.length} results`);
    
    // Test statistics
    const stats = await posAdapter.getRegistryStats();
    console.log(`   ✅ Registry stats: ${stats.totalSystems} systems, ${stats.verifiedSystems} verified`);
    
    // Test POS initializer
    console.log('\n2. Testing POSInitializer...');
    const { posInitializer } = require('./src/lib/pos/POSInitializer');
    
    await posInitializer.initialize();
    console.log(`   ✅ POS initializer completed: ${posInitializer.isInitialized()}`);
    
    // Test authentication middleware
    console.log('\n3. Testing Authentication Middleware...');
    const { authenticateToken } = require('./src/api/middleware/auth');
    console.log('   ✅ Authentication middleware loaded');
    
    // Test config
    console.log('\n4. Testing Configuration...');
    const { config } = require('./src/config');
    console.log(`   ✅ Config loaded: ${config.server.environment} environment`);
    
    console.log('\n🎉 All POS integration tests passed!');
    
  } catch (error) {
    console.error('\n❌ POS integration test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testPOSIntegration().catch(console.error);
