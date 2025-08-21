# Sales Tax Tracker - Complete Startup Guide

## Quick Start (All-in-One)

```bash
# Full application + migration workspace setup
./quick-setup.sh

# Or specific setups:
./quick-setup.sh --skip-migration     # App only
./quick-setup.sh --migration-only     # Migration tools only
./quick-setup.sh --help              # Show all options
```

## Manual Setup Steps

### 1. Basic Application Startup
```bash
# Start full application with MCP servers
./full-startup.sh

# Stop all services
./stop-services.sh
```

### 2. Migration Workspace Setup
```bash
# Setup migration environment
./setup-migration-workspace.sh

# Use migration helper tools
./migration-workspace/db-migration-helper.sh backup
./migration-workspace/code-migration-helper.sh typescript
./migration-workspace/deploy-migration-helper.sh staging
```

### 3. Development Commands
```bash
# Development
npm run dev                    # Start both frontend & backend
npm run dev:frontend           # Frontend only (port 3001)
npm run dev:backend            # Backend only (port 3000)

# Building
npm run build                  # Build entire application
npm run build:frontend         # Frontend only
npm run build:backend          # Backend only

# Testing
npm run test:all               # All tests
npm run test:e2e               # End-to-end tests
npm run test:unit              # Unit tests

# Code Quality
npm run typecheck              # TypeScript validation
npm run lint                   # ESLint check
npm run lint:fix               # Auto-fix linting issues
```

## Application Architecture

### Services & Ports
- **Frontend (React)**: http://localhost:3001
- **Backend (Node.js)**: http://localhost:3000  
- **Context7 MCP**: http://localhost:3002
- **Redis Cache**: localhost:6379
- **PostgreSQL**: localhost:5432

### MCP Servers Configured
- **Firecrawl**: Web scraping for tax rate collection
- **Clerk**: Authentication and user management
- **Playwright**: Browser automation and testing
- **Context7**: Enhanced code intelligence and documentation
- **Filesystem**: Direct file system access
- **Git**: Git repository operations
- **Postgres**: Database operations

### Key Directories
```
sales-tax-tracker/
├── frontend/               # React frontend application
├── src/                   # Backend Node.js application  
├── tests/                 # Test suites (unit, integration, e2e)
├── migration-workspace/   # Migration tools and tracking
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── logs/                  # Application logs
└── dist/                  # Built application files
```

## Migration & Development Workflow

### 1. Before Major Changes
```bash
# Setup migration workspace
./quick-setup.sh --migration-only

# Create backup
./migration-workspace/db-migration-helper.sh backup

# Run baseline validation
node migration-workspace/validation-tests/migration-smoke-test.js
```

### 2. During Development
```bash
# Use Claude Code with MCP servers for enhanced development
claude code

# Run incremental tests
npm run test:watch

# Check code quality
npm run typecheck && npm run lint
```

### 3. Before Deployment
```bash
# Full validation suite
./migration-workspace/code-migration-helper.sh test
./migration-workspace/code-migration-helper.sh build

# Deploy to staging first
./migration-workspace/deploy-migration-helper.sh staging

# Then production
./migration-workspace/deploy-migration-helper.sh production
```

### 4. Rollback if Needed
```bash
# Code rollback
git checkout main

# Database rollback  
./migration-workspace/db-migration-helper.sh rollback

# Deployment rollback
./migration-workspace/deploy-migration-helper.sh rollback
```

## Environment Configuration

### Required Environment Variables
```bash
# Copy example and configure
cp .env.example .env

# Key variables to set:
DATABASE_URL=              # PostgreSQL connection
FIRECRAWL_API_KEY=         # For tax rate scraping
CLERK_SECRET_KEY=          # Authentication
SQUARE_ACCESS_TOKEN=       # POS integration
REDIS_URL=                 # Caching
```

### Frontend Environment
```bash
# In frontend/.env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_AUTH0_DOMAIN=your-auth0-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
```

## Troubleshooting

### Common Issues
1. **Port conflicts**: Check logs/ directory for port binding errors
2. **Database connection**: Verify DATABASE_URL in .env
3. **MCP servers not starting**: Run `claude mcp list` to check status
4. **Build failures**: Check TypeScript errors with `npm run typecheck`

### Log Files
- Backend: `logs/backend.log`
- Frontend: `logs/frontend.log`  
- Context7: `logs/context7.log`
- Migration: `migration-workspace/logs/`

### Quick Fixes
```bash
# Reset everything
./stop-services.sh
rm -rf node_modules frontend/node_modules
npm install && cd frontend && npm install && cd ..
./quick-setup.sh

# Fix permissions
chmod +x *.sh migration-workspace/*.sh

# Clear caches
rm -rf dist/ frontend/dist/ .vercel/
```

## Production Deployment

### Current Deployment
- **URL**: https://sales-tax-frontend-5cd3i1ylf-liddy.vercel.app
- **Platform**: Vercel
- **Status**: Deployed (may have access protection)

### Deployment Commands
```bash
# Frontend to Vercel
cd frontend && vercel --prod

# Full stack (requires server setup)
# See DEPLOYMENT_GUIDE.md for complete instructions
```

## Migration Tools Overview

### Database Migrations
```bash
./migration-workspace/db-migration-helper.sh backup   # Backup database
./migration-workspace/db-migration-helper.sh migrate  # Run migrations
./migration-workspace/db-migration-helper.sh rollback # Rollback changes
./migration-workspace/db-migration-helper.sh seed     # Seed data
```

### Code Migrations  
```bash
./migration-workspace/code-migration-helper.sh typescript # TS checks
./migration-workspace/code-migration-helper.sh lint       # Code quality
./migration-workspace/code-migration-helper.sh test       # Test suite
./migration-workspace/code-migration-helper.sh build      # Build test
```

### Deployment Migrations
```bash
./migration-workspace/deploy-migration-helper.sh staging    # Deploy staging
./migration-workspace/deploy-migration-helper.sh production # Deploy prod
./migration-workspace/deploy-migration-helper.sh rollback   # Rollback deploy
```

---

**Ready for coding, migrations, and any development tasks!** 🚀

For detailed development guidelines, see `CLAUDE.md`
For deployment instructions, see `DEPLOYMENT_GUIDE.md`