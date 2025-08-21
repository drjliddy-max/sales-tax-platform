#!/bin/bash
# Code Migration Helper

echo "🔧 Code Migration Helper"
echo "========================"

case "$1" in
    "typescript")
        echo "Running TypeScript migration checks..."
        npx tsc --noEmit --project ./
        npx tsc --noEmit --project ./frontend/
        ;;
    "lint")
        echo "Running code quality checks..."
        npm run lint
        cd frontend && npm run lint && cd ..
        ;;
    "test")
        echo "Running test suite..."
        npm run test:all
        ;;
    "build")
        echo "Testing builds..."
        npm run build
        ;;
    *)
        echo "Usage: $0 {typescript|lint|test|build}"
        ;;
esac
