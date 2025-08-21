#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

class ArchitecturalValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.projectRoot = process.cwd();
  }

  log(message, type = 'info') {
    const prefix = {
      error: `${colors.red}✗${colors.reset}`,
      warning: `${colors.yellow}⚠${colors.reset}`,
      success: `${colors.green}✓${colors.reset}`,
      info: `${colors.blue}ℹ${colors.reset}`
    }[type];
    
    console.log(`${prefix} ${message}`);
  }

  addError(message) {
    this.errors.push(message);
    this.log(message, 'error');
  }

  addWarning(message) {
    this.warnings.push(message);
    this.log(message, 'warning');
  }

  // Get all staged files for validation
  getStagedFiles() {
    try {
      const result = execSync('git diff --cached --name-only', { encoding: 'utf8' });
      return result.trim().split('\n').filter(file => file);
    } catch (error) {
      // If not in a git repo or no staged files, return empty array
      return [];
    }
  }

  // Validate frontend/backend separation
  validateFrontendBackendSeparation() {
    this.log('Validating frontend/backend separation...', 'info');
    
    const stagedFiles = this.getStagedFiles();
    
    for (const file of stagedFiles) {
      const fullPath = path.join(this.projectRoot, file);
      
      if (!fs.existsSync(fullPath)) continue;
      
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Check backend files
        if (file.startsWith('backend/') || (file.startsWith('src/') && !file.startsWith('frontend/'))) {
          // Backend should not import React
          if (content.match(/import.*from ['"]react['"]/) || 
              content.match(/import.*React/) ||
              content.match(/import.*from ['"]react-dom['"]/)) {
            this.addError(`Backend file ${file} imports React - React should only be used in frontend/`);
          }
          
          // Backend should not use JSX
          if (file.endsWith('.tsx') || content.match(/<[A-Z][^>]*>/)) {
            this.addError(`Backend file ${file} contains JSX - JSX should only be used in frontend/`);
          }
        }
        
        // Check frontend files
        if (file.startsWith('frontend/')) {
          // Frontend should not import Express
          if (content.match(/import.*from ['"]express['"]/) ||
              content.match(/require\(['"]express['"]\)/)) {
            this.addError(`Frontend file ${file} imports Express - Express should only be used in backend/`);
          }
          
          // Frontend should not import Node.js specific modules
          const nodeModules = ['fs', 'path', 'http', 'https', 'crypto', 'os', 'child_process'];
          for (const nodeModule of nodeModules) {
            if (content.match(new RegExp(`import.*from ['"]${nodeModule}['"]`)) ||
                content.match(new RegExp(`require\\(['"]${nodeModule}['"]\\)`))) {
              this.addError(`Frontend file ${file} imports Node.js module '${nodeModule}' - Node.js modules should only be used in backend/`);
            }
          }
        }
        
        // Check root level files (should be backend-focused or config)
        if (!file.includes('/') && (file.endsWith('.js') || file.endsWith('.ts'))) {
          if (content.match(/import.*from ['"]react['"]/) || 
              content.match(/import.*React/)) {
            this.addWarning(`Root level file ${file} imports React - consider moving React code to frontend/`);
          }
        }
        
      } catch (error) {
        this.addWarning(`Could not read file ${file}: ${error.message}`);
      }
    }
  }

  // Validate file placement rules
  validateFilePlacement() {
    this.log('Validating file placement rules...', 'info');
    
    const stagedFiles = this.getStagedFiles();
    
    for (const file of stagedFiles) {
      // React components should be in frontend/src/components/
      if (file.endsWith('.tsx') && file.includes('Component') && 
          !file.startsWith('frontend/src/components/')) {
        this.addError(`React component ${file} should be placed in frontend/src/components/`);
      }
      
      // React pages should be in frontend/src/pages/
      if (file.endsWith('.tsx') && (file.includes('Page') || file.includes('page')) && 
          !file.startsWith('frontend/src/pages/')) {
        this.addError(`React page component ${file} should be placed in frontend/src/pages/`);
      }
      
      // API routes should be in backend/src/routes/ or src/routes/
      if ((file.includes('route') || file.includes('Route')) && file.endsWith('.ts') &&
          !file.startsWith('backend/src/routes/') && !file.startsWith('src/routes/')) {
        this.addError(`API route ${file} should be placed in backend/src/routes/ or src/routes/`);
      }
      
      // Database models should be in backend/src/models/ or src/models/
      if ((file.includes('model') || file.includes('Model')) && file.endsWith('.ts') &&
          !file.startsWith('backend/src/models/') && !file.startsWith('src/models/')) {
        this.addError(`Database model ${file} should be placed in backend/src/models/ or src/models/`);
      }
      
      // Services should be in appropriate service directories
      if ((file.includes('service') || file.includes('Service')) && file.endsWith('.ts')) {
        if (file.startsWith('frontend/') && !file.startsWith('frontend/src/services/')) {
          this.addError(`Frontend service ${file} should be placed in frontend/src/services/`);
        } else if (!file.startsWith('frontend/') && 
                   !file.startsWith('backend/src/services/') && 
                   !file.startsWith('src/services/')) {
          this.addError(`Backend service ${file} should be placed in backend/src/services/ or src/services/`);
        }
      }
    }
  }

  // Validate dependency usage
  validateDependencies() {
    this.log('Validating dependency usage...', 'info');
    
    const stagedFiles = this.getStagedFiles();
    
    for (const file of stagedFiles) {
      const fullPath = path.join(this.projectRoot, file);
      
      if (!fs.existsSync(fullPath) || !file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
      
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Validate Auth0 usage
        if (content.match(/import.*@auth0/) && !file.startsWith('frontend/')) {
          this.addWarning(`File ${file} uses Auth0 outside frontend/ - ensure this is intentional for backend auth`);
        }
        
        // Validate Tailwind usage
        if (content.match(/className=['"][^'"]*\b(bg-|text-|p-|m-|w-|h-|flex|grid)/) && 
            !file.startsWith('frontend/')) {
          this.addError(`File ${file} uses Tailwind CSS classes outside frontend/ - Tailwind should only be used in frontend components`);
        }
        
        // Validate database imports
        if (content.match(/import.*prisma/) && file.startsWith('frontend/')) {
          this.addError(`Frontend file ${file} imports Prisma - database access should only be in backend/`);
        }
        
      } catch (error) {
        this.addWarning(`Could not read file ${file}: ${error.message}`);
      }
    }
  }

  // Validate TypeScript configuration compliance
  validateTypeScriptConfig() {
    this.log('Validating TypeScript configuration...', 'info');
    
    const backendTsConfig = path.join(this.projectRoot, 'tsconfig.json');
    const frontendTsConfig = path.join(this.projectRoot, 'frontend', 'tsconfig.json');
    
    // Check if both configs exist
    if (!fs.existsSync(backendTsConfig)) {
      this.addError('Missing backend tsconfig.json');
    }
    
    if (!fs.existsSync(frontendTsConfig)) {
      this.addError('Missing frontend tsconfig.json');
    }
    
    // Validate frontend has React types
    if (fs.existsSync(frontendTsConfig)) {
      try {
        const frontendConfig = JSON.parse(fs.readFileSync(frontendTsConfig, 'utf8'));
        const compilerOptions = frontendConfig.compilerOptions || {};
        
        if (!compilerOptions.jsx) {
          this.addWarning('Frontend tsconfig.json missing jsx configuration');
        }
        
        if (!compilerOptions.types || !compilerOptions.types.includes('react')) {
          this.addWarning('Frontend tsconfig.json should include React types');
        }
      } catch (error) {
        this.addWarning(`Could not parse frontend tsconfig.json: ${error.message}`);
      }
    }
  }

  // Run all validations
  validate() {
    console.log(`\n${colors.bold}🏗️  Architectural Rule Validation${colors.reset}\n`);
    
    this.validateFrontendBackendSeparation();
    this.validateFilePlacement();
    this.validateDependencies();
    this.validateTypeScriptConfig();
    
    // Summary
    console.log(`\n${colors.bold}📊 Validation Summary:${colors.reset}`);
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log('All architectural rules passed!', 'success');
      return true;
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}Warnings (${this.warnings.length}):${colors.reset}`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }
    
    if (this.errors.length > 0) {
      console.log(`\n${colors.red}Errors (${this.errors.length}):${colors.reset}`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      
      console.log(`\n${colors.red}${colors.bold}❌ Commit blocked due to architectural violations${colors.reset}`);
      console.log(`${colors.yellow}Fix the above errors before committing.${colors.reset}\n`);
      return false;
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠️  Commit allowed with warnings${colors.reset}\n`);
    }
    
    return true;
  }
}

// Run validation
const validator = new ArchitecturalValidator();
const success = validator.validate();

process.exit(success ? 0 : 1);
