#!/bin/bash

# Sales Tax Tracker - Development Startup Script
# This script ensures proper setup and starts the development environment

set -e  # Exit on any error

echo "🚀 Sales Tax Tracker - Development Startup"
echo "============================================"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "frontend" ] || [ ! -d "src" ]; then
    echo "❌ Error: Please run this script from the sales-tax-tracker root directory"
    echo "   Expected directory: /Users/johnliddy/sales-tax-tracker"
    echo "   Current directory: $(pwd)"
    exit 1
fi

echo "✅ Correct directory confirmed"

# Check for required tools
echo ""
echo "🔍 Checking required tools..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old. Required: 18+, Found: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) - OK"
echo "✅ npm $(npm --version) - OK"

# Check port availability
echo ""
echo "🔍 Checking port availability..."

if port_in_use 3001; then
    echo "⚠️  Port 3001 is already in use (Frontend)"
    echo "   You may need to stop other development servers"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Development startup cancelled"
        exit 1
    fi
else
    echo "✅ Port 3001 (Frontend) - Available"
fi

if port_in_use 3002; then
    echo "⚠️  Port 3002 is already in use (Backend)"
    echo "   You may need to stop other development servers"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Development startup cancelled"
        exit 1
    fi
else
    echo "✅ Port 3002 (Backend) - Available"
fi

# Check dependencies
echo ""
echo "🔍 Checking dependencies..."

if [ ! -d "node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
else
    echo "✅ Backend dependencies - OK"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
else
    echo "✅ Frontend dependencies - OK"
fi

# Check environment files
echo ""
echo "🔍 Checking environment configuration..."

if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found in root directory"
    echo "   Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file - please configure your variables"
    else
        echo "❌ No .env.example file found"
    fi
else
    echo "✅ Backend .env file - OK"
fi

if [ ! -f "frontend/.env" ]; then
    echo "⚠️  No .env file found in frontend directory"
    echo "   Creating from frontend/.env.example..."
    if [ -f "frontend/.env.example" ]; then
        cp frontend/.env.example frontend/.env
        echo "✅ Created frontend/.env file - please configure your variables"
    else
        echo "ℹ️  No frontend/.env.example file found - this is optional"
    fi
else
    echo "✅ Frontend .env file - OK"
fi

# Database check
echo ""
echo "🔍 Checking database..."

if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Prisma schema found"
    
    # Check if DATABASE_URL is set
    if grep -q "DATABASE_URL=" .env 2>/dev/null; then
        echo "✅ Database URL configured"
    else
        echo "⚠️  DATABASE_URL not found in .env file"
        echo "   Please configure your database connection"
    fi
else
    echo "⚠️  No Prisma schema found"
fi

# Type checking
echo ""
echo "🔍 Running quick type check..."

echo "   Checking backend TypeScript..."
if npm run typecheck --silent; then
    echo "✅ Backend TypeScript - OK"
else
    echo "⚠️  Backend TypeScript issues found - continuing anyway"
fi

echo "   Checking frontend TypeScript..."
if cd frontend && npm run type-check --silent && cd ..; then
    echo "✅ Frontend TypeScript - OK"
else
    echo "⚠️  Frontend TypeScript issues found - continuing anyway"
fi

# Final summary and start
echo ""
echo "🎉 Pre-flight checks complete!"
echo ""
echo "📋 Development Environment Summary:"
echo "   • Backend API: http://localhost:3002"
echo "   • Frontend App: http://localhost:3001"
echo "   • API Health: http://localhost:3002/api/health"
echo "   • Architecture: React Frontend + Node.js Backend"
echo ""
echo "🚀 Starting development servers..."
echo "   Press Ctrl+C to stop both servers"
echo ""

# Start the development environment
npm run dev
