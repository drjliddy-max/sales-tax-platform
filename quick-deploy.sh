#!/bin/bash

# Quick deploy script for frontend project
# Usage: ./quick-deploy.sh [--build]

echo "🚀 Quick Deploy to Vercel frontend project"
echo "📂 Navigating to Tracker/frontend..."

cd Tracker/frontend

# Check if we need to build
if [[ "$1" == "--build" ]] || [[ ! -d "dist" ]]; then
    echo "📦 Building project..."
    npm run build
    
    if [ $? -ne 0 ]; then
        echo "❌ Build failed!"
        exit 1
    fi
    echo "✅ Build successful!"
fi

# Deploy to frontend project
echo "🌐 Deploying to Vercel..."
vercel --prod --yes

if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo "🔗 Your help center navigation updates are now live"
else
    echo "❌ Deployment failed!"
    exit 1
fi