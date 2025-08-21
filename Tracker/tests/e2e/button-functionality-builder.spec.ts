import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Landing Page Button Functionality Builder', () => {
  let buttonMappings: { [key: string]: { url: string, title: string, exists: boolean } } = {};

  test('should analyze all buttons and create missing pages', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');

    // Find all buttons on the page
    const buttons = await page.locator('button').all();
    const buttonData: { text: string, onClick: string }[] = [];

    console.log(`🔍 Found ${buttons.length} buttons on landing page`);

    for (const button of buttons) {
      const text = await button.textContent();
      const onClick = await button.getAttribute('onclick') || '';
      
      if (text && onClick) {
        buttonData.push({ text: text.trim(), onClick });
        console.log(`📍 Button: "${text}" → ${onClick}`);
      }
    }

    // Extract URLs from onClick handlers
    const urlRegex = /window\.location\.href='([^']*)'/;
    
    for (const btn of buttonData) {
      const match = btn.onClick.match(urlRegex);
      if (match) {
        const url = match[1];
        buttonMappings[btn.text] = {
          url: url,
          title: generatePageTitle(btn.text, url),
          exists: false
        };
      }
    }

    console.log('🗺️  Button Mappings:', buttonMappings);

    // Test each button destination
    for (const [buttonText, mapping] of Object.entries(buttonMappings)) {
      console.log(`\n🧪 Testing button: ${buttonText} → ${mapping.url}`);
      
      try {
        const response = await page.goto(`http://localhost:3001${mapping.url}`);
        mapping.exists = response?.status() === 200;
        
        if (mapping.exists) {
          console.log(`✅ ${buttonText} page exists`);
          await page.screenshot({ 
            path: `tests/screenshots/page-${sanitizeFilename(buttonText)}.png`,
            fullPage: true 
          });
        } else {
          console.log(`❌ ${buttonText} page missing - will create`);
        }
      } catch (error) {
        console.log(`❌ ${buttonText} page error: ${error}`);
        mapping.exists = false;
      }
    }

    // Create missing pages
    await createMissingPages(buttonMappings);
    
    // Test all buttons after page creation
    await page.goto('http://localhost:3001');
    await testAllButtons(page, buttonMappings);
  });

  async function createMissingPages(mappings: typeof buttonMappings) {
    const routesFilePath = 'src/routes/web.ts';
    let routesContent = fs.readFileSync(routesFilePath, 'utf-8');

    for (const [buttonText, mapping] of Object.entries(mappings)) {
      if (!mapping.exists) {
        console.log(`🏗️  Creating page for: ${buttonText} at ${mapping.url}`);
        
        const routeHandler = generateRouteHandler(mapping.url, mapping.title, buttonText);
        
        // Insert the route handler before the export statement
        const exportIndex = routesContent.lastIndexOf('export default router;');
        routesContent = routesContent.slice(0, exportIndex) + routeHandler + '\n\n' + routesContent.slice(exportIndex);
      }
    }

    // Write updated routes file
    fs.writeFileSync(routesFilePath, routesContent);
    console.log('📝 Updated routes file with new pages');
  }

  async function testAllButtons(page: Page, mappings: typeof buttonMappings) {
    console.log('\n🧪 Testing all button functionality...');
    
    for (const [buttonText, mapping] of Object.entries(mappings)) {
      console.log(`\n🔘 Testing button: ${buttonText}`);
      
      await page.goto('http://localhost:3001');
      await page.waitForLoadState('networkidle');
      
      // Find and click the button
      const button = page.locator(`button:has-text("${buttonText}")`).first();
      await expect(button).toBeVisible();
      
      // Take screenshot of button in normal state
      await page.screenshot({ 
        path: `tests/screenshots/button-${sanitizeFilename(buttonText)}-normal.png`,
        clip: await button.boundingBox() || { x: 0, y: 0, width: 200, height: 50 }
      });
      
      // Test hover state
      await button.hover();
      await page.waitForTimeout(200);
      await page.screenshot({ 
        path: `tests/screenshots/button-${sanitizeFilename(buttonText)}-hover.png`,
        clip: await button.boundingBox() || { x: 0, y: 0, width: 200, height: 50 }
      });
      
      // Test click functionality
      await button.click();
      
      if (mapping.url.startsWith('http')) {
        // External link - should open in new tab/window
        console.log(`🔗 External link detected: ${mapping.url}`);
      } else {
        // Internal navigation
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL(`http://localhost:3001${mapping.url}`);
        console.log(`✅ Successfully navigated to ${mapping.url}`);
        
        // Take screenshot of destination page
        await page.screenshot({ 
          path: `tests/screenshots/page-${sanitizeFilename(buttonText)}-destination.png`,
          fullPage: true 
        });
        
        // Test page content
        await expect(page.locator('h1, h2').first()).toBeVisible();
      }
    }
    
    console.log('✅ All button functionality tests completed');
  }

  function generatePageTitle(buttonText: string, url: string): string {
    const titles: { [key: string]: string } = {
      'Try Demo': 'Interactive Demo - Sales Tax Insights',
      'See Insights': 'Business Insights Demo - Sales Tax Insights', 
      'Get Started': 'Get Started - Sales Tax Insights',
      'Start Free Trial': 'Start Your Free Trial - Sales Tax Insights',
      'Login': 'Login - Sales Tax Insights',
      'Sign Up': 'Sign Up - Sales Tax Insights'
    };
    
    return titles[buttonText] || `${buttonText} - Sales Tax Insights`;
  }

  function generateRouteHandler(url: string, title: string, buttonText: string): string {
    const routeName = url.replace('/', '').replace(/[^a-zA-Z0-9]/g, '-') || 'home';
    
    const pageContent = generatePageContent(title, buttonText, url);
    
    return `
// ${buttonText} page
router.get('${url}', (req: Request, res: Response) => {
  res.send(\`${pageContent}\`);
});`;
  }

  function generatePageContent(title: string, buttonText: string, url: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        .classic-btn {
            cursor: pointer;
            border: none;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: 500;
            transition: all 0.15s ease-in-out;
            user-select: none;
            position: relative;
            overflow: hidden;
        }
        
        .classic-btn.primary {
            background-color: #2563eb;
            color: white;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.primary:hover:not(:disabled) {
            background-color: #1d4ed8;
            border-color: #1d4ed8;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }
        
        .classic-btn.secondary {
            background-color: white;
            color: #2563eb;
            border: 2px solid #2563eb;
        }
        
        .classic-btn.secondary:hover:not(:disabled) {
            background-color: #eff6ff;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
        }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
                <div class="flex items-center">
                    <a href="/" class="flex items-center">
                        <i data-lucide="calculator" class="h-8 w-8 text-blue-600 mr-3"></i>
                        <span class="font-bold text-xl text-gray-900">Sales Tax Insights</span>
                    </a>
                </div>
                <div class="flex items-center space-x-4">
                    <button onclick="window.location.href='/'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Home</button>
                    <button onclick="window.location.href='/login'" class="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">Login</button>
                </div>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <div class="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div class="text-center">
            <h1 class="text-4xl font-bold text-gray-900 mb-6">${title.split(' - ')[0]}</h1>
            <div class="mb-8">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    Accessed via "${buttonText}" button
                </span>
            </div>
            ${generatePageSpecificContent(buttonText, url)}
        </div>
    </div>

    <!-- Footer -->
    <footer class="bg-gray-800 mt-auto">
        <div class="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <p class="text-gray-400">© 2025 Sales Tax Insights. Built for SMBs.</p>
            </div>
        </div>
    </footer>

    <script>
        lucide.createIcons();
    </script>
</body>
</html>`;
  }

  function generatePageSpecificContent(buttonText: string, url: string): string {
    const content: { [key: string]: string } = {
      'Try Demo': `
        <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 class="text-2xl font-semibold mb-4">Interactive Demo</h2>
          <p class="text-gray-600 mb-6">Experience our sales tax automation platform with real data and features.</p>
          <div class="grid md:grid-cols-2 gap-6">
            <div class="text-left">
              <h3 class="font-semibold text-lg mb-3">Demo Features:</h3>
              <ul class="space-y-2 text-gray-600">
                <li>✓ Real-time tax calculations</li>
                <li>✓ Multi-jurisdiction support</li>
                <li>✓ POS integration examples</li>
                <li>✓ Compliance monitoring</li>
              </ul>
            </div>
            <div class="text-left">
              <h3 class="font-semibold text-lg mb-3">Try Now:</h3>
              <button onclick="window.location.href='/insights/demo'" class="classic-btn primary px-6 py-3 rounded-lg mb-3">
                View Business Insights
              </button>
              <button onclick="window.location.href='/'" class="classic-btn secondary px-6 py-3 rounded-lg block">
                Back to Home
              </button>
            </div>
          </div>
        </div>`,
      
      'Get Started': `
        <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 class="text-2xl font-semibold mb-4">Get Started with Sales Tax Insights</h2>
          <p class="text-gray-600 mb-6">Set up your automated sales tax compliance in minutes.</p>
          <div class="space-y-6 text-left max-w-2xl mx-auto">
            <div class="flex items-start space-x-4">
              <div class="bg-blue-100 rounded-full p-2 mt-1">
                <span class="text-blue-600 font-bold">1</span>
              </div>
              <div>
                <h3 class="font-semibold">Create Your Account</h3>
                <p class="text-gray-600">Sign up with your business information</p>
              </div>
            </div>
            <div class="flex items-start space-x-4">
              <div class="bg-blue-100 rounded-full p-2 mt-1">
                <span class="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <h3 class="font-semibold">Connect Your POS</h3>
                <p class="text-gray-600">Integrate with Square, Shopify, or 50+ other systems</p>
              </div>
            </div>
            <div class="flex items-start space-x-4">
              <div class="bg-blue-100 rounded-full p-2 mt-1">
                <span class="text-blue-600 font-bold">3</span>
              </div>
              <div>
                <h3 class="font-semibold">Automate Compliance</h3>
                <p class="text-gray-600">Let our system handle tax calculations and reporting</p>
              </div>
            </div>
            <div class="text-center pt-6">
              <button onclick="window.location.href='/signup'" class="classic-btn primary px-8 py-3 rounded-lg mr-4">
                Create Account
              </button>
              <button onclick="window.location.href='/'" class="classic-btn secondary px-6 py-3 rounded-lg">
                Back to Home
              </button>
            </div>
          </div>
        </div>`,

      'Start Free Trial': `
        <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 class="text-2xl font-semibold mb-4">Start Your Free Trial</h2>
          <p class="text-gray-600 mb-6">Get full access to all features for 30 days, no credit card required.</p>
          <div class="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 class="font-semibold text-lg mb-3">What's Included:</h3>
            <div class="grid md:grid-cols-2 gap-4 text-left">
              <ul class="space-y-2 text-gray-700">
                <li>✓ Unlimited transactions</li>
                <li>✓ All POS integrations</li>
                <li>✓ Multi-state compliance</li>
                <li>✓ Real-time reporting</li>
              </ul>
              <ul class="space-y-2 text-gray-700">
                <li>✓ AI-powered insights</li>
                <li>✓ Automated filing</li>
                <li>✓ Expert support</li>
                <li>✓ Mobile app access</li>
              </ul>
            </div>
          </div>
          <div class="text-center">
            <button onclick="window.location.href='/signup'" class="classic-btn primary px-8 py-4 rounded-lg text-lg mr-4">
              Start Free Trial
            </button>
            <button onclick="window.location.href='/'" class="classic-btn secondary px-6 py-3 rounded-lg">
              Back to Home
            </button>
          </div>
        </div>`,

      'Sign Up': `
        <div class="bg-white rounded-lg shadow-lg p-8 mb-8 max-w-md mx-auto">
          <h2 class="text-2xl font-semibold mb-6 text-center">Create Your Account</h2>
          <form class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Business Name</label>
              <input type="text" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Your Business Name">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input type="email" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@business.com">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input type="password" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••••••">
            </div>
            <div class="pt-4">
              <button type="submit" class="classic-btn primary w-full py-3 rounded-lg">
                Create Account
              </button>
            </div>
            <div class="text-center pt-2">
              <button type="button" onclick="window.location.href='/login'" class="text-blue-600 hover:text-blue-800">
                Already have an account? Sign in
              </button>
            </div>
          </form>
        </div>`
    };

    return content[buttonText] || `
      <div class="bg-white rounded-lg shadow-lg p-8 mb-8">
        <h2 class="text-2xl font-semibold mb-4">Welcome to ${buttonText}</h2>
        <p class="text-gray-600 mb-6">This page was automatically generated for the "${buttonText}" button.</p>
        <button onclick="window.location.href='/'" class="classic-btn primary px-6 py-3 rounded-lg">
          Back to Home
        </button>
      </div>`;
  }

  function sanitizeFilename(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
});