#!/bin/bash
echo "🔍 Running comprehensive security scan..."
semgrep --config=.semgrep.yml --verbose --time src/ frontend/src/
echo "✅ Full scan completed"
