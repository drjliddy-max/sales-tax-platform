# Sales Tax Tracker

🚀 **Modern full-stack application** for automated sales tax compliance and revenue analytics.

**Architecture**: React TypeScript frontend + Node.js Express backend with PostgreSQL database.

## 🎯 Quick Start

```bash
cd /Users/johnliddy/sales-tax-tracker

# Automated setup and start (recommended)
./dev-start.sh

# OR manual start
npm run dev
```

**URLs**: Frontend http://localhost:3001 | Backend http://localhost:3002/api

## 📚 Documentation

- **[Development Guide](DEVELOPMENT.md)** - Complete setup and development workflow
- **[Rules & Workflow](.warp.md)** - When to work where and how
- **[Frontend Guide](frontend/.warp.md)** - React/TypeScript specific guidelines
- **[Frontend README](frontend/README.md)** - Frontend architecture details

## 🏗️ Architecture Overview

```
Frontend (React + TypeScript + Vite)    Backend (Node.js + TypeScript + Express)
              ↓                                      ↓
         Port 3001                              Port 3002
              ↓                                      ↓
    Modern SPA with Tailwind  ←→ API calls →  REST API + PostgreSQL
```

## 🎯 Development Workflow

### Frontend Development (`frontend/src/`)
- React components, pages, UI logic
- Authentication flows, routing
- API integration, state management
- Styling with Tailwind CSS

### Backend Development (`src/`)
- REST API endpoints, middleware
- Business logic, data processing
- Database models, integrations
- Authentication, authorization

## ✨ Features

### 🎨 Modern Frontend
- React 19 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- Auth0 integration
- Responsive design

### ⚙️ Robust Backend
- Node.js + Express + TypeScript
- PostgreSQL with Prisma ORM
- Comprehensive API endpoints
- Multi-jurisdiction tax calculation
- POS integrations (Square, Shopify, Clover)
- Automated tax rate updates
- Real-time analytics and insights

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (optional for development)
- Git

### First-Time Setup
```bash
# 1. Navigate to project
cd /Users/johnliddy/sales-tax-tracker

# 2. Install all dependencies
npm install
cd frontend && npm install && cd ..

# 3. Configure environment
cp .env.example .env
cp frontend/.env.example frontend/.env
# Edit both .env files with your values

# 4. Start development (automated)
./dev-start.sh
```

### Development Commands
```bash
# Start both frontend and backend
npm run dev

# Individual services
npm run dev:backend         # Backend only (:3002)
cd frontend && npm run dev   # Frontend only (:3001)

# Building
npm run build               # Build both
npm run build:frontend      # Vite build
npm run build:backend       # TypeScript compilation

# Production
npm start                   # Serve React app + API (:3002)

# Testing
npm run test                # Backend tests
npm run test:e2e           # E2E tests
```

## 📋 API Endpoints

### Core API
- `GET /api/health` - Health check
- `GET /api/transactions` - Transaction history
- `POST /api/tax/calculate` - Calculate taxes

### Business & Analytics
- `GET /api/business` - Business management
- `GET /api/insights` - Revenue insights
- `GET /api/reports` - Compliance reports

### Integrations
- `POST /api/integrations/pos/sync` - POS synchronization
- `GET /api/integrations` - Integration status
