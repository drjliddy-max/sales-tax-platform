#!/bin/bash
# Database Migration Helper

echo "🗄️  Database Migration Helper"
echo "============================="

case "$1" in
    "backup")
        echo "Creating database backup..."
        npm run db:backup || echo "Manual backup required"
        ;;
    "migrate")
        echo "Running migrations..."
        npm run db:migrate
        ;;
    "rollback")
        echo "Rolling back last migration..."
        npm run db:rollback || echo "Manual rollback required"
        ;;
    "seed")
        echo "Seeding database..."
        npm run db:seed
        ;;
    *)
        echo "Usage: $0 {backup|migrate|rollback|seed}"
        ;;
esac
