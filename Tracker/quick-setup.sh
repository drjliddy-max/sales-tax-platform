#!/bin/bash

# Sales Tax Tracker - Quick Setup & Migration Ready Script
# One command to rule them all!

echo "⚡ SALES TAX TRACKER - QUICK SETUP"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}$1${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if script is run from correct directory
if [ ! -f "CLAUDE.md" ]; then
    print_error "Please run this script from the sales-tax-tracker root directory"
    exit 1
fi

# Parse command line arguments
SKIP_MIGRATION_SETUP=false
SKIP_APP_START=false
MIGRATION_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-migration)
            SKIP_MIGRATION_SETUP=true
            shift
            ;;
        --skip-app)
            SKIP_APP_START=true
            shift
            ;;
        --migration-only)
            MIGRATION_ONLY=true
            SKIP_APP_START=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-migration    Skip migration workspace setup"
            echo "  --skip-app          Skip application startup"
            echo "  --migration-only    Only setup migration workspace"
            echo "  --help, -h          Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                  # Full setup - app + migration workspace"
            echo "  $0 --skip-migration # Just start the application"
            echo "  $0 --migration-only # Setup migration workspace only"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}Configuration:${NC}"
echo "  Skip Migration Setup: $SKIP_MIGRATION_SETUP"
echo "  Skip App Start: $SKIP_APP_START"
echo "  Migration Only: $MIGRATION_ONLY"
echo ""

# 1. SETUP MIGRATION WORKSPACE (if not skipped)
if [ "$SKIP_MIGRATION_SETUP" = false ]; then
    print_header "🔄 MIGRATION WORKSPACE SETUP"
    if [ -f "setup-migration-workspace.sh" ]; then
        ./setup-migration-workspace.sh
        print_success "Migration workspace setup completed"
    else
        print_warning "Migration workspace script not found"
    fi
    echo ""
fi

# Exit here if migration-only mode
if [ "$MIGRATION_ONLY" = true ]; then
    print_success "Migration workspace setup complete!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Review: migration-workspace/migration-progress.md"
    echo "  2. Validate: node migration-workspace/validation-tests/migration-smoke-test.js"
    echo "  3. Start app: ./quick-setup.sh --skip-migration"
    exit 0
fi

# 2. START FULL APPLICATION (if not skipped)
if [ "$SKIP_APP_START" = false ]; then
    print_header "🚀 FULL APPLICATION STARTUP"
    if [ -f "full-startup.sh" ]; then
        ./full-startup.sh
        print_success "Application startup completed"
    else
        print_error "Application startup script not found!"
        exit 1
    fi
fi

echo ""
print_header "🎉 SETUP COMPLETE!"
echo "=================="
echo ""
echo -e "${CYAN}🌐 Application URLs:${NC}"
echo "   • Frontend (Dev):    http://localhost:3001"
echo "   • Backend (API):     http://localhost:3000"
echo "   • Context7 MCP:      http://localhost:3002"
echo "   • Production:        https://sales-tax-frontend-5cd3i1ylf-liddy.vercel.app"
echo ""
echo -e "${CYAN}📁 Key Directories:${NC}"
echo "   • Frontend Source:   ./frontend/src/"
echo "   • Backend Source:    ./src/"
echo "   • Migration Tools:   ./migration-workspace/"
echo "   • Documentation:     ./docs/"
echo "   • Tests:             ./tests/"
echo ""
echo -e "${CYAN}🛠️  Quick Commands:${NC}"
echo "   • Stop Services:     ./stop-services.sh"
echo "   • View Logs:         tail -f logs/*.log"
echo "   • Run Tests:         npm run test:all"
echo "   • Deploy Frontend:   cd frontend && vercel --prod"
echo "   • Migration Help:    ls migration-workspace/"
echo ""
echo -e "${CYAN}🔧 MCP Servers Active:${NC}"
claude mcp list 2>/dev/null | grep -E "(firecrawl|clerk|playwright|context7|filesystem|git)" || echo "   Use 'claude mcp list' to check status"
echo ""
echo -e "${CYAN}📋 Migration Tools:${NC}"
if [ -d "migration-workspace" ]; then
    echo "   • Progress Log:      migration-workspace/migration-progress.md"
    echo "   • DB Helper:         ./migration-workspace/db-migration-helper.sh"
    echo "   • Code Helper:       ./migration-workspace/code-migration-helper.sh"
    echo "   • Deploy Helper:     ./migration-workspace/deploy-migration-helper.sh"
    echo "   • Validation Tests:  node migration-workspace/validation-tests/migration-smoke-test.js"
else
    echo "   Run with --migration-only to setup migration tools"
fi
echo ""
print_success "Sales Tax Tracker is ready for development, testing, and migration! 🚀"
echo ""
echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "   • Use Claude Code with all MCP servers for enhanced development"
echo "   • Check CLAUDE.md for development guidelines"
echo "   • Run migration validation before major changes"
echo "   • Keep logs/ directory for troubleshooting"