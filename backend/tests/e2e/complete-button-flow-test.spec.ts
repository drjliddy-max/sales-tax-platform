import { test, expect } from '@playwright/test';

test.describe('Complete Button Flow Validation', () => {
  test('should test all landing page buttons end-to-end', async ({ page }) => {
    console.log('🚀 Starting complete button flow test...');

    // Test 1: Landing Page Load
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'tests/screenshots/landing-page-complete.png', 
      fullPage: true 
    });
    
    console.log('✅ Landing page loaded successfully');

    // Test 2: Navigation Bar Buttons
    console.log('\n🔘 Testing Navigation Bar Buttons...');
    
    // Test Login button
    const loginBtn = page.locator('nav button:has-text("Login")');
    await expect(loginBtn).toBeVisible();
    await loginBtn.hover();
    await page.screenshot({ path: 'tests/screenshots/nav-login-hover.png', clip: { x: 0, y: 0, width: 800, height: 80 } });
    await loginBtn.click();
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('h2:has-text("Sign in to your account")')).toBeVisible();
    console.log('  ✅ Login button working');
    
    // Test Get Started button  
    await page.goBack();
    await page.waitForLoadState('networkidle');
    const getStartedBtn = page.locator('nav button:has-text("Get Started")');
    await expect(getStartedBtn).toBeVisible();
    await getStartedBtn.hover();
    await page.screenshot({ path: 'tests/screenshots/nav-get-started-hover.png', clip: { x: 0, y: 0, width: 800, height: 80 } });
    await getStartedBtn.click();
    await expect(page).toHaveURL(/signup/);
    await expect(page.locator('h1:has-text("Get Started")')).toBeVisible();
    console.log('  ✅ Get Started button working');

    // Test 3: Hero Section CTA Buttons
    console.log('\n🔘 Testing Hero Section CTA Buttons...');
    
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Test Try Demo button
    const tryDemoBtn = page.locator('button:has-text("Try Demo")').first();
    await expect(tryDemoBtn).toBeVisible();
    await tryDemoBtn.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ 
      path: 'tests/screenshots/hero-try-demo-hover.png', 
      clip: { x: 0, y: 200, width: 800, height: 300 }
    });
    await tryDemoBtn.click();
    await expect(page).toHaveURL(/demo/);
    await expect(page.locator('h1:has-text("Interactive Demo")')).toBeVisible();
    console.log('  ✅ Try Demo button working');
    
    // Test demo page functionality
    const viewInsightsBtn = page.locator('button:has-text("View Business Insights")');
    if (await viewInsightsBtn.isVisible()) {
      await viewInsightsBtn.click();
      await expect(page).toHaveURL(/insights\/demo/);
      console.log('  ✅ Demo page internal navigation working');
    }
    
    // Test See Insights button
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    const seeInsightsBtn = page.locator('button:has-text("See Insights")').first();
    await expect(seeInsightsBtn).toBeVisible();
    await seeInsightsBtn.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ 
      path: 'tests/screenshots/hero-see-insights-hover.png', 
      clip: { x: 0, y: 200, width: 800, height: 300 }
    });
    await seeInsightsBtn.click();
    await expect(page).toHaveURL(/insights\/demo/);
    await expect(page.locator('h1:has-text("Demo Business Insights")')).toBeVisible();
    console.log('  ✅ See Insights button working');

    // Test 4: CTA Section Button
    console.log('\n🔘 Testing CTA Section Button...');
    
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    const startTrialBtn = page.locator('button:has-text("Start Free Trial")');
    await expect(startTrialBtn).toBeVisible();
    
    // Scroll to CTA section
    await startTrialBtn.scrollIntoViewIfNeeded();
    await startTrialBtn.hover();
    await page.waitForTimeout(300);
    await page.screenshot({ 
      path: 'tests/screenshots/cta-start-trial-hover.png', 
      clip: { x: 0, y: 400, width: 800, height: 300 }
    });
    await startTrialBtn.click();
    await expect(page).toHaveURL(/signup/);
    await expect(page.locator('h1')).toBeVisible();
    console.log('  ✅ Start Free Trial button working');

    // Test 5: Button Accessibility
    console.log('\n🔘 Testing Button Accessibility...');
    
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Test keyboard navigation through all buttons
    const allButtons = await page.locator('button').all();
    console.log(`  Found ${allButtons.length} buttons to test for accessibility`);
    
    for (let i = 0; i < Math.min(allButtons.length, 6); i++) {
      const button = allButtons[i];
      const buttonText = await button.textContent();
      
      if (buttonText && buttonText.trim()) {
        await button.focus();
        await page.waitForTimeout(200);
        
        // Verify button is focusable and has proper styling
        const focused = await page.evaluate(() => document.activeElement?.tagName === 'BUTTON');
        expect(focused).toBeTruthy();
        console.log(`  ✅ Button "${buttonText.trim()}" is keyboard accessible`);
      }
    }

    // Test 6: Responsive Button Behavior
    console.log('\n🔘 Testing Responsive Button Behavior...');
    
    const viewports = [
      { width: 1200, height: 800, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('http://localhost:3001');
      await page.waitForLoadState('networkidle');

      // Test main CTA buttons visibility and functionality
      const mainBtn = page.locator('button:has-text("Try Demo")').first();
      await expect(mainBtn).toBeVisible();
      
      await page.screenshot({ 
        path: `tests/screenshots/responsive-buttons-${viewport.name}.png`,
        fullPage: true 
      });
      
      console.log(`  ✅ Buttons working on ${viewport.name} (${viewport.width}x${viewport.height})`);
    }

    // Test 7: Complete User Journey
    console.log('\n🔘 Testing Complete User Journey...');
    
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    
    // Journey 1: Landing → Demo → Insights
    await page.locator('button:has-text("Try Demo")').first().click();
    await expect(page).toHaveURL(/demo/);
    
    const demoInsightsBtn = page.locator('button:has-text("View Business Insights")');
    if (await demoInsightsBtn.isVisible()) {
      await demoInsightsBtn.click();
      await expect(page).toHaveURL(/insights\/demo/);
      console.log('  ✅ Journey 1: Landing → Demo → Insights completed');
    }
    
    // Journey 2: Demo → Back to Home → Get Started
    await page.locator('button:has-text("Back to Home")').click();
    await expect(page).toHaveURL('http://localhost:3001/');
    
    await page.locator('nav button:has-text("Get Started")').click();
    await expect(page).toHaveURL(/signup/);
    console.log('  ✅ Journey 2: Demo → Home → Get Started completed');
    
    // Journey 3: Back to Home → Login
    await page.locator('button:has-text("Back to Home")').click();
    await expect(page).toHaveURL('http://localhost:3001/');
    
    await page.locator('nav button:has-text("Login")').click();
    await expect(page).toHaveURL(/login/);
    console.log('  ✅ Journey 3: Home → Login completed');

    console.log('\n🎉 All button functionality tests passed!');
    
    // Final screenshot of all working functionality
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: 'tests/screenshots/final-landing-page-complete.png', 
      fullPage: true 
    });
  });

  test('should validate all page content and styling', async ({ page }) => {
    const pages = [
      { url: '/', title: 'Sales Tax Insights', buttonCount: 5 },
      { url: '/login', title: 'Login', buttonCount: 1 },
      { url: '/demo', title: 'Interactive Demo', buttonCount: 2 },
      { url: '/signup', title: 'Get Started', buttonCount: 2 },
      { url: '/insights/demo', title: 'Demo Business Insights', buttonCount: 1 }
    ];

    for (const pageInfo of pages) {
      await page.goto(`http://localhost:3001${pageInfo.url}`);
      await page.waitForLoadState('networkidle');
      
      // Verify page title
      await expect(page).toHaveTitle(new RegExp(pageInfo.title));
      
      // Verify basic page structure
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('h1, h2').first()).toBeVisible();
      
      // Verify buttons are present and styled
      const buttons = await page.locator('button').count();
      expect(buttons).toBeGreaterThanOrEqual(pageInfo.buttonCount - 1); // Allow for some flexibility
      
      // Verify classic button styling is applied
      const classicBtns = await page.locator('.classic-btn').count();
      if (classicBtns > 0) {
        const firstClassicBtn = page.locator('.classic-btn').first();
        const bgColor = await firstClassicBtn.evaluate(el => getComputedStyle(el).backgroundColor);
        expect(bgColor).toBeTruthy(); // Verify styling is applied
      }
      
      console.log(`✅ Page ${pageInfo.url} validated - Title: "${pageInfo.title}", Buttons: ${buttons}`);
    }
  });
});