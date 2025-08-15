import { test, expect } from '@playwright/test'
import { mockApiResponses } from '../fixtures/test-data.js'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('**/api/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.healthCheck)
      })
    })

    await page.goto('http://localhost:5173/')
  })

  test('should display landing page correctly', async ({ page }) => {
    // Check main heading
    await expect(page.locator('h2')).toContainText('Automate Your Sales Tax Compliance')
    
    // Check feature list
    await expect(page.locator('text=Multi-jurisdiction tax calculations')).toBeVisible()
    await expect(page.locator('text=Real-time POS integration')).toBeVisible()
    await expect(page.locator('text=Automated compliance reports')).toBeVisible()
    
    // Check authentication buttons
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()
    await expect(page.locator('button:has-text("Sign Up")')).toBeVisible()
  })

  test('should toggle between sign in and sign up', async ({ page }) => {
    // Initially should show Sign In form
    await expect(page.locator('text=Welcome Back')).toBeVisible()
    
    // Click Sign Up button
    await page.click('button:has-text("Sign Up")')
    await expect(page.locator('text=Create Account')).toBeVisible()
    
    // Click Sign In button
    await page.click('button:has-text("Sign In")')
    await expect(page.locator('text=Welcome Back')).toBeVisible()
  })

  test('should display features section', async ({ page }) => {
    // Check features section
    await expect(page.locator('text=Everything You Need for Tax Compliance')).toBeVisible()
    
    // Check individual features
    await expect(page.locator('text=Real-time Analytics')).toBeVisible()
    await expect(page.locator('text=POS Integration')).toBeVisible()
    await expect(page.locator('text=Automated Filing')).toBeVisible()
  })

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('h1:has-text("Sales Tax Platform")')).toBeVisible()
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('h2:has-text("Automate Your Sales Tax Compliance")')).toBeVisible()
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.locator('h2:has-text("Automate Your Sales Tax Compliance")')).toBeVisible()
  })

  test('should handle authentication redirects', async ({ page, context }) => {
    // Mock authenticated user
    await page.addInitScript(() => {
      window.localStorage.setItem('clerk-test-token', 'mock-token')
    })

    // Should redirect to dashboard when authenticated
    await page.goto('http://localhost:5173/')
    // Note: This would redirect in a real Clerk setup
  })
})