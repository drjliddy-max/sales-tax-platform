#!/bin/bash

# Sales Tax Tracker - Migration Workspace Setup
# Prepares environment for code migrations, refactoring, and major changes

echo "🔄 Setting up Migration Workspace..."
echo "===================================="

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[MIGRATION]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 1. CREATE BACKUP BEFORE MIGRATION
print_status "Creating pre-migration backup..."
./scripts/backup-system.sh || print_warning "Backup script not found - manual backup recommended"

# 2. SETUP MIGRATION BRANCHES
print_status "Setting up git branches for migration..."

# Create migration branch if it doesn't exist
CURRENT_BRANCH=$(git branch --show-current)
MIGRATION_BRANCH="migration-$(date +%Y%m%d-%H%M%S)"

git checkout -b "$MIGRATION_BRANCH" 2>/dev/null || print_warning "Could not create migration branch"
print_status "Created migration branch: $MIGRATION_BRANCH"

# Create feature branches for different migration types
FEATURE_BRANCHES=(
    "feature/database-migration"
    "feature/auth-migration" 
    "feature/deployment-migration"
    "feature/architecture-refactor"
    "feature/performance-optimization"
)

for branch in "${FEATURE_BRANCHES[@]}"; do
    git checkout -b "$branch" "$MIGRATION_BRANCH" 2>/dev/null || true
done

git checkout "$MIGRATION_BRANCH"
print_success "Feature branches created for different migration types"

# 3. SETUP TESTING ENVIRONMENT
print_status "Setting up testing environment for migrations..."

# Ensure test databases are clean
npm run test:setup 2>/dev/null || print_warning "Test setup command not available"

# Run initial test suite to establish baseline
print_status "Running baseline tests..."
npm run test:all > migration-baseline-tests.log 2>&1 || print_warning "Some tests failed - check migration-baseline-tests.log"

# 4. SETUP MONITORING FOR MIGRATIONS
print_status "Setting up migration monitoring..."

# Create migration tracking directory
mkdir -p migration-workspace/{backups,logs,reports,rollback-scripts,validation-tests}

# Create migration log
cat > migration-workspace/migration-progress.md << EOF
# Migration Progress Log
Started: $(date)
Branch: $MIGRATION_BRANCH
Original Branch: $CURRENT_BRANCH

## Pre-Migration Checklist
- [ ] Backup created
- [ ] Tests passing
- [ ] Dependencies updated
- [ ] Documentation reviewed

## Migration Tasks
- [ ] Database schema updates
- [ ] Authentication system migration
- [ ] Deployment configuration
- [ ] Performance optimizations
- [ ] Code architecture improvements

## Post-Migration Validation
- [ ] All tests passing
- [ ] Performance metrics acceptable
- [ ] Deployment successful
- [ ] User acceptance testing complete

## Rollback Plan
- Branch: $CURRENT_BRANCH
- Backup location: migration-workspace/backups/
- Database restore: [TBD]

EOF

# 5. SETUP DEVELOPMENT TOOLS FOR MIGRATION
print_status "Setting up development tools..."

# Ensure all MCP servers are available for migration assistance
claude mcp add filesystem npx -y @modelcontextprotocol/server-filesystem /Users/johnliddy/sales-tax-tracker 2>/dev/null || true
claude mcp add git npx -y @modelcontextprotocol/server-git --repository /Users/johnliddy/sales-tax-tracker 2>/dev/null || true

# 6. CREATE MIGRATION HELPER SCRIPTS
print_status "Creating migration helper scripts..."

# Database migration helper
cat > migration-workspace/db-migration-helper.sh << 'EOF'
#!/bin/bash
# Database Migration Helper

echo "🗄️  Database Migration Helper"
echo "============================="

case "$1" in
    "backup")
        echo "Creating database backup..."
        npm run db:backup || echo "Manual backup required"
        ;;
    "migrate")
        echo "Running migrations..."
        npm run db:migrate
        ;;
    "rollback")
        echo "Rolling back last migration..."
        npm run db:rollback || echo "Manual rollback required"
        ;;
    "seed")
        echo "Seeding database..."
        npm run db:seed
        ;;
    *)
        echo "Usage: $0 {backup|migrate|rollback|seed}"
        ;;
