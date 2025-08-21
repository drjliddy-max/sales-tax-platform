# 🚀 POS Integration System - Production Deployment Guide

## Overview

This guide covers deploying the Sales Tax Tracker POS Integration System to production, including backend API endpoints, frontend components, and all supporting infrastructure.

## Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** 12+ database
- **Redis** (optional but recommended)
- **SSL Certificate** for HTTPS
- **Domain name** configured with DNS

## 🔧 Environment Setup

### 1. Environment Variables

Copy the production environment template:
```bash
cp .env.production .env
```

Update the following critical values in `.env`:

#### Required Configuration
```bash
# Database - Replace with your actual database credentials
DATABASE_URL=postgresql://username:password@localhost:5432/sales_tax_tracker_prod

# Security - Generate secure values
JWT_SECRET=$(openssl rand -base64 64)
POS_WEBHOOK_SECRET=$(openssl rand -base64 32)

# Domain - Replace with your actual domain
CORS_ORIGINS=https://yourdomain.com,https://api.yourdomain.com
```

#### Optional but Recommended
```bash
# Redis for caching and session management
REDIS_URL=redis://localhost:6379

# Email service for notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Monitoring and error tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

### 2. Database Setup

Initialize the production database:
```bash
# Create database
createdb sales_tax_tracker_prod

# Run migrations (if you have them)
npm run db:migrate

# Seed initial data (if needed)
npm run db:seed
```

### 3. SSL Certificate

Ensure you have SSL certificates for HTTPS:
```bash
# Using Let's Encrypt (example)
certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

## 📦 Build and Deployment

### 1. Backend Deployment

Build the backend:
```bash
# Install dependencies
npm install --production

# Build TypeScript
npm run build

# Start the production server
npm start
```

**Using PM2 (Recommended):**
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/server.js --name "pos-integration-api"

# Configure auto-restart
pm2 startup
pm2 save
```

### 2. Frontend Deployment

Build the frontend:
```bash
cd frontend
npm install
npm run build
```

**Serve with Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;
    
    root /path/to/frontend/dist;
    index index.html;
    
    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## 🔒 Security Configuration

### 1. Firewall Rules
```bash
# Allow HTTP, HTTPS, and SSH only
ufw allow 22   # SSH
ufw allow 80   # HTTP
ufw allow 443  # HTTPS
ufw enable
```

### 2. Application Security
- ✅ All secrets stored in environment variables
- ✅ HTTPS enforced for all connections
- ✅ Rate limiting configured
- ✅ CORS properly configured
- ✅ Input validation and sanitization
- ✅ SQL injection protection

### 3. Database Security
- ✅ Database user with minimal privileges
- ✅ Connection encryption (SSL)
- ✅ Regular backups configured
- ✅ Access limited to application servers

## 📊 Monitoring and Logging

### 1. Application Monitoring

The system includes built-in monitoring endpoints:
- **Health Check**: `GET /health`
- **API Documentation**: `GET /api`

### 2. Log Management

Logs are written to both console and files:
```bash
# View application logs
tail -f logs/app.log

# PM2 logs (if using PM2)
pm2 logs pos-integration-api
```

### 3. Database Monitoring

Monitor database performance:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

## 🚦 Testing Production Deployment

### 1. API Health Check
```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "posIntegration": {
    "initialized": true,
    "status": "active"
  }
}
```

### 2. POS Registry Test
```bash
curl https://api.yourdomain.com/api/pos/registry/popular
```

### 3. Frontend Verification
Visit `https://yourdomain.com` and verify:
- ✅ Site loads without errors
- ✅ POS integration section accessible
- ✅ API calls work correctly
- ✅ Authentication flows properly

## 🔄 Deployment Automation

### 1. Deployment Script

Create a deployment script:
```bash
#!/bin/bash
# deploy.sh

set -e

echo "🚀 Starting deployment..."

# Pull latest code
git pull origin main

# Install dependencies
npm install --production

# Build backend
npm run build

# Build frontend
cd frontend && npm install && npm run build && cd ..

# Restart services
pm2 restart pos-integration-api

# Verify health
sleep 5
curl -f https://api.yourdomain.com/health

echo "✅ Deployment completed successfully!"
```

### 2. CI/CD Pipeline (GitHub Actions Example)

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm install
        
      - name: Build backend
        run: npm run build
        
      - name: Build frontend
        run: cd frontend && npm install && npm run build
        
      - name: Deploy to server
        run: |
          # Add your deployment commands here
          echo "Deploying to production server..."
```

## 🛠 Maintenance

### 1. Regular Updates
- Keep dependencies updated
- Apply security patches promptly
- Monitor for new POS system integrations

### 2. Backup Strategy
- Daily database backups
- Configuration backups
- Regular backup restoration testing

### 3. Performance Optimization
- Monitor API response times
- Optimize database queries
- Cache frequently accessed data

## 🆘 Troubleshooting

### Common Issues

**API Returns 500 Error:**
1. Check application logs: `pm2 logs pos-integration-api`
2. Verify database connection
3. Check environment variables

**Frontend Not Loading:**
1. Verify nginx configuration
2. Check SSL certificate validity
3. Ensure build artifacts exist

**Database Connection Issues:**
1. Verify DATABASE_URL format
2. Check database server status
3. Validate user permissions

**POS Integration Errors:**
1. Check POS adapter initialization
2. Verify webhook configurations
3. Test individual POS endpoints

### Support

For additional support or questions:
- Review application logs
- Check the API documentation at `/api`
- Verify environment configuration
- Test with the integration test suite

---

## 🎉 Deployment Complete!

Your POS Integration System is now running in production with:
- ✅ Secure HTTPS endpoints
- ✅ Production database
- ✅ Monitoring and logging
- ✅ Error handling and recovery
- ✅ Rate limiting and security measures

The system is ready to handle POS integrations for your sales tax tracking application!
