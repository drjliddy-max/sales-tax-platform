#!/bin/bash

# Security Setup Script for Sales Tax Tracker
# This script helps developers set up local security tools

set -e

echo "🔒 Setting up security tools for Sales Tax Tracker..."
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running in the correct directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_info "Checking for required tools..."

# Check if Semgrep is installed
if command -v semgrep >/dev/null 2>&1; then
    print_status "Semgrep is already installed ($(semgrep --version))"
else
    print_warning "Semgrep not found. Installing..."
    
    # Try different installation methods
    if command -v pip3 >/dev/null 2>&1; then
        echo "Installing Semgrep via pip3..."
        pip3 install --user semgrep
    elif command -v brew >/dev/null 2>&1; then
        echo "Installing Semgrep via Homebrew..."
        brew install semgrep
    else
        print_error "Could not install Semgrep. Please install manually:"
        echo "  Option 1: pip3 install --user semgrep"
        echo "  Option 2: brew install semgrep"
        echo "  Option 3: https://semgrep.dev/docs/getting-started/"
        exit 1
    fi
fi

# Check if git-secrets is available (optional but recommended)
if command -v git-secrets >/dev/null 2>&1; then
    print_status "git-secrets is available"
else
    print_warning "git-secrets not found (optional). To install:"
    echo "  brew install git-secrets"
    echo "  Or: https://github.com/awslabs/git-secrets"
fi

# Set up git hooks for security scanning (if .git exists)
if [ -d ".git" ]; then
    print_info "Setting up Git hooks for security scanning..."
    
    # Create pre-commit hook directory if it doesn't exist
    mkdir -p .git/hooks
    
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

echo "🔍 Running security checks..."

# Run Semgrep on staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|jsx|tsx)$' || true)

if [ -n "$STAGED_FILES" ]; then
    echo "Running Semgrep on staged files..."
    if ! semgrep --config=auto --error $STAGED_FILES; then
        echo "❌ Semgrep found security issues. Please fix them before committing."
        exit 1
    fi
    echo "✅ Semgrep scan passed"
else
    echo "No JavaScript/TypeScript files to scan"
fi

# Run git-secrets if available
if command -v git-secrets >/dev/null 2>&1; then
    echo "Running git-secrets..."
    git secrets --scan
fi

echo "✅ Security checks completed successfully"
EOF

    # Make pre-commit hook executable
    chmod +x .git/hooks/pre-commit
    print_status "Created pre-commit security hook"

    # Set up git-secrets if available
    if command -v git-secrets >/dev/null 2>&1; then
        git secrets --install --force >/dev/null 2>&1 || true
        git secrets --register-aws >/dev/null 2>&1 || true
        print_status "Configured git-secrets"
    fi
else
    print_warning "Not a Git repository. Initialize with 'git init' to set up hooks."
fi

# Validate Semgrep configuration
print_info "Validating Semgrep configuration..."
if semgrep --config=.semgrep.yml --validate >/dev/null 2>&1; then
    print_status "Semgrep configuration is valid"
else
    print_error "Semgrep configuration has issues. Please check .semgrep.yml"
    exit 1
fi

# Test security scan on a small subset
print_info "Running test security scan..."
if semgrep --config=.semgrep.yml --quiet --metrics=off src/ >/dev/null 2>&1; then
    print_status "Test security scan completed successfully"
else
    print_warning "Security scan completed with findings. Run full scan to review."
fi

# Create security scan shortcuts
print_info "Creating security scan shortcuts..."

# Create quick scan script
cat > scripts/security-quick-scan.sh << 'EOF'
#!/bin/bash
echo "🔍 Running quick security scan..."
semgrep --config=auto --error --quiet src/ frontend/src/
echo "✅ Quick scan completed"
EOF

# Create full scan script
cat > scripts/security-full-scan.sh << 'EOF'
#!/bin/bash
echo "🔍 Running comprehensive security scan..."
semgrep --config=.semgrep.yml --verbose --time src/ frontend/src/
echo "✅ Full scan completed"
EOF

# Create dependency audit script
cat > scripts/security-audit-deps.sh << 'EOF'
#!/bin/bash
echo "🔍 Running dependency security audit..."

echo "Backend dependencies:"
npm audit --audit-level moderate || true

echo ""
echo "Frontend dependencies:"
cd frontend && npm audit --audit-level moderate || true

echo "✅ Dependency audit completed"
EOF

# Make scripts executable
chmod +x scripts/security-quick-scan.sh
chmod +x scripts/security-full-scan.sh
chmod +x scripts/security-audit-deps.sh

print_status "Created security scan scripts in scripts/ directory"

# Add scripts to package.json if they don't exist
print_info "Adding security scripts to package.json..."

# Use node to safely update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (!pkg.scripts) pkg.scripts = {};

const securityScripts = {
  'security:scan': './scripts/security-quick-scan.sh',
  'security:full': './scripts/security-full-scan.sh',
  'security:audit': './scripts/security-audit-deps.sh',
  'security:setup': './scripts/security-setup.sh'
};

let added = 0;
Object.entries(securityScripts).forEach(([key, value]) => {
  if (!pkg.scripts[key]) {
    pkg.scripts[key] = value;
    added++;
  }
});

if (added > 0) {
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
  console.log('Added ' + added + ' security scripts to package.json');
} else {
  console.log('Security scripts already exist in package.json');
}
"

print_status "Updated package.json with security scripts"

# Display usage instructions
echo
echo -e "${BLUE}🔒 Security Setup Complete!${NC}"
echo
echo "Available security commands:"
echo "  npm run security:scan     - Quick security scan"
echo "  npm run security:full     - Comprehensive security scan"
echo "  npm run security:audit    - Dependency vulnerability audit"
echo "  npm run security:setup    - Re-run this setup script"
echo
echo "Manual commands:"
echo "  semgrep --config=auto --error src/                    - Quick scan"
echo "  semgrep --config=.semgrep.yml src/ frontend/src/      - Full scan"
echo "  git commit                                             - Triggers pre-commit security check"
echo
echo "Security features enabled:"
echo "  ✓ Automated Semgrep scanning"
echo "  ✓ Pre-commit security hooks"
echo "  ✓ GitHub Actions security workflow"
echo "  ✓ Content Security Policy (CSP)"
echo "  ✓ Structured logging"
echo "  ✓ Dependency scanning"
if command -v git-secrets >/dev/null 2>&1; then
echo "  ✓ Secret detection (git-secrets)"
else
echo "  ⚠ Secret detection (install git-secrets for enhanced protection)"
fi
echo
print_info "Run 'npm run security:scan' to perform your first security check!"
echo
