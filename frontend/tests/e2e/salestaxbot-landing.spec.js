import { test, expect } from '@playwright/test'

test.describe('SalesTaxBot Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/')
  })

  test('should load the landing page successfully', async ({ page }) => {
    // Check that the page loads and has the SalesTaxBot branding
    await expect(page.locator('nav').getByText('SalesTaxBot')).toBeVisible()
    
    // Check for the main heading
    await expect(page.locator('h1:has-text("Automate Your")')).toBeVisible()
    await expect(page.locator('span:has-text("Sales Tax Compliance")')).toBeVisible()
  })

  test('should display navigation elements', async ({ page }) => {
    // Check navigation links
    await expect(page.locator('nav a[href="#features"]')).toBeVisible()
    await expect(page.locator('nav a[href="#pricing"]')).toBeVisible()
    await expect(page.locator('nav a[href="#contact"]')).toBeVisible()
    
    // Check Sign In button (use first() to handle multiple matches)
    await expect(page.locator('nav button:has-text("Sign In")').first()).toBeVisible()
  })

  test('should display hero section with CTAs', async ({ page }) => {
    // Check hero section content
    await expect(page.locator('text=Connect your POS systems')).toBeVisible()
    await expect(page.locator('text=Never worry about tax compliance again')).toBeVisible()
    
    // Check CTA buttons in hero section
    await expect(page.locator('section button:has-text("Start Free Trial")').first()).toBeVisible()
    await expect(page.locator('section button:has-text("View Demo")').first()).toBeVisible()
    
    // Check free trial text
    await expect(page.locator('text=No credit card required')).toBeVisible()
    await expect(page.locator('text=14-day free trial')).toBeVisible()
  })

  test('should display stats section', async ({ page }) => {
    // Check stats are visible
    await expect(page.locator('text=$45,678')).toBeVisible()
    await expect(page.locator('text=Average Monthly Sales Tracked')).toBeVisible()
    await expect(page.locator('text=99.9%')).toBeVisible()
    await expect(page.locator('text=Tax Calculation Accuracy')).toBeVisible()
  })

  test('should display features section', async ({ page }) => {
    // Navigate to features section (use first() for nav link)
    await page.locator('nav a[href="#features"]').first().click()
    
    // Check section is visible
    await expect(page.locator('#features')).toBeVisible()
    await expect(page.locator('h2:has-text("Everything You Need for Tax Compliance")')).toBeVisible()
    
    // Check feature cards
    await expect(page.locator('h3:has-text("POS Integration")')).toBeVisible()
    await expect(page.locator('h3:has-text("Smart Reporting")')).toBeVisible()
    await expect(page.locator('h3:has-text("Real-time Updates")')).toBeVisible()
  })

  test('should display pricing section', async ({ page }) => {
    // Navigate to pricing section (use first() for nav link)
    await page.locator('nav a[href="#pricing"]').first().click()
    
    // Check pricing section
    await expect(page.locator('#pricing')).toBeVisible()
    await expect(page.locator('h2:has-text("Simple, Transparent Pricing")')).toBeVisible()
    
    // Check pricing tiers
    await expect(page.locator('h3:has-text("Starter")')).toBeVisible()
    await expect(page.locator('h3:has-text("Professional")')).toBeVisible()
    await expect(page.locator('h3:has-text("Enterprise")')).toBeVisible()
    
    // Check pricing
    await expect(page.locator('text=$29')).toBeVisible()
    await expect(page.locator('text=$99')).toBeVisible()
    
    // Check "Most Popular" badge
    await expect(page.locator('text=Most Popular')).toBeVisible()
  })

  test('should display footer section', async ({ page }) => {
    // Navigate to footer
    await page.locator('a[href="#contact"]').click()
    
    // Check footer content
    await expect(page.locator('#contact')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await expect(page.locator('text=© 2025 SalesTaxBot. All rights reserved.')).toBeVisible()
    
    // Check footer links
    await expect(page.locator('h3:has-text("Product")')).toBeVisible()
    await expect(page.locator('h3:has-text("Support")')).toBeVisible()
  })

  test('should handle Sign In button clicks', async ({ page }) => {
    // Click Sign In button and check if it navigates (will likely show Clerk sign-in)
    const signInButton = page.locator('button:has-text("Sign In")').first()
    await expect(signInButton).toBeVisible()
    
    // We can't test the actual navigation because it requires Clerk authentication
    // But we can verify the button is clickable
    await expect(signInButton).toBeEnabled()
  })

  test('should handle Start Free Trial buttons', async ({ page }) => {
    // Check all "Start Free Trial" buttons are present and clickable
    const trialButtons = page.locator('button:has-text("Start Free Trial")')
    await expect(trialButtons.first()).toBeVisible()
    await expect(trialButtons.first()).toBeEnabled()
    
    // Count should be at least 3 (hero + pricing sections)
    const count = await trialButtons.count()
    expect(count).toBeGreaterThan(2)
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check that content is still visible and properly arranged
    await expect(page.locator('nav').getByText('SalesTaxBot')).toBeVisible()
    await expect(page.locator('h1:has-text("Automate Your")')).toBeVisible()
    
    // Check mobile-specific elements (like mobile sign-in button)
    await expect(page.locator('button:has-text("Sign In")').first()).toBeVisible()
    
    // Verify responsive pricing grid
    await page.locator('nav a[href="#pricing"]').first().click()
    await expect(page.locator('#pricing')).toBeVisible()
    await expect(page.locator('h3:has-text("Starter")')).toBeVisible()
  })
})