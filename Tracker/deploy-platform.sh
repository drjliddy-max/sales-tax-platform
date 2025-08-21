#!/bin/bash

# Deploy script for sales-tax-platform Vercel project
# Usage: ./deploy-platform.sh

echo "🚀 Deploying to sales-tax-platform Vercel project..."
echo "📍 Current directory: $(pwd)"

# Ensure we're in the Tracker directory and navigate to frontend
if [[ ! -d "frontend" ]]; then
    echo "❌ Error: Must be run from Tracker directory"
    echo "💡 Run: cd /Users/johnliddy/sales-tax-platform/Tracker && ./deploy-platform.sh"
    exit 1
fi

# Navigate to frontend directory
cd frontend

# Check if we have the dist folder or need to build
if [[ ! -d "dist" ]] || [[ "$1" == "--build" ]]; then
    echo "📦 Building project..."
    npm run build
    
    if [ $? -ne 0 ]; then
        echo "❌ Build failed!"
        exit 1
    fi
    echo "✅ Build successful!"
fi

# Remove any existing Vercel linking to avoid conflicts
echo "🔧 Clearing Vercel project linking..."
rm -rf .vercel 2>/dev/null

# Try deploying from frontend directory with proper project linking
echo "🌐 Deploying to sales-tax-platform project..."

# Remove .vercel to force fresh project selection
rm -rf .vercel 2>/dev/null

# Link specifically to sales-tax-platform and deploy
echo "Linking to sales-tax-platform project..."
echo "sales-tax-platform" | vercel --prod --yes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo "📝 Note: This creates a new deployment URL each time"
    echo "💡 To use consistent URL, configure sales-tax-platform project in Vercel dashboard:"
    echo "   1. Go to https://vercel.com/liddy/sales-tax-platform/settings"
    echo "   2. Set Root Directory: Tracker/frontend" 
    echo "   3. Set Framework Preset: Vite"
    echo "   4. Set Build Command: npm run build"
    echo "   5. Set Output Directory: dist"
    echo "   6. Set Install Command: npm install"
    echo ""
    echo "🔧 Current build fails because Vercel dashboard needs Root Directory set to 'Tracker/frontend'"
    echo ""
    echo "🔄 For quick updates from Tracker/: ./deploy-platform.sh"
    echo "🔄 For quick updates from root: ./quick-deploy.sh"
    echo "🔄 To force rebuild: ./deploy-platform.sh --build"
else
    echo "❌ Deployment failed!"
    exit 1
fi