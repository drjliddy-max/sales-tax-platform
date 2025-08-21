# 🚀 Quick Reference Card

## Daily Development Commands

```bash
# ALWAYS start from root directory
cd /Users/johnliddy/sales-tax-tracker

# Start development (automated setup + both servers)
./dev-start.sh

# OR manual start (both servers)
npm run dev

# Individual servers
npm run dev:backend      # Backend only (:3002)
cd frontend && npm run dev   # Frontend only (:3001)
```

## URLs
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3002/api
- **API Health**: http://localhost:3002/api/health

## Code Placement Rules

| What you're building | Where it goes | Example |
|---------------------|---------------|---------|
| React Component | `frontend/src/components/` | `Button.tsx` |
| Page/Route | `frontend/src/pages/` | `Dashboard.tsx` |
| API Endpoint | `src/api/routes/` | `transactions.ts` |
| Business Logic | `src/services/` | `TaxCalculator.ts` |
| UI Styles | `frontend/src/assets/` | `index.css` |
| Database Model | `src/models/` | `User.ts` |

## Architecture at a Glance

```
Frontend (React TS + Vite)     Backend (Node.js TS + Express)
       Port 3001                        Port 3002
           ↓                                ↓
    UI Components                     API Endpoints
    Authentication                    Business Logic  
    State Management                  Database (Prisma)
    Tailwind Styling                  Integrations
```

## Essential Checks

### Before Starting Work
- [ ] In root directory: `/Users/johnliddy/sales-tax-tracker`
- [ ] Both servers running (3001 & 3002)
- [ ] Know if working on frontend or backend

### Before Committing  
- [ ] TypeScript passes: `npm run typecheck` / `cd frontend && npm run type-check`
- [ ] Lint passes: `npm run lint` / `cd frontend && npm run lint`
- [ ] Manual testing in browser: http://localhost:3001

## Troubleshooting

```bash
# Port conflicts
lsof -ti:3001 | xargs kill -9  # Kill frontend
lsof -ti:3002 | xargs kill -9  # Kill backend

# Dependency issues
rm -rf node_modules package-lock.json && npm install     # Backend
cd frontend && rm -rf node_modules package-lock.json && npm install  # Frontend

# Database issues
npx prisma generate && npx prisma migrate dev
```

## 🚨 Golden Rules

1. **Always start from root**: `cd /Users/johnliddy/sales-tax-tracker`
2. **Frontend code** → `frontend/src/`
3. **Backend code** → `src/`
4. **Never edit** build outputs (`dist/`, `frontend/dist/`)
5. **Test in browser** → http://localhost:3001

---

**Need more details?** Check out [DEVELOPMENT.md](DEVELOPMENT.md) or [.warp.md](.warp.md)
