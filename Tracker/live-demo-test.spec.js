const { test, expect } = require("@playwright/test");

test("SalesTaxBot Live Demo Test", async ({ page }) => {
  console.log("🌍 Testing SalesTaxBot live platform...");
  
  await page.goto("https://salestaxbot-landing-67sfxfk2q-liddy.vercel.app/dashboard.html");
  await expect(page.locator("text=SalesTaxBot")).toBeVisible();
  console.log("✅ Platform loaded successfully");
  
  await expect(page.locator("text=Welcome to SalesTaxBot")).toBeVisible();
  console.log("✅ Welcome message verified");
  
  await page.screenshot({ path: "dashboard-test.png" });
  console.log("📸 Screenshot captured");
  
  console.log("🎉 Live demo test completed!");
});
