# Sales Tax Platform - Deployment Guide

## 🚀 Quick Deployment Setup

### Frontend Deployment (Vercel)

1. **Install Vercel CLI** (already done):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   cd ~/sales-tax-platform/frontend
   vercel login
   ```
   - Choose "Continue with GitHub"
   - Authenticate in browser

3. **Deploy Frontend**:
   ```bash
   vercel
   ```
   - Link to existing project? **No**
   - Project name: **sales-tax-platform**
   - Deploy? **Yes**

### Backend Deployment Options

#### Option 1: Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway deploy
```

#### Option 2: Heroku
```bash
npm install -g heroku
heroku login
heroku create sales-tax-platform-api
git push heroku main
```

#### Option 3: DigitalOcean App Platform
- Connect GitHub repository
- Auto-deploy on push to main

### Environment Variables

#### Frontend (.env)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=https://your-api-domain.com
```

#### Backend (.env)
```
CLERK_SECRET_KEY=sk_test_...
DATABASE_URL=postgresql://...
NODE_ENV=production
PORT=3002
```

### Post-Deployment Checklist

- [ ] Frontend deployed and accessible
- [ ] Backend API deployed and accessible  
- [ ] Database connected and migrated
- [ ] Environment variables configured
- [ ] Clerk authentication working
- [ ] API endpoints responding
- [ ] CORS configured for production domains

### Production URLs

- **Frontend**: `https://sales-tax-platform.vercel.app`
- **Backend**: `https://sales-tax-platform-api.railway.app`
- **GitHub**: `https://github.com/drjliddy-max/sales-tax-platform`

### Monitoring & Maintenance

1. **Vercel Dashboard**: Monitor frontend deployments
2. **Railway/Heroku Dashboard**: Monitor backend performance
3. **Clerk Dashboard**: Monitor authentication metrics
4. **GitHub Actions**: Set up CI/CD pipeline

## 🔧 Development Workflow

### Local Development
```bash
# Backend
cd ~/sales-tax-platform/backend
npm run dev  # Port 3002

# Frontend (new terminal)
cd ~/sales-tax-platform/frontend  
npm run dev  # Port 5173
```

### Testing
```bash
# Backend tests
cd backend && npm test

# Frontend E2E tests
cd frontend && npm run test
```

### Git Workflow
```bash
git add .
git commit -m "Feature: Description"
git push origin main
# Triggers auto-deployment
```

## 📊 Success Metrics

Your Sales Tax Platform MVP is ready for production with:

- ✅ **Scalable Architecture**: React + Express.js
- ✅ **Authentication**: Clerk integration
- ✅ **Database**: PostgreSQL with Prisma ORM
- ✅ **Testing**: Playwright E2E coverage
- ✅ **Deployment**: Vercel + Railway/Heroku ready
- ✅ **Version Control**: GitHub with full history

Ready to serve real users! 🎉