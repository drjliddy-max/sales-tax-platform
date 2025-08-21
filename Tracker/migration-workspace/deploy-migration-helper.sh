#!/bin/bash
# Deployment Migration Helper

echo "🚀 Deployment Migration Helper"
echo "==============================="

case "$1" in
    "staging")
        echo "Deploying to staging..."
        cd frontend && vercel --yes
        ;;
    "production")
        echo "Deploying to production..."
        cd frontend && vercel --prod --yes
        ;;
    "rollback")
        echo "Rolling back deployment..."
        cd frontend && vercel rollback --yes
        ;;
    *)
        echo "Usage: $0 {staging|production|rollback}"
        ;;
esac
