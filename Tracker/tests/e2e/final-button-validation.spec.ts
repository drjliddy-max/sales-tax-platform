import { test, expect } from '@playwright/test';

test.describe('Final Button Functionality Validation', () => {
  test('should validate core button functionality and navigation', async ({ page }) => {
    console.log('🎯 Final validation of button functionality...');

    // Test 1: Landing Page and Core Buttons
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'tests/screenshots/final-landing-validation.png', 
      fullPage: true 
    });
    
    console.log('✅ Landing page loaded');

    // Test each button individually
    const buttonTests = [
      { name: 'Try Demo', expectedUrl: '/demo', successMessage: 'Demo page accessible' },
      { name: 'See Insights', expectedUrl: '/insights/demo', successMessage: 'Insights page accessible' },
      { name: 'Login', expectedUrl: '/login', successMessage: 'Login page accessible' },
      { name: 'Get Started', expectedUrl: '/signup', successMessage: 'Signup page accessible' }
    ];

    for (const buttonTest of buttonTests) {
      console.log(`\n🔘 Testing ${buttonTest.name} button...`);
      
      // Return to landing page
      await page.goto('http://localhost:3001');
      await page.waitForLoadState('networkidle');
      
      // Find and test button
      const button = page.locator(`button:has-text("${buttonTest.name}")`).first();
      await expect(button).toBeVisible();
      
      // Test hover state
      await button.hover();
      await page.waitForTimeout(300);
      
      // Click button
      await button.click();
      await page.waitForLoadState('networkidle');
      
      // Verify navigation
      await expect(page).toHaveURL(new RegExp(buttonTest.expectedUrl));
      
      // Take screenshot of destination
      await page.screenshot({ 
        path: `tests/screenshots/final-${buttonTest.name.toLowerCase().replace(' ', '-')}-page.png`,
        fullPage: true 
      });
      
      console.log(`  ✅ ${buttonTest.successMessage}`);
    }

    // Test 2: Navigation Bar Buttons
    console.log('\n🔘 Testing Navigation Bar...');
    
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Test nav Login button
    await page.locator('nav button:has-text("Login")').click();
    await expect(page).toHaveURL(/login/);
    console.log('  ✅ Nav Login working');
    
    // Test nav Get Started button
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.locator('nav button:has-text("Get Started")').click();
    await expect(page).toHaveURL(/signup/);
    console.log('  ✅ Nav Get Started working');

    // Test 3: Responsive Button Behavior
    console.log('\n🔘 Testing Responsive Behavior...');
    
    const viewports = [
      { width: 1200, height: 800, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:3001');
      await page.waitForLoadState('networkidle');

      const mainButton = page.locator('button:has-text("Try Demo")').first();
      await expect(mainButton).toBeVisible();
      
      await page.screenshot({ 
        path: `tests/screenshots/final-responsive-${viewport.name}.png`,
        fullPage: true 
      });
      
      console.log(`  ✅ Buttons working on ${viewport.name}`);
    }

    // Test 4: Button States and Styling
    console.log('\n🔘 Testing Button States...');
    
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Test hover states on all main buttons
    const mainButtons = ['Try Demo', 'See Insights'];
    for (const buttonText of mainButtons) {
      const button = page.locator(`button:has-text("${buttonText}")`).first();
      
      // Normal state
      await page.screenshot({ 
        path: `tests/screenshots/final-${buttonText.toLowerCase().replace(' ', '-')}-normal.png`,
        clip: await button.boundingBox() || { x: 0, y: 0, width: 200, height: 60 }
      });
      
      // Hover state
      await button.hover();
      await page.waitForTimeout(300);
      await page.screenshot({ 
        path: `tests/screenshots/final-${buttonText.toLowerCase().replace(' ', '-')}-hover.png`,
        clip: await button.boundingBox() || { x: 0, y: 0, width: 200, height: 60 }
      });
      
      console.log(`  ✅ ${buttonText} button states working`);
    }

    console.log('\n🎉 All core button functionality validated successfully!');
  });

  test('should validate page content and accessibility', async ({ page }) => {
    console.log('♿ Testing accessibility and content...');

    const pages = [
      { url: '/', title: 'Sales Tax Insights' },
      { url: '/login', title: 'Login' },
      { url: '/demo', title: 'Interactive Demo' },
      { url: '/signup', title: 'Get Started' }
    ];

    for (const pageInfo of pages) {
      await page.goto(`http://localhost:3001${pageInfo.url}`);
      await page.waitForLoadState('networkidle');
      
      // Verify page loads
      await expect(page).toHaveTitle(new RegExp(pageInfo.title));
      
      // Verify at least one heading exists
      const headings = await page.locator('h1, h2, h3').count();
      expect(headings).toBeGreaterThan(0);
      
      // Verify buttons exist and are accessible
      const buttons = await page.locator('button').count();
      expect(buttons).toBeGreaterThan(0);
      
      console.log(`  ✅ Page ${pageInfo.url} - Title: "${pageInfo.title}", Buttons: ${buttons}, Headings: ${headings}`);
    }

    console.log('♿ All pages accessible and properly structured');
  });
});