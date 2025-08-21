#!/bin/bash
echo "🔍 Running quick security scan..."
semgrep --config=auto --error --quiet src/ frontend/src/
echo "✅ Quick scan completed"
