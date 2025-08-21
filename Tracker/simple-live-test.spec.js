const { test, expect } = require('@playwright/test');

test('SalesTaxBot Live Platform', async ({ page }) => {
  console.log('🚀 Testing live SalesTaxBot platform...');
  
  // Go directly to your live Vercel deployment
  await page.goto('https://salestaxbot-landing-67sfxfk2q-liddy.vercel.app/dashboard.html');
  
  // Simple checks
  await expect(page.locator('text=SalesTaxBot')).toBeVisible();
  console.log('✅ Platform loaded');
  
  await page.screenshot({ path: 'live-test.png' });
  console.log('📸 Screenshot saved');
  
  console.log('🎉 Test complete!');
});
