#!/bin/bash

# Quick deploy script for sales-tax-platform
# Usage: ./quick-deploy.sh [--build]

echo "🚀 Quick Deploy to sales-tax-platform"
echo "📂 Navigating to Tracker..."

cd Tracker

if [[ ! -f "deploy-platform.sh" ]]; then
    echo "❌ Error: deploy-platform.sh not found in Tracker/"
    exit 1
fi

# Pass any arguments to the deploy script
./deploy-platform.sh "$@"