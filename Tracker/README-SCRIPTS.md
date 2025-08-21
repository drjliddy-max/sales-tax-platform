# Sales Tax Tracker - Script Reference

## Quick Start Scripts

### 🚀 One-Command Setup
```bash
./quick-setup.sh              # Complete setup: app + migration tools
./quick-setup.sh --skip-migration  # Just start the application  
./quick-setup.sh --migration-only   # Setup migration workspace only
```

### 🛑 Stop Everything
```bash
./stop-services.sh            # Stop all running services
```

## Core Application Scripts

### Development Servers
```bash
./full-startup.sh             # Start complete application with MCP servers
./start-mcp-servers.sh        # Start MCP servers only
npm run dev                   # Start frontend + backend
npm run dev:frontend          # Frontend development server (port 3001)
npm run dev:backend           # Backend development server (port 3000)
```

### Build & Deploy
```bash
npm run build                 # Build entire application
npm run build:frontend        # Build frontend only
cd frontend && vercel --prod  # Deploy frontend to Vercel
./frontend/deploy.sh          # Frontend deployment with retry logic
```

## Migration & Development Tools

### Migration Workspace
```bash
./setup-migration-workspace.sh     # Setup complete migration environment
```

### Migration Helper Scripts
```bash
# Database operations
./migration-workspace/db-migration-helper.sh backup
./migration-workspace/db-migration-helper.sh migrate
./migration-workspace/db-migration-helper.sh rollback
./migration-workspace/db-migration-helper.sh seed

# Code quality & validation
./migration-workspace/code-migration-helper.sh typescript
./migration-workspace/code-migration-helper.sh lint
./migration-workspace/code-migration-helper.sh test
./migration-workspace/code-migration-helper.sh build

# Deployment management
./migration-workspace/deploy-migration-helper.sh staging
./migration-workspace/deploy-migration-helper.sh production
./migration-workspace/deploy-migration-helper.sh rollback
```

### Validation & Testing
```bash
# Run migration validation suite
node migration-workspace/validation-tests/migration-smoke-test.js

# Comprehensive testing
npm run test:all              # Jest + Playwright tests
npm run test:e2e              # End-to-end tests only
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests only
```

## Utility Scripts

### Code Quality
```bash
npm run typecheck             # TypeScript validation
npm run lint                  # ESLint check
npm run lint:fix              # Auto-fix linting issues
npm run format                # Prettier formatting
```

### Database Management
```bash
npm run db:migrate            # Run Prisma migrations
npm run db:seed               # Seed database with sample data
npm run tax-rates:update      # Update tax rates from providers
```

### Security & Monitoring
```bash
npm run security:scan         # Quick security scan
npm run security:full         # Comprehensive security audit
npm run security:audit        # Dependency audit
./scripts/security-setup.sh   # Setup security tools
```

## MCP Server Management

### Check MCP Status
```bash
claude mcp list               # List all configured MCP servers
claude mcp restart firecrawl  # Restart specific MCP server
```

### Available MCP Servers
- **firecrawl**: Web scraping for tax data collection
- **clerk**: User authentication and management
- **playwright**: Browser automation and testing
- **context7**: Enhanced code intelligence and docs
- **filesystem**: Direct file system access
- **git**: Git repository operations
- **postgres**: Database operations

## Environment Setup

### First Time Setup
```bash
# 1. Clone and setup
git clone <repository>
cd sales-tax-tracker

# 2. Environment configuration
cp .env.example .env
# Edit .env with your credentials

# 3. Quick start
./quick-setup.sh
```

### Environment Files
- `.env` - Backend environment variables
- `frontend/.env` - Frontend environment variables  
- `mcp.config.json` - MCP server configuration

## Process Management

### View Running Services
```bash
# Check process IDs
cat .backend.pid .frontend.pid .context7.pid

# View logs
tail -f logs/backend.log
tail -f logs/frontend.log
tail -f logs/context7.log

# Monitor all logs
tail -f logs/*.log
```

### Health Checks
```bash
# Check service health
curl http://localhost:3000/health    # Backend health
curl http://localhost:3001           # Frontend
curl http://localhost:3002           # Context7 MCP
```

## Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel --prod                 # Deploy to production
vercel                        # Deploy to staging
vercel rollback               # Rollback deployment
```

### Current Deployments
- **Production**: https://sales-tax-frontend-5cd3i1ylf-liddy.vercel.app
- **Staging**: Created automatically with each `vercel` deploy

## Troubleshooting

### Common Issues
```bash
# Port conflicts
./stop-services.sh && ./quick-setup.sh

# Dependency issues
rm -rf node_modules frontend/node_modules
npm install && cd frontend && npm install && cd ..

# Build failures
npm run typecheck           # Check TypeScript errors
npm run lint               # Check code quality issues

# MCP server issues
claude mcp list            # Check MCP status
claude mcp restart <server> # Restart specific server
```

### Reset Everything
```bash
# Nuclear option - complete reset
./stop-services.sh
rm -rf node_modules frontend/node_modules dist frontend/dist .vercel
npm install && cd frontend && npm install && cd ..
./quick-setup.sh
```

## Development Workflow

### Standard Development
1. `./quick-setup.sh` - Start everything
2. Make changes to code
3. `npm run typecheck && npm run lint` - Validate changes
4. `npm run test:all` - Run tests
5. `npm run build` - Test builds
6. Deploy when ready

### Migration Workflow  
1. `./quick-setup.sh --migration-only` - Setup migration tools
2. Review `migration-workspace/migration-progress.md`
3. Use helper scripts for specific migration tasks
4. `node migration-workspace/validation-tests/migration-smoke-test.js` - Validate
5. Deploy with confidence

---

**Ready for any development, testing, migration, or deployment task!** 🚀