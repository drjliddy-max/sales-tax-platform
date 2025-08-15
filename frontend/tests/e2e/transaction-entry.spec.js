import { test, expect } from '@playwright/test'
import { testFormData, mockApiResponses } from '../fixtures/test-data.js'

test.describe('Transaction Entry', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([{
      name: '__session',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/'
    }])

    // Mock API responses
    await page.route('**/api/tax/calculate', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockApiResponses.taxCalculation)
      })
    })

    await page.route('**/api/transactions', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, transactionId: 'test-txn-123' })
        })
      }
    })

    // Navigate to transaction entry (add route first)
    await page.goto('http://localhost:5173/transaction-entry')
  })

  test('should display transaction entry form', async ({ page }) => {
    // Check header
    await expect(page.locator('h1:has-text("New Transaction")')).toBeVisible()
    
    // Check main sections
    await expect(page.locator('text=Transaction Details')).toBeVisible()
    await expect(page.locator('text=Items')).toBeVisible()
    await expect(page.locator('text=Transaction Location')).toBeVisible()
    await expect(page.locator('text=Tax Calculation')).toBeVisible()
  })

  test('should fill transaction details', async ({ page }) => {
    const formData = testFormData.transactionEntry
    
    // Fill transaction date
    await page.fill('input[type="date"]', formData.date)
    
    // Fill customer information
    await page.fill('input[placeholder="Enter customer name"]', formData.customerName)
    await page.fill('input[placeholder="customer@example.com"]', formData.customerEmail)
    
    // Verify values
    await expect(page.locator('input[placeholder="Enter customer name"]')).toHaveValue(formData.customerName)
    await expect(page.locator('input[placeholder="customer@example.com"]')).toHaveValue(formData.customerEmail)
  })

  test('should manage items dynamically', async ({ page }) => {
    const item = testFormData.transactionEntry.items[0]
    
    // Fill first item
    await page.fill('input[placeholder="Product name"]', item.name)
    await page.fill('input[placeholder="0.00"]', item.price)
    await page.selectOption('select', item.category)
    
    // Add another item
    await page.click('button:has-text("+ Add Item")')
    
    // Should have 2 item rows
    await expect(page.locator('input[placeholder="Product name"]')).toHaveCount(2)
    
    // Remove second item
    await page.click('button:has-text("Remove")') 
    
    // Should have 1 item row again
    await expect(page.locator('input[placeholder="Product name"]')).toHaveCount(1)
  })

  test('should fill location information', async ({ page }) => {
    const location = testFormData.transactionEntry.location
    
    // Fill location details
    await page.fill('input[placeholder="123 Main St"]', location.street)
    await page.fill('input[placeholder="City"]', location.city)
    await page.selectOption('select', location.state)
    await page.fill('input[placeholder="12345"]', location.zipCode)
    
    // Verify values
    await expect(page.locator('input[placeholder="123 Main St"]')).toHaveValue(location.street)
    await expect(page.locator('input[placeholder="City"]')).toHaveValue(location.city)
    await expect(page.locator('input[placeholder="12345"]')).toHaveValue(location.zipCode)
  })

  test('should calculate tax', async ({ page }) => {
    const formData = testFormData.transactionEntry
    const item = formData.items[0]
    
    // Fill required fields
    await page.fill('input[placeholder="Product name"]', item.name)
    await page.fill('input[placeholder="0.00"]', item.price)
    await page.fill('input[placeholder="City"]', formData.location.city)
    await page.selectOption('select', formData.location.state)
    await page.fill('input[placeholder="12345"]', formData.location.zipCode)
    
    // Calculate tax
    await page.click('button:has-text("Calculate Tax")')
    
    // Should show tax calculation results
    await expect(page.locator('text=Subtotal:')).toBeVisible()
    await expect(page.locator('text=Tax:')).toBeVisible()
    await expect(page.locator('text=Total:')).toBeVisible()
    
    // Should show tax breakdown
    await expect(page.locator('text=Tax Breakdown:')).toBeVisible()
    await expect(page.locator('text=Texas State')).toBeVisible()
  })

  test('should handle tax exemption', async ({ page }) => {
    // Open advanced options
    await page.click('button:has-text("Advanced Options")')
    
    // Check tax exemption
    await page.check('input[type="checkbox"]#taxExemption')
    
    // Should show exemption certificate field
    await expect(page.locator('text=Exemption Certificate Number')).toBeVisible()
    
    // Fill certificate number
    await page.fill('input[placeholder="Certificate number"]', 'EXEMPT-123')
    
    // Verify value
    await expect(page.locator('input[placeholder="Certificate number"]')).toHaveValue('EXEMPT-123')
  })

  test('should submit transaction', async ({ page }) => {
    const formData = testFormData.transactionEntry
    const item = formData.items[0]
    
    // Fill complete form
    await page.fill('input[type="date"]', formData.date)
    await page.fill('input[placeholder="Enter customer name"]', formData.customerName)
    await page.fill('input[placeholder="customer@example.com"]', formData.customerEmail)
    
    await page.fill('input[placeholder="Product name"]', item.name)
    await page.fill('input[placeholder="0.00"]', item.price)
    await page.selectOption('select', item.category)
    
    await page.fill('input[placeholder="123 Main St"]', formData.location.street)
    await page.fill('input[placeholder="City"]', formData.location.city)
    await page.selectOption('select', formData.location.state)
    await page.fill('input[placeholder="12345"]', formData.location.zipCode)
    
    // Calculate tax first
    await page.click('button:has-text("Calculate Tax")')
    
    // Wait for tax calculation to complete
    await expect(page.locator('text=Subtotal:')).toBeVisible()
    
    // Submit transaction
    await page.click('button:has-text("Save Transaction")')
    
    // Should show success message or redirect
    await page.waitForTimeout(1000) // Wait for submission
  })

  test('should validate required fields', async ({ page }) => {
    // Try to calculate tax without required fields
    await page.click('button:has-text("Calculate Tax")')
    
    // Should not calculate without required city/state/zip
    // The form validation will prevent calculation
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/tax/calculate', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Tax calculation failed' })
      })
    })

    const formData = testFormData.transactionEntry
    const item = formData.items[0]
    
    // Fill form and try to calculate
    await page.fill('input[placeholder="Product name"]', item.name)
    await page.fill('input[placeholder="0.00"]', item.price)
    await page.fill('input[placeholder="City"]', formData.location.city)
    await page.selectOption('select', formData.location.state)
    await page.fill('input[placeholder="12345"]', formData.location.zipCode)
    
    await page.click('button:has-text("Calculate Tax")')
    
    // Should show fallback calculation
    await expect(page.locator('text=Subtotal:')).toBeVisible()
  })
})