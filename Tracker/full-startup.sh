#!/bin/bash

# Sales Tax Tracker - Full Application Startup Script
# Prepares complete development environment with all services and MCP servers

set -e  # Exit on any error

echo "🚀 Sales Tax Tracker - Full Application Startup"
echo "================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
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

# 1. ENVIRONMENT SETUP
print_status "Setting up environment..."

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "frontend" ]; then
    print_error "Not in sales-tax-tracker root directory!"
    echo "Please run this script from the sales-tax-tracker root directory"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

print_success "Environment checks passed"

# 2. DEPENDENCY INSTALLATION
print_status "Installing dependencies..."

# Root dependencies
npm install --silent

# Frontend dependencies
cd frontend
npm install --silent
cd ..

print_success "Dependencies installed"

# 3. DATABASE SETUP
print_status "Setting up database..."

# Check if .env exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_warning "No .env file found, copying from .env.example"
        cp .env.example .env
        print_warning "Please update .env with your actual credentials"
    else
        print_error "No .env.example file found!"
        exit 1
    fi
fi

# Setup Prisma database
if command -v prisma &> /dev/null; then
    print_status "Running Prisma migrations..."
    npx prisma generate
    npx prisma db push --accept-data-loss || print_warning "Database push failed - may need manual setup"
else
    print_warning "Prisma not available - database setup skipped"
fi

print_success "Database setup completed"

# 4. MCP SERVERS SETUP
print_status "Setting up MCP servers..."

# Kill any existing MCP processes
pkill -f "firecrawl-mcp" 2>/dev/null || true
pkill -f "@clerk/agent-toolkit" 2>/dev/null || true
pkill -f "@playwright/mcp" 2>/dev/null || true
pkill -f "@upstash/context7-mcp" 2>/dev/null || true
pkill -f "redis-server" 2>/dev/null || true

sleep 2

# Check if Claude CLI is available
if ! command -v claude &> /dev/null; then
    print_error "Claude CLI not found!"
    echo "Please install Claude CLI: https://docs.anthropic.com/en/docs/claude-code"
    exit 1
fi

# Add MCP servers to Claude configuration
print_status "Configuring MCP servers..."

# Firecrawl MCP
claude mcp add firecrawl npx -y firecrawl-mcp || print_warning "Firecrawl MCP setup failed"

# Clerk MCP  
claude mcp add clerk npx -y @clerk/agent-toolkit -p=local-mcp || print_warning "Clerk MCP setup failed"

# Playwright MCP
claude mcp add playwright npx @playwright/mcp@latest || print_warning "Playwright MCP setup failed"

# Context7 MCP
claude mcp add context7 npx @upstash/context7-mcp --transport stdio || print_warning "Context7 MCP setup failed"

print_success "MCP servers configured"

# 5. START SERVICES
print_status "Starting application services..."

# Start Redis if available
if command -v redis-server &> /dev/null; then
    print_status "Starting Redis server..."
    redis-server --daemonize yes --port 6379 || print_warning "Redis startup failed"
    sleep 2
else
    print_warning "Redis not found - some features may not work"
fi

# 6. BUILD VERIFICATION
print_status "Verifying builds..."

# Test backend build
print_status "Testing backend build..."
npm run build 2>/dev/null || print_warning "Backend build failed - may need fixes"

# Test frontend build
print_status "Testing frontend build..."
cd frontend
npm run build 2>/dev/null || print_warning "Frontend build failed - may need fixes"
cd ..

print_success "Build verification completed"

# 7. START APPLICATION
print_status "Starting development servers..."

# Create startup functions for background processes
start_backend() {
    print_status "Starting backend server on port 3000..."
    npm run dev:backend > logs/backend.log 2>&1 &
    echo $! > .backend.pid
}

start_frontend() {
    print_status "Starting frontend server on port 3001..."
    cd frontend
    npm run dev > ../logs/frontend.log 2>&1 &
    echo $! > ../.frontend.pid
    cd ..
}

start_mcp_servers() {
    print_status "Starting MCP servers..."
    
    # Start Context7 for enhanced code intelligence
    CONTEXT7_PROJECT_PATH="$(pwd)" NODE_ENV="development" npx @upstash/context7-mcp --transport http --port 3002 > logs/context7.log 2>&1 &
    echo $! > .context7.pid
    
    sleep 3
}

# Create logs directory
mkdir -p logs

# Start all services
start_mcp_servers
start_backend
sleep 5
start_frontend

sleep 10

# 8. HEALTH CHECKS
print_status "Performing health checks..."

# Check if services are running
check_service() {
    local url=$1
    local name=$2
    if curl -s "$url" > /dev/null 2>&1; then
        print_success "$name is running"
        return 0
    else
        print_warning "$name is not responding"
        return 1
    fi
}

# Check backend
check_service "http://localhost:3000/health" "Backend API" || print_warning "Backend may still be starting..."

# Check frontend
check_service "http://localhost:3001" "Frontend" || print_warning "Frontend may still be starting..."

# Check Context7 MCP
check_service "http://localhost:3002" "Context7 MCP" || print_warning "Context7 MCP may still be starting..."

# 9. FINAL STATUS
echo ""
echo "🎉 SALES TAX TRACKER STARTUP COMPLETE!"
echo "========================================"
echo ""
echo "📊 Application URLs:"
echo "   Frontend:  http://localhost:3001"
echo "   Backend:   http://localhost:3000"
echo "   Context7:  http://localhost:3002"
echo ""
echo "🔧 Development Tools:"
echo "   API Docs:  http://localhost:3000/api-docs (if available)"
echo "   Database:  Check .env for connection details"
echo ""
echo "📁 Key Directories:"
echo "   Frontend:  ./frontend/"
echo "   Backend:   ./src/"
echo "   Tests:     ./tests/"
echo "   Docs:      ./docs/"
echo ""
echo "🛠️  Available Commands:"
echo "   npm run dev          - Start both frontend & backend"
echo "   npm run test:all     - Run all tests"
echo "   npm run build        - Build entire application"
echo "   npm run typecheck    - TypeScript validation"
echo "   npm run lint         - Code quality check"
echo ""
echo "📝 Migration Commands:"
echo "   npm run db:migrate   - Run database migrations"
echo "   npm run db:seed      - Seed database with sample data"
echo ""
echo "☁️  Deployment:"
echo "   Production URL: https://sales-tax-frontend-5cd3i1ylf-liddy.vercel.app"
echo "   Deploy Command: cd frontend && vercel --prod"
echo ""
echo "📋 Process Management:"
echo "   Backend PID:  $(cat .backend.pid 2>/dev/null || echo 'Not running')"
echo "   Frontend PID: $(cat .frontend.pid 2>/dev/null || echo 'Not running')"
echo "   Context7 PID: $(cat .context7.pid 2>/dev/null || echo 'Not running')"
echo ""
echo "🔧 MCP Status:"
claude mcp list 2>/dev/null || echo "   Run 'claude mcp list' to check MCP servers"
echo ""
echo "📖 Quick Reference:"
echo "   Stop all: ./stop-services.sh"
echo "   Logs:     tail -f logs/*.log"
echo "   Help:     cat CLAUDE.md"
echo ""
print_success "Ready for development, testing, and migration tasks!"