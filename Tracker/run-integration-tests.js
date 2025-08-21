#!/usr/bin/env node
/**
 * Master Integration Test Runner
 * Coordinates and runs all POS integration tests
 */

const path = require('path');
const fs = require('fs');

class MasterTestRunner {
  constructor() {
    this.results = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      suites: []
    };
  }

  async runTestSuite(suiteName, TestClass, testFile) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Running Test Suite: ${suiteName}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Check if test file exists
      if (!fs.existsSync(testFile)) {
        throw new Error(`Test file not found: ${testFile}`);
      }

      const tester = new TestClass();
      await tester.runAllTests();
      
      const suiteResults = {
        name: suiteName,
        status: 'COMPLETED',
        tests: tester.testResults || [],
        passed: (tester.testResults || []).filter(t => t.status === 'PASSED').length,
        failed: (tester.testResults || []).filter(t => t.status === 'FAILED').length
      };
      
      this.results.suites.push(suiteResults);
      this.results.totalTests += suiteResults.tests.length;
      this.results.passed += suiteResults.passed;
      this.results.failed += suiteResults.failed;
      
      console.log(`\n✅ Test Suite "${suiteName}" completed: ${suiteResults.passed} passed, ${suiteResults.failed} failed`);
      
    } catch (error) {
      console.error(`\n❌ Test Suite "${suiteName}" failed: ${error.message}`);
      
      this.results.suites.push({
        name: suiteName,
        status: 'FAILED',
        error: error.message,
        tests: [],
        passed: 0,
        failed: 1
      });
      
      this.results.totalTests += 1;
      this.results.failed += 1;
    }
  }

  async runAllTests() {
    console.log('🚀 Starting POS Integration Test Suite');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Working Directory: ${process.cwd()}`);

    const startTime = Date.now();

    try {
      // Test 1: Backend POS System Infrastructure
      console.log('\n📍 Phase 1: Backend Infrastructure Testing');
      try {
        const POSWorkflowTester = require('./test-pos-workflow.js');
        await this.runTestSuite(
          'POS Backend Workflow',
          POSWorkflowTester,
          path.join(__dirname, 'test-pos-workflow.js')
        );
      } catch (error) {
        console.error('❌ Backend workflow test failed to load:', error.message);
        this.results.failed += 1;
        this.results.totalTests += 1;
      }

      // Test 2: Frontend Component Integration
      console.log('\n📍 Phase 2: Frontend Component Testing');
      try {
        // Change to frontend directory for component testing
        const originalCwd = process.cwd();
        process.chdir(path.join(__dirname, 'frontend'));
        
        const FrontendComponentTester = require('../frontend/test-component-integration.js');
        await this.runTestSuite(
          'Frontend Components',
          FrontendComponentTester,
          path.join(__dirname, 'frontend', 'test-component-integration.js')
        );
        
        // Change back to original directory
        process.chdir(originalCwd);
      } catch (error) {
        console.error('❌ Frontend component test failed to load:', error.message);
        this.results.failed += 1;
        this.results.totalTests += 1;
      }

      // Test 3: Basic Backend Integration Tests
      console.log('\n📍 Phase 3: Basic Backend Integration');
      try {
        await this.runBasicBackendTests();
      } catch (error) {
        console.error('❌ Basic backend tests failed:', error.message);
      }

      // Test 4: Configuration and Dependencies
      console.log('\n📍 Phase 4: Configuration Validation');
      await this.runConfigurationTests();

    } catch (error) {
      console.error('❌ Test runner encountered an error:', error);
    }

    const duration = Date.now() - startTime;
    this.printFinalResults(duration);
  }

  async runBasicBackendTests() {
    const basicTests = [
      {
        name: 'POS Database Adapter',
        test: async () => {
          const { posAdapter } = require('./backend/src/lib/database/POSAdapter');
          await posAdapter.initializeDefaults();
          const systems = await posAdapter.getAllPOSSystems();
          if (systems.length === 0) {
            throw new Error('No POS systems found in adapter');
          }
        }
      },
      {
        name: 'POS Initializer',
        test: async () => {
          const { posInitializer } = require('./backend/src/lib/pos/POSInitializer');
          await posInitializer.initialize();
          if (!posInitializer.isInitialized()) {
            throw new Error('POS initializer failed to initialize');
          }
        }
      },
      {
        name: 'Authentication Middleware',
        test: async () => {
          const { authenticateToken } = require('./backend/src/api/middleware/auth');
          if (typeof authenticateToken !== 'function') {
            throw new Error('authenticateToken is not a function');
          }
        }
      },
      {
        name: 'Configuration Loading',
        test: async () => {
          const { config } = require('./backend/src/config');
          if (!config.server || !config.auth) {
            throw new Error('Configuration is incomplete');
          }
        }
      }
    ];

    let passed = 0;
    let failed = 0;
    const testResults = [];

    for (const basicTest of basicTests) {
      try {
        console.log(`   Testing: ${basicTest.name}`);
        await basicTest.test();
        console.log(`   ✅ ${basicTest.name} passed`);
        testResults.push({ name: basicTest.name, status: 'PASSED' });
        passed++;
      } catch (error) {
        console.log(`   ❌ ${basicTest.name} failed: ${error.message}`);
        testResults.push({ name: basicTest.name, status: 'FAILED', error: error.message });
        failed++;
      }
    }

    this.results.suites.push({
      name: 'Basic Backend Integration',
      status: failed === 0 ? 'COMPLETED' : 'PARTIAL',
      tests: testResults,
      passed,
      failed
    });

    this.results.totalTests += basicTests.length;
    this.results.passed += passed;
    this.results.failed += failed;
  }

  async runConfigurationTests() {
    const configTests = [
      {
        name: 'Backend Package Dependencies',
        test: () => {
          const packagePath = path.join(__dirname, 'backend', 'package.json');
          if (!fs.existsSync(packagePath)) {
            throw new Error('Backend package.json not found');
          }
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          const requiredDeps = ['express', 'cors', 'helmet', 'jsonwebtoken'];
          for (const dep of requiredDeps) {
            if (!pkg.dependencies[dep] && !pkg.devDependencies[dep]) {
              throw new Error(`Missing dependency: ${dep}`);
            }
          }
        }
      },
      {
        name: 'Frontend Package Dependencies',
        test: () => {
          const packagePath = path.join(__dirname, 'frontend', 'package.json');
          if (!fs.existsSync(packagePath)) {
            throw new Error('Frontend package.json not found');
          }
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          const requiredDeps = ['react', 'react-dom', 'lucide-react'];
          for (const dep of requiredDeps) {
            if (!pkg.dependencies[dep] && !pkg.devDependencies[dep]) {
              throw new Error(`Missing dependency: ${dep}`);
            }
          }
        }
      },
      {
        name: 'TypeScript Configuration',
        test: () => {
          const tsConfigPath = path.join(__dirname, 'frontend', 'tsconfig.json');
          if (!fs.existsSync(tsConfigPath)) {
            throw new Error('TypeScript configuration not found');
          }
        }
      },
      {
        name: 'POS Type Definitions',
        test: () => {
          const typesPath = path.join(__dirname, 'frontend', 'src', 'types', 'pos.ts');
          if (!fs.existsSync(typesPath)) {
            throw new Error('POS type definitions not found');
          }
          const content = fs.readFileSync(typesPath, 'utf8');
          if (!content.includes('POSSystem') || !content.includes('POSConnection')) {
            throw new Error('Essential POS types not defined');
          }
        }
      }
    ];

    let passed = 0;
    let failed = 0;
    const testResults = [];

    for (const configTest of configTests) {
      try {
        console.log(`   Checking: ${configTest.name}`);
        configTest.test();
        console.log(`   ✅ ${configTest.name} passed`);
        testResults.push({ name: configTest.name, status: 'PASSED' });
        passed++;
      } catch (error) {
        console.log(`   ❌ ${configTest.name} failed: ${error.message}`);
        testResults.push({ name: configTest.name, status: 'FAILED', error: error.message });
        failed++;
      }
    }

    this.results.suites.push({
      name: 'Configuration Validation',
      status: failed === 0 ? 'COMPLETED' : 'PARTIAL',
      tests: testResults,
      passed,
      failed
    });

    this.results.totalTests += configTests.length;
    this.results.passed += passed;
    this.results.failed += failed;
  }

  printFinalResults(duration) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 FINAL TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);
    
    console.log('\n📋 Test Suite Summary:');
    console.log('-'.repeat(80));
    
    for (const suite of this.results.suites) {
      const status = suite.status === 'COMPLETED' && suite.failed === 0 ? '✅' : 
                    suite.status === 'PARTIAL' ? '⚠️' : '❌';
      console.log(`${status} ${suite.name}: ${suite.passed || 0} passed, ${suite.failed || 0} failed`);
    }
    
    if (this.results.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! POS integration is ready for production.');
      console.log('\n🚀 Next Steps:');
      console.log('   1. Deploy backend API endpoints');
      console.log('   2. Build and deploy frontend components');
      console.log('   3. Configure authentication and permissions');
      console.log('   4. Set up monitoring and logging');
    } else {
      console.log(`\n⚠️  ${this.results.failed} test(s) failed. Please review and fix the issues above.`);
      console.log('\n🔧 Troubleshooting:');
      console.log('   1. Check for missing dependencies');
      console.log('   2. Verify file paths and imports');
      console.log('   3. Review error messages in test output');
      console.log('   4. Run individual test suites for detailed debugging');
    }
    
    // Save results to file
    try {
      const resultsFile = path.join(__dirname, 'test-results.json');
      fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
      console.log(`\n💾 Test results saved to: ${resultsFile}`);
    } catch (error) {
      console.log('\n⚠️ Could not save test results to file');
    }
    
    console.log('\n' + '='.repeat(80));
    
    // Set exit code based on results
    process.exitCode = this.results.failed > 0 ? 1 : 0;
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new MasterTestRunner();
  runner.runAllTests().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = MasterTestRunner;
