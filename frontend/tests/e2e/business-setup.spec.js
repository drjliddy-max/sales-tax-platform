import { test, expect } from '@playwright/test'
import { testFormData } from '../fixtures/test-data.js'

test.describe('Business Setup', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock authenticated state
    await context.addCookies([{
      name: '__session',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/'
    }])

    // Mock API responses
    await page.route('**/api/businesses', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, businessId: 'test-business-123' })
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ businesses: [] })
        })
      }
    })

    await page.goto('http://localhost:5173/business-setup')
  })

  test('should display business setup form', async ({ page }) => {
    // Check header
    await expect(page.locator('h1:has-text("Business Setup")')).toBeVisible()
    
    // Check progress steps
    await expect(page.locator('text=Business Information')).toBeVisible()
    await expect(page.locator('text=Address & Contact')).toBeVisible()
    await expect(page.locator('text=Tax Nexus')).toBeVisible()
    await expect(page.locator('text=Integrations')).toBeVisible()
  })

  test('should complete step 1 - business information', async ({ page }) => {
    // Fill business name
    await page.fill('input[placeholder="Enter your business name"]', testFormData.businessSetup.step1.businessName)
    
    // Select business type
    await page.selectOption('select', testFormData.businessSetup.step1.businessType)
    
    // Fill tax ID
    await page.fill('input[placeholder="XX-XXXXXXX"]', testFormData.businessSetup.step1.taxId)
    
    // Click next
    await page.click('button:has-text("Next")')
    
    // Should be on step 2
    await expect(page.locator('text=Street Address')).toBeVisible()
  })

  test('should complete step 2 - address and contact', async ({ page }) => {
    // Navigate to step 2
    await page.fill('input[placeholder="Enter your business name"]', testFormData.businessSetup.step1.businessName)
    await page.selectOption('select', testFormData.businessSetup.step1.businessType)
    await page.click('button:has-text("Next")')
    
    // Fill address
    await page.fill('input[placeholder*="Street"]', testFormData.businessSetup.step2.address.street)
    await page.fill('input[placeholder*="City"]', testFormData.businessSetup.step2.address.city)
    await page.selectOption('select', testFormData.businessSetup.step2.address.state)
    await page.fill('input[placeholder*="ZIP"]', testFormData.businessSetup.step2.address.zipCode)
    
    // Fill contact info
    await page.fill('input[placeholder*="phone"]', testFormData.businessSetup.step2.contact.phone)
    
    // Click next
    await page.click('button:has-text("Next")')
    
    // Should be on step 3
    await expect(page.locator('text=Select Tax Nexus States')).toBeVisible()
  })

  test('should complete step 3 - tax nexus', async ({ page }) => {
    // Navigate to step 3
    await page.fill('input[placeholder="Enter your business name"]', testFormData.businessSetup.step1.businessName)
    await page.selectOption('select', testFormData.businessSetup.step1.businessType)
    await page.click('button:has-text("Next")')
    
    await page.fill('input[placeholder*="Street"]', testFormData.businessSetup.step2.address.street)
    await page.fill('input[placeholder*="City"]', testFormData.businessSetup.step2.address.city)
    await page.selectOption('select', testFormData.businessSetup.step2.address.state)
    await page.fill('input[placeholder*="ZIP"]', testFormData.businessSetup.step2.address.zipCode)
    await page.click('button:has-text("Next")')
    
    // Select nexus states
    for (const state of testFormData.businessSetup.step3.nexusStates) {
      await page.check(`input[type="checkbox"] + span:has-text("${state}")`)
    }
    
    // Click next
    await page.click('button:has-text("Next")')
    
    // Should be on step 4
    await expect(page.locator('text=POS System')).toBeVisible()
  })

  test('should complete step 4 - integrations', async ({ page }) => {
    // Navigate to step 4
    await page.fill('input[placeholder="Enter your business name"]', testFormData.businessSetup.step1.businessName)
    await page.selectOption('select', testFormData.businessSetup.step1.businessType)
    await page.click('button:has-text("Next")')
    
    await page.fill('input[placeholder*="Street"]', testFormData.businessSetup.step2.address.street)
    await page.fill('input[placeholder*="City"]', testFormData.businessSetup.step2.address.city)
    await page.selectOption('select', testFormData.businessSetup.step2.address.state)
    await page.fill('input[placeholder*="ZIP"]', testFormData.businessSetup.step2.address.zipCode)
    await page.click('button:has-text("Next")')
    
    await page.check(`input[type="checkbox"] + span:has-text("TX")`)
    await page.click('button:has-text("Next")')
    
    // Select POS provider
    await page.selectOption('select', testFormData.businessSetup.step4.posProvider)
    
    // Select accounting provider
    await page.selectOption('select', testFormData.businessSetup.step4.accountingProvider)
    
    // Should show complete setup button
    await expect(page.locator('button:has-text("Complete Setup")')).toBeVisible()
  })

  test('should submit complete form', async ({ page }) => {
    // Fill all steps
    await page.fill('input[placeholder="Enter your business name"]', testFormData.businessSetup.step1.businessName)
    await page.selectOption('select', testFormData.businessSetup.step1.businessType)
    await page.click('button:has-text("Next")')
    
    await page.fill('input[placeholder*="Street"]', testFormData.businessSetup.step2.address.street)
    await page.fill('input[placeholder*="City"]', testFormData.businessSetup.step2.address.city)
    await page.selectOption('select', testFormData.businessSetup.step2.address.state)
    await page.fill('input[placeholder*="ZIP"]', testFormData.businessSetup.step2.address.zipCode)
    await page.click('button:has-text("Next")')
    
    await page.check(`input[type="checkbox"] + span:has-text("TX")`)
    await page.click('button:has-text("Next")')
    
    await page.selectOption('select', testFormData.businessSetup.step4.posProvider)
    
    // Submit form
    await page.click('button:has-text("Complete Setup")')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/)
  })

  test('should validate required fields', async ({ page }) => {
    // Try to proceed without filling required fields
    await page.click('button:has-text("Next")')
    
    // Should stay on step 1 and show validation
    await expect(page.locator('text=Business Information')).toBeVisible()
  })

  test('should allow going back to previous steps', async ({ page }) => {
    // Navigate to step 2
    await page.fill('input[placeholder="Enter your business name"]', testFormData.businessSetup.step1.businessName)
    await page.selectOption('select', testFormData.businessSetup.step1.businessType)
    await page.click('button:has-text("Next")')
    
    // Go back to step 1
    await page.click('button:has-text("Previous")')
    
    // Should be on step 1 with preserved data
    await expect(page.locator('input[placeholder="Enter your business name"]')).toHaveValue(testFormData.businessSetup.step1.businessName)
  })
})