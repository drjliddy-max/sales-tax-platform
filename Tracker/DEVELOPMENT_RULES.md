# Development Rules & Guidelines

This document outlines the architectural rules and development guidelines enforced in this project through automated tooling and pre-commit hooks.

## 🏗️ Architecture Overview

This is a full-stack monolithic application with clear separation between frontend and backend:

- **Backend**: Node.js/Express server with TypeScript
- **Frontend**: React 18 with TypeScript, Vite build system, and Tailwind CSS
- **Authentication**: Auth0 integration
- **Database**: PostgreSQL with Prisma ORM

## 📁 Directory Structure Rules

### Frontend (`frontend/`)
- **Components**: `frontend/src/components/` - All React components
- **Pages**: `frontend/src/pages/` - Page-level React components
- **Services**: `frontend/src/services/` - API calls, Auth0 integration, utilities
- **Types**: `frontend/src/types/` - TypeScript type definitions
- **Assets**: `frontend/src/assets/` - Images, fonts, static files

### Backend (`src/` or `backend/src/`)
- **Routes**: `src/routes/` - Express API routes
- **Models**: `src/models/` - Database models and schemas
- **Services**: `src/services/` - Business logic, external API integrations
- **Middleware**: `src/middleware/` - Express middleware
- **Utils**: `src/utils/` - Utility functions
- **Controllers**: `src/controllers/` - Route handlers

## 🚫 Separation of Concerns - Enforced Rules

### Backend Code MUST NOT:
- Import React (`import React` or `from 'react'`)
- Import React DOM (`from 'react-dom'`)
- Use JSX syntax (`<Component />`)
- Use `.tsx` file extensions
- Import Tailwind CSS classes in server-side code

### Frontend Code MUST NOT:
- Import Express (`from 'express'`)
- Import Node.js core modules (`fs`, `path`, `http`, `crypto`, `os`, `child_process`)
- Import Prisma client directly (use API calls instead)
- Require Node.js specific packages

### Technology Stack Boundaries:
- **React & JSX**: Frontend only (`frontend/` directory)
- **Express**: Backend only (`src/` or `backend/` directory)  
- **Tailwind CSS**: Frontend only (React components)
- **Prisma**: Backend only (database access layer)
- **Auth0**: Both (backend for token validation, frontend for authentication flow)

## 📝 File Naming & Placement

### Automatic Enforcement:
- React components ending in `Component.tsx` → `frontend/src/components/`
- React pages ending in `Page.tsx` or containing `page` → `frontend/src/pages/`
- API routes containing `route` or `Route.ts` → `src/routes/` or `backend/src/routes/`
- Database models containing `model` or `Model.ts` → `src/models/` or `backend/src/models/`
- Services containing `service` or `Service.ts` → appropriate `services/` directory

## 🔧 Development Tools & Enforcement

### Pre-commit Hooks (via Husky)
Every commit automatically runs:

1. **Lint-staged**: Format and lint only changed files
2. **TypeScript Compilation**: Check for type errors in backend and frontend
3. **Architectural Rules Validation**: Custom script validates all separation rules
4. **Unit Tests**: Run critical unit tests

### ESLint Configuration
- **Backend ESLint** (`.eslintrc.backend.js`): Prohibits React imports
- **Frontend ESLint** (`frontend/.eslintrc.cjs`): Prohibits Node.js imports
- **Custom Rules**: Enforce file placement and technology boundaries

### Code Formatting
- **Prettier**: Consistent code formatting across the project
- **EditorConfig**: Consistent editor settings
- **Format on Save**: Recommended in IDE settings

## 🚀 Development Workflow

### Starting Development
```bash
# Install dependencies for both backend and frontend
npm install
cd frontend && npm install && cd ..

# Start both backend and frontend in development mode
npm run dev
```

### Running Tests
```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests
```

### Code Quality Checks
```bash
# Run linting
npm run lint
npm run lint:fix

# Run formatting
npm run format
npm run format:check

# Type checking
npm run typecheck
```

### Building for Production
```bash
# Build both backend and frontend
npm run build

# Build individually
npm run build:backend
npm run build:frontend
```

## ⚡ Quick Reference

### Adding New Features

**Frontend Component:**
1. Create in `frontend/src/components/ComponentName.tsx`
2. Use React, TypeScript, and Tailwind CSS
3. Import from `frontend/src/services/` for API calls

**Backend API Route:**
1. Create in `src/routes/routeName.ts`
2. Use Express, TypeScript
3. Import from `src/services/` and `src/models/`

**Database Model:**
1. Update Prisma schema in `prisma/schema.prisma`
2. Generate types: `npx prisma generate`
3. Create migrations: `npx prisma migrate dev`

### Common Violations & Fixes

❌ **Wrong**: React component in backend
```typescript
// In src/components/Button.tsx - VIOLATION
import React from 'react';
export const Button = () => <button>Click</button>;
```

✅ **Correct**: React component in frontend
```typescript
// In frontend/src/components/Button.tsx - CORRECT
import React from 'react';
export const Button = () => <button>Click</button>;
```

❌ **Wrong**: Express in frontend
```typescript
// In frontend/src/services/api.ts - VIOLATION
import express from 'express';
```

✅ **Correct**: Axios in frontend for API calls
```typescript
// In frontend/src/services/api.ts - CORRECT
import axios from 'axios';
```

## 🔒 Enforcement Mechanisms

### Automated Validation
- **Pre-commit hooks**: Block commits that violate rules
- **CI/CD pipeline**: Validate on every pull request
- **IDE integration**: Real-time linting and type checking

### Manual Code Review
- Architecture adherence
- Performance considerations
- Security best practices
- Code documentation

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Auth0 Documentation](https://auth0.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

---

**Note**: These rules are automatically enforced through tooling. Violations will prevent commits and deployment. For questions or rule modifications, please discuss with the team lead.
