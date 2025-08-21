#!/bin/bash

# Deploy script for sales tax tracker frontend with monitoring
echo "🚀 Deploying Sales Tax Tracker Frontend with Monitoring System..."

# Build the project
echo "📦 Building project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Try deployment with retry logic
    echo "🌐 Deploying to Vercel..."
    
    # Remove existing vercel config to force fresh setup
    rm -rf .vercel 2>/dev/null
    
    # Deploy with interactive mode but try to handle the path issue
    echo "Creating new deployment..."
    npx vercel --prod --yes --force || {
        echo "❌ Vercel deployment failed due to configuration issues"
        echo "📝 Manual steps required:"
        echo "1. Go to https://vercel.com/dashboard"
        echo "2. Create a new project manually"
        echo "3. Connect this repository: sales-tax-tracker/frontend"
        echo "4. Set build command: npm run build"
        echo "5. Set output directory: dist"
        echo "6. Deploy"
        echo ""
        echo "📊 Your build files are ready in ./dist directory"
        echo "🔧 Build includes the new monitoring system with:"
        echo "   - Real-time system health monitoring"
        echo "   - Performance metrics collection"
        echo "   - Alert management system"
        echo "   - Comprehensive logging"
        echo "   - Interactive monitoring dashboard"
        exit 1
    }
else
    echo "❌ Build failed!"
    exit 1
fi
