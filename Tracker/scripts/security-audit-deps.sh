#!/bin/bash
echo "🔍 Running dependency security audit..."

echo "Backend dependencies:"
npm audit --audit-level moderate || true

echo ""
echo "Frontend dependencies:"
cd frontend && npm audit --audit-level moderate || true

echo "✅ Dependency audit completed"
