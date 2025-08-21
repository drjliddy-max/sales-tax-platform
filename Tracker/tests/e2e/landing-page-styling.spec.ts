import { test, expect } from '@playwright/test';

test.describe('Landing Page Styling', () => {
  test('should have proper styling and layout', async ({ page }) => {
    await page.goto('http://127.0.0.1:3002');
    
    // Check that the page loads successfully
    await expect(page).toHaveTitle(/Sales Tax/);
    
    // Verify navigation elements
    await expect(page.locator('nav')).toBeVisible();
    
    // Verify hero section
    await expect(page.locator('h1')).toContainText('Automate Your');
    
    // Check CTA buttons
    await expect(page.locator('text=Start Free Trial')).toBeVisible();
    await expect(page.locator('text=View Pricing')).toBeVisible();
    
    // Verify features section
    await expect(page.locator('text=POS Integration')).toBeVisible();
    await expect(page.locator('text=Smart Reporting')).toBeVisible();
    await expect(page.locator('text=Real-time Updates')).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('http://127.0.0.1:3002');
    
    // Test sign in link
    await page.click('text=Sign In');
    await expect(page).toHaveURL(/.*login/);
    
    // Go back to home
    await page.goto('http://127.0.0.1:3002');
    
    // Test pricing link
    await page.click('text=View Pricing');
    await expect(page).toHaveURL(/.*pricing/);
  });
});
