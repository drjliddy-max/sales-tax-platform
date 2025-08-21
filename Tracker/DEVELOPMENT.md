# Sales Tax Tracker - Development Guide

## 🚀 Quick Start (TL;DR)

```bash
cd /Users/johnliddy/sales-tax-tracker
./dev-start.sh  # Automated setup and start
# OR manually: npm run dev
```

Visit: http://localhost:3001 (Frontend) | http://localhost:3002/api (Backend)

## 📋 Architecture Overview

This is a **modern full-stack TypeScript application** with clear separation:

```
Frontend (React + Vite)     Backend (Node.js + Express)
       ↓                           ↓
  Port 3001                   Port 3002
      ↓                           ↓
  User Interface  ←→ API calls →  REST API + Database
```

## 🎯 When to Work Where?

### 🎨 Frontend Development (`frontend/src/`)
**Work here when building:**
- ✅ UI components, pages, forms
- ✅ User interactions and client-side logic
- ✅ Authentication flows and routing
- ✅ Data visualization and charts
- ✅ Responsive design and styling

### ⚙️ Backend Development (`src/`)
**Work here when building:**
- ✅ API endpoints and business logic
- ✅ Database models and operations
- ✅ Authentication and authorization
- ✅ Data processing and calculations
- ✅ External integrations (POS, tax APIs)

## 🛠️ Development Commands

### Essential Commands
```bash
# Start everything (recommended)
npm run dev                 # Both frontend and backend

# Individual services
npm run dev:backend         # Backend only
cd frontend && npm run dev  # Frontend only

# Building
npm run build              # Build both
npm run build:backend      # TypeScript compilation
npm run build:frontend     # Vite production build

# Production
npm start                  # Serve React app + API on :3002
```

### Development Tools
```bash
# Type checking
npm run typecheck                    # Backend
cd frontend && npm run type-check    # Frontend

# Linting
npm run lint                        # Backend
cd frontend && npm run lint         # Frontend

# Testing
npm run test                        # Backend tests
npm run test:e2e                   # E2E tests
```

## 📁 Directory Structure & Rules

```
sales-tax-tracker/
│
├── 🎨 FRONTEND (React TypeScript SPA)
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── pages/         # Route components
│   │   │   ├── services/      # API client, auth
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   ├── utils/         # Frontend utilities
│   │   │   ├── types/         # TypeScript types
│   │   │   └── assets/        # Styles, images
│   │   ├── package.json       # Frontend dependencies
│   │   ├── vite.config.ts     # Vite configuration
│   │   └── tailwind.config.js # Styling configuration
│
├── ⚙️ BACKEND (Node.js TypeScript API)
│   ├── src/
│   │   ├── api/               # Express routes, middleware
│   │   ├── services/          # Business logic
│   │   ├── models/            # Data models
│   │   ├── integrations/      # External APIs
│   │   └── utils/             # Backend utilities
│   ├── prisma/                # Database schema
│   ├── package.json           # Backend deps + dev scripts
│   └── tsconfig.json          # TypeScript config
│
└── 📚 DOCUMENTATION & CONFIG
    ├── .warp.md              # Main development rules
    ├── DEVELOPMENT.md        # This file
    ├── dev-start.sh         # Automated startup script
    └── .env.example         # Environment template
```

## 🔧 Environment Setup

### 1. Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (for production)
- Git

### 2. First-Time Setup
```bash
# Clone and navigate
cd /Users/johnliddy/sales-tax-tracker

# Install dependencies (both frontend and backend)
npm install
cd frontend && npm install && cd ..

# Environment configuration
cp .env.example .env
cp frontend/.env.example frontend/.env
# Edit both .env files with your values

# Database setup (if using PostgreSQL)
npx prisma generate
npx prisma migrate dev
```

### 3. Start Development
```bash
# Automated setup and start
./dev-start.sh

# OR manual start
npm run dev
```

## 🎨 Frontend Development Guide

### Adding New Components
```typescript
// 1. Create component
// frontend/src/components/MyComponent.tsx
export default function MyComponent({ title }: { title: string }) {
  return <h1 className="text-2xl font-bold">{title}</h1>;
}

// 2. Use in pages
import MyComponent from '@/components/MyComponent';
```

### Adding New Pages
```typescript
// 1. Create page component
// frontend/src/pages/NewPage.tsx
import Layout from '@/components/Layout';

export default function NewPage() {
  return (
    <Layout>
      <h1>New Page</h1>
    </Layout>
  );
}

// 2. Add route to frontend/src/App.tsx
<Route path="/new-page" element={<NewPage />} />
```

### API Integration
```typescript
// Use the centralized API service
import { apiService } from '@/services/api';

// In components:
const [data, setData] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    const response = await apiService.get('/my-endpoint');
    setData(response.data);
  };
  fetchData();
}, []);
```

### Styling with Tailwind
```jsx
// Use utility classes
<div className="bg-brand-blue-600 text-white p-4 rounded-lg hover:bg-brand-blue-700">
  
// Responsive design
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Custom component classes (in frontend/src/assets/index.css)
<button className="btn-primary">Click me</button>
```

## ⚙️ Backend Development Guide

### Adding New API Endpoints
```typescript
// 1. Create route file
// src/api/routes/myRoute.ts
import { Router } from 'express';
const router = Router();

router.get('/my-endpoint', async (req, res) => {
  // Business logic here
  res.json({ success: true, data: 'Hello' });
});

export default router;

// 2. Register in src/app.ts
import myRoutes from '@/api/routes/myRoute';
app.use('/api/my-routes', protectRoute, myRoutes);
```

### Adding Business Logic
```typescript
// src/services/MyService.ts
export class MyService {
  static async processData(input: any) {
    // Business logic
    return processedData;
  }
}

// Use in routes
import { MyService } from '@/services/MyService';
const result = await MyService.processData(data);
```

### Database Operations
```typescript
// Using Prisma
import prisma from '@/lib/prisma';

// In services:
const users = await prisma.user.findMany();
const newUser = await prisma.user.create({ data: userData });
```

## 🔐 Authentication Flow

### Frontend
```typescript
// Check authentication
import { authService } from '@/services/auth';

const isAuth = await authService.isAuthenticated();
const user = await authService.getUser();

// Login/Logout
await authService.login();    // Redirects to Auth0
await authService.logout();   // Clears session
```

### Backend
```typescript
// Protected routes automatically get user info
app.use('/api/protected', protectRoute, myRoutes);

// In route handlers:
const userId = req.user?.sub;  // From Auth0 token
```

## 🧪 Testing Strategy

### Frontend Testing
```bash
cd frontend
npm run type-check    # TypeScript validation
npm run lint          # ESLint rules
# Manual: Test in browser at localhost:3001
```

### Backend Testing
```bash
npm run typecheck     # TypeScript validation
npm run test          # Jest unit tests
npm run test:e2e      # Playwright integration tests
```

### API Testing
```bash
# Health check
curl http://localhost:3002/api/health

# Test endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:3002/api/transactions
```

## 🚀 Deployment

### Development
```bash
npm run dev  # Frontend :3001, Backend :3002
```

### Production
```bash
npm run build  # Builds both frontend and backend
npm start      # Serves React app + API on :3002
```

## 🔧 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find and kill process
lsof -ti:3001 | xargs kill -9  # Frontend
lsof -ti:3002 | xargs kill -9  # Backend
```

**Dependencies out of sync:**
```bash
# Backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**TypeScript errors:**
```bash
# Backend
npm run typecheck
npm run build:backend

# Frontend
cd frontend && npm run type-check
```

**Database connection:**
```bash
# Check .env has DATABASE_URL
npx prisma generate
npx prisma migrate dev
```

## 📋 Development Checklist

### Before Starting Work
- [ ] `cd /Users/johnliddy/sales-tax-tracker`
- [ ] `npm run dev` (or `./dev-start.sh`)
- [ ] Verify both servers started (3001 & 3002)
- [ ] Check if working on frontend or backend code

### Before Committing
- [ ] TypeScript compilation passes
- [ ] Linting rules pass
- [ ] Manual testing in browser
- [ ] No console errors
- [ ] Responsive design works (if frontend)
- [ ] API endpoints work (if backend)

### Code Review Checklist
- [ ] Code follows TypeScript best practices
- [ ] Proper error handling implemented
- [ ] Authentication/authorization working
- [ ] Performance considerations addressed
- [ ] Tests updated (if applicable)

---

## 🎯 Remember The Golden Rules

1. **Always start from root directory**: `cd /Users/johnliddy/sales-tax-tracker`
2. **Frontend code** goes in `frontend/src/`
3. **Backend code** goes in `src/`
4. **Use the automated startup script**: `./dev-start.sh`
5. **Test in browser** at http://localhost:3001
6. **API endpoints** available at http://localhost:3002/api

**Happy coding! 🚀**
