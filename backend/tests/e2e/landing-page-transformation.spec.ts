import { test, expect, Page } from '@playwright/test';

test.describe('Landing Page Styling Transformation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForLoadState('networkidle');
  });

  test('should transform landing page with classic button styling', async ({ page }) => {
    // Take a screenshot of the original page
    await page.screenshot({ 
      path: 'tests/screenshots/landing-page-before.png', 
      fullPage: true 
    });

    // Apply enhanced styling transformations
    await page.addStyleTag({
      content: `
        /* Enhanced Classic Button Styles */
        .classic-btn {
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          transform-origin: center;
        }

        .classic-btn:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1), 0 6px 6px rgba(0, 0, 0, 0.1);
        }

        .classic-btn:active {
          transform: translateY(-1px) scale(0.98);
          box-shadow: 0 5px 10px rgba(0, 0, 0, 0.2);
        }

        .classic-btn.primary {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          border: none;
          box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4);
        }

        .classic-btn.primary:hover {
          background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
          box-shadow: 0 10px 20px rgba(79, 70, 229, 0.6);
        }

        .classic-btn.secondary {
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          border: 2px solid #4f46e5;
          color: #4f46e5;
          box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.2);
        }

        .classic-btn.secondary:hover {
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          border-color: #4338ca;
          color: #4338ca;
        }

        /* Add ripple effect */
        .classic-btn::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 5px;
          height: 5px;
          background: rgba(255, 255, 255, 0.5);
          opacity: 0;
          border-radius: 100%;
          transform: scale(1, 1) translate(-50%);
          transform-origin: 50% 50%;
        }

        .classic-btn:focus:not(:active)::after {
          animation: ripple 1s ease-out;
        }

        @keyframes ripple {
          0% {
            transform: scale(0, 0);
            opacity: 1;
          }
          20% {
            transform: scale(25, 25);
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(40, 40);
          }
        }

        /* Enhanced hero section */
        .hero-section {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          position: relative;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><polygon fill="%23ffffff08" points="0,0 1000,300 1000,1000 0,700"/></svg>');
          background-size: cover;
        }

        /* Improved navigation */
        nav {
          backdrop-filter: blur(20px);
          background: rgba(255, 255, 255, 0.95);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        /* Feature cards enhancement */
        .feature-card {
          transition: all 0.4s ease;
          background: linear-gradient(145deg, #ffffff, #f8fafc);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }

        .feature-card:hover {
          transform: translateY(-8px) rotate(1deg);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        /* Typography improvements */
        h1, h2, h3 {
          font-weight: 800;
          letter-spacing: -0.025em;
        }

        /* Add subtle animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-in {
          animation: fadeInUp 0.6s ease-out forwards;
        }

        /* Stagger animations */
        .animate-in:nth-child(1) { animation-delay: 0.1s; }
        .animate-in:nth-child(2) { animation-delay: 0.2s; }
        .animate-in:nth-child(3) { animation-delay: 0.3s; }
        .animate-in:nth-child(4) { animation-delay: 0.4s; }
      `
    });

    // Add intersection observer for scroll animations
    await page.evaluate(() => {
      const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      }, observerOptions);

      // Observe elements for animation
      document.querySelectorAll('.relative, .space-y-10 > div, .feature-card').forEach(el => {
        observer.observe(el);
      });
    });

    // Wait for animations to trigger
    await page.waitForTimeout(1000);

    // Take a screenshot of the transformed page
    await page.screenshot({ 
      path: 'tests/screenshots/landing-page-after-transform.png', 
      fullPage: true 
    });

    // Test button interactions
    await page.hover('button:has-text("Try Demo")');
    await page.screenshot({ 
      path: 'tests/screenshots/button-hover-state.png',
      clip: { x: 0, y: 300, width: 800, height: 200 }
    });

    // Test button click animation
    await page.click('button:has-text("Try Demo")');
    await page.waitForTimeout(500);
    
    // Verify navigation worked
    await expect(page).toHaveURL(/demo/);
    
    // Go back to test secondary button
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Test secondary button
    await page.hover('button:has-text("See Insights")');
    await page.screenshot({ 
      path: 'tests/screenshots/secondary-button-hover.png',
      clip: { x: 0, y: 300, width: 800, height: 200 }
    });

    await page.click('button:has-text("See Insights")');
    await expect(page).toHaveURL(/insights\/demo/);
  });

  test('should verify responsive button behavior', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1200, height: 800, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('http://localhost:3001');
      await page.waitForLoadState('networkidle');

      // Take screenshot of each viewport
      await page.screenshot({ 
        path: `tests/screenshots/responsive-${viewport.name}.png`,
        fullPage: true 
      });

      // Test button visibility and functionality
      const tryDemoButton = page.locator('button:has-text("Try Demo")');
      const seeInsightsButton = page.locator('button:has-text("See Insights")');
      
      await expect(tryDemoButton).toBeVisible();
      await expect(seeInsightsButton).toBeVisible();
      
      // Test click functionality
      await tryDemoButton.click();
      await expect(page).toHaveURL(/demo/);
      await page.goBack();
    }
  });

  test('should validate classic button accessibility', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Navigate to first button
    await page.screenshot({ 
      path: 'tests/screenshots/keyboard-focus-first-button.png',
      clip: { x: 0, y: 0, width: 800, height: 100 }
    });

    await page.keyboard.press('Tab'); // Navigate to second button  
    await page.screenshot({ 
      path: 'tests/screenshots/keyboard-focus-second-button.png',
      clip: { x: 0, y: 0, width: 800, height: 100 }
    });

    // Test Enter key activation
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/signup/);
    
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Test focus states for main CTA buttons
    await page.focus('button:has-text("Try Demo")');
    await page.screenshot({ 
      path: 'tests/screenshots/cta-button-focus.png',
      clip: { x: 0, y: 200, width: 800, height: 300 }
    });

    // Verify button attributes for accessibility
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const buttonText = await button.textContent();
      if (buttonText) {
        // Check that buttons have proper roles and are focusable
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
        
        // Verify click functionality
        const boundingBox = await button.boundingBox();
        if (boundingBox) {
          await button.hover();
          await page.waitForTimeout(200); // Wait for hover animation
        }
      }
    }
  });

  test('should create comparison screenshots', async ({ page }) => {
    // Original styling
    await page.screenshot({ 
      path: 'tests/screenshots/original-styling.png', 
      fullPage: true 
    });

    // Apply minimal classic styling
    await page.addStyleTag({
      content: `
        .classic-btn {
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 12px 24px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .classic-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
        }
        
        .classic-btn.secondary {
          background: white;
          color: #2563eb;
          border: 2px solid #2563eb;
        }
        
        .classic-btn.secondary:hover {
          background: #eff6ff;
        }
      `
    });

    await page.screenshot({ 
      path: 'tests/screenshots/minimal-classic-styling.png', 
      fullPage: true 
    });

    console.log('✅ All transformation screenshots saved to tests/screenshots/');
  });
});