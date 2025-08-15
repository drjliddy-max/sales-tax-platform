import { test, expect } from '@playwright/test'
import { mockApiResponses } from '../fixtures/test-data.js'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([{
      name: '__session',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/'
    }])

    // Mock API responses
    await page.route('**/api/dashboard*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.dashboard)
      })
    })

    await page.route('**/api/transactions*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transactions: mockApiResponses.dashboard.recentTransactions })
      })
    })

    // Navigate to dashboard
    await page.goto('http://localhost:5173/dashboard')
  })

  test('should display dashboard metrics', async ({ page }) => {
    // Check welcome message
    await expect(page.locator('text=Welcome back')).toBeVisible()
    
    // Check metrics cards
    await expect(page.locator('text=Total Sales (This Month)')).toBeVisible()
    await expect(page.locator('text=$45,679')).toBeVisible()
    
    await expect(page.locator('text=Tax Collected')).toBeVisible()
    await expect(page.locator('text=$3,654')).toBeVisible()
    
    await expect(page.locator('text=Transactions')).toBeVisible()
    await expect(page.locator('text=156')).toBeVisible()
  })

  test('should display recent transactions', async ({ page }) => {
    // Check recent transactions section
    await expect(page.locator('text=Recent Transactions')).toBeVisible()
    
    // Check transaction items
    await expect(page.locator('text=John Doe')).toBeVisible()
    await expect(page.locator('text=Jane Smith')).toBeVisible()
    
    // Check transaction amounts
    await expect(page.locator('text=$124.99')).toBeVisible()
    await expect(page.locator('text=$256.78')).toBeVisible()
  })

  test('should display quick actions', async ({ page }) => {
    // Check quick actions section
    await expect(page.locator('text=Quick Actions')).toBeVisible()
    
    // Check individual action cards
    await expect(page.locator('text=View Transactions')).toBeVisible()
    await expect(page.locator('text=Generate Report')).toBeVisible()
    await expect(page.locator('text=Setup Integration')).toBeVisible()
    await expect(page.locator('text=Business Settings')).toBeVisible()
  })

  test('should navigate via quick actions', async ({ page }) => {
    // Test navigation to transactions
    await page.click('text=View Transactions')
    await expect(page).toHaveURL(/.*\/transactions/)
    await page.goBack()
    
    // Test navigation to reports
    await page.click('text=Generate Report')
    await expect(page).toHaveURL(/.*\/reports/)
    await page.goBack()
    
    // Test navigation to integrations
    await page.click('text=Setup Integration')
    await expect(page).toHaveURL(/.*\/integrations/)
    await page.goBack()
    
    // Test navigation to business setup
    await page.click('text=Business Settings')
    await expect(page).toHaveURL(/.*\/business-setup/)
  })

  test('should display sidebar navigation', async ({ page }) => {
    // Check sidebar items
    await expect(page.locator('text=Dashboard')).toBeVisible()
    await expect(page.locator('text=Transactions')).toBeVisible()
    await expect(page.locator('text=Tax Reports')).toBeVisible()
    await expect(page.locator('text=Integrations')).toBeVisible()
    await expect(page.locator('text=Business Setup')).toBeVisible()
    await expect(page.locator('text=Settings')).toBeVisible()
  })

  test('should be responsive with mobile sidebar', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Sidebar should be hidden on mobile
    await expect(page.locator('[data-testid="desktop-sidebar"]')).not.toBeVisible()
    
    // Mobile menu button should be visible
    await expect(page.locator('button:has-text("☰")')).toBeVisible()
    
    // Click mobile menu button
    await page.click('button:has-text("☰")')
    
    // Mobile sidebar should be visible
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/dashboard*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    await page.reload()
    
    // Should show loading or error state
    await expect(page.locator('text=Welcome back')).toBeVisible()
  })
})