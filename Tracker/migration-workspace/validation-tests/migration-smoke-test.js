// Migration Smoke Test Suite
const { exec } = require('child_process');
const fs = require('fs');

const tests = [
    {
        name: 'Build Test',
        command: 'npm run build',
        timeout: 120000
    },
    {
        name: 'TypeScript Check',
        command: 'npm run typecheck',
        timeout: 60000
    },
    {
        name: 'Lint Check',
        command: 'npm run lint',
        timeout: 30000
    },
    {
        name: 'Unit Tests',
        command: 'npm run test:unit',
        timeout: 60000
    },
    {
        name: 'Frontend Build',
        command: 'cd frontend && npm run build',
        timeout: 120000
    }
];

async function runMigrationTests() {
    console.log('🧪 Running Migration Validation Tests...');
    
    const results = [];
    
    for (const test of tests) {
        console.log(`\n🔍 Running: ${test.name}`);
        
        try {
            await new Promise((resolve, reject) => {
                const process = exec(test.command, { timeout: test.timeout });
                
                process.on('exit', (code) => {
                    if (code === 0) {
                        console.log(`✅ ${test.name} - PASSED`);
                        results.push({ test: test.name, status: 'PASSED' });
                        resolve();
                    } else {
                        console.log(`❌ ${test.name} - FAILED (exit code: ${code})`);
                        results.push({ test: test.name, status: 'FAILED', code });
                        reject(new Error(`Test failed: ${test.name}`));
                    }
                });
                
                process.on('error', (error) => {
                    console.log(`❌ ${test.name} - ERROR: ${error.message}`);
                    results.push({ test: test.name, status: 'ERROR', error: error.message });
                    reject(error);
                });
            });
        } catch (error) {
            // Continue with next test even if current one fails
        }
    }
    
    // Write results to file
    fs.writeFileSync(
        'migration-workspace/logs/validation-results.json', 
        JSON.stringify(results, null, 2)
    );
    
    console.log('\n📊 Migration Validation Complete');
    console.log('Results saved to: migration-workspace/logs/validation-results.json');
    
    const passed = results.filter(r => r.status === 'PASSED').length;
    const total = results.length;
    console.log(`Score: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All tests passed - ready for migration!');
        process.exit(0);
    } else {
        console.log('⚠️  Some tests failed - review before proceeding');
        process.exit(1);
    }
}

runMigrationTests().catch(console.error);