esac
EOF

# Code migration helper
cat > migration-workspace/code-migration-helper.sh << 'EOF'
#!/bin/bash
# Code Migration Helper

echo "🔧 Code Migration Helper"
echo "========================"

case "$1" in
    "typescript")
        echo "Running TypeScript migration checks..."
        npx tsc --noEmit --project ./
        npx tsc --noEmit --project ./frontend/
        ;;
    "lint")
        echo "Running code quality checks..."
        npm run lint
        cd frontend && npm run lint && cd ..
        ;;
    "test")
        echo "Running test suite..."
        npm run test:all
        ;;
    "build")
        echo "Testing builds..."
        npm run build
        ;;
    *)
        echo "Usage: $0 {typescript|lint|test|build}"
        ;;
esac
EOF

# Deployment migration helper  
cat > migration-workspace/deploy-migration-helper.sh << 'EOF'
#!/bin/bash
# Deployment Migration Helper

echo "🚀 Deployment Migration Helper"
echo "==============================="

case "$1" in
    "staging")
        echo "Deploying to staging..."
        cd frontend && vercel --yes
        ;;
    "production")
        echo "Deploying to production..."
        cd frontend && vercel --prod --yes
        ;;
    "rollback")
        echo "Rolling back deployment..."
        cd frontend && vercel rollback --yes
        ;;
    *)
        echo "Usage: $0 {staging|production|rollback}"
        ;;
esac
EOF

chmod +x migration-workspace/*.sh

print_success "Migration helper scripts created"

# 7. SETUP ENVIRONMENT VALIDATION
print_status "Validating migration environment..."

# Check required tools
REQUIRED_TOOLS=("node" "npm" "git" "claude" "vercel")
MISSING_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
        MISSING_TOOLS+=("$tool")
    fi
done

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    print_warning "Missing tools: ${MISSING_TOOLS[*]}"
    print_warning "Install missing tools before proceeding with migrations"
else
    print_success "All required tools available"
fi

# 8. CREATE VALIDATION TESTS FOR MIGRATIONS
print_status "Creating migration validation tests..."

cat > migration-workspace/validation-tests/migration-smoke-test.js << 'EOF'
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
EOF

print_success "Migration validation tests created"

echo ""
echo "🎯 MIGRATION WORKSPACE READY!"
echo "=============================="
echo ""
echo "📁 Migration Files:"
echo "   Progress Log:      migration-workspace/migration-progress.md"
echo "   Helper Scripts:    migration-workspace/*.sh"
echo "   Validation Tests:  migration-workspace/validation-tests/"
echo "   Logs:              migration-workspace/logs/"
echo "   Backups:           migration-workspace/backups/"
echo ""
echo "🔧 Migration Commands:"
echo "   Database:          ./migration-workspace/db-migration-helper.sh {backup|migrate|rollback|seed}"
echo "   Code Quality:      ./migration-workspace/code-migration-helper.sh {typescript|lint|test|build}"
echo "   Deployment:        ./migration-workspace/deploy-migration-helper.sh {staging|production|rollback}"
echo "   Validation:        node migration-workspace/validation-tests/migration-smoke-test.js"
echo ""
echo "🌿 Git Branches Created:"
echo "   Main Branch:       $MIGRATION_BRANCH"
for branch in "${FEATURE_BRANCHES[@]}"; do
    echo "   Feature:           $branch"
done
echo ""
echo "💡 Next Steps:"
echo "   1. Review migration-workspace/migration-progress.md"
echo "   2. Run validation tests: node migration-workspace/validation-tests/migration-smoke-test.js"
echo "   3. Start specific migration tasks using helper scripts"
echo "   4. Use Claude Code with all MCP servers for enhanced development"
echo ""
print_success "Migration workspace ready! Happy coding! 🚀"