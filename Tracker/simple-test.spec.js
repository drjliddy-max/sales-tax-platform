const { test, expect } = require("@playwright/test");
test("SalesTaxBot Dashboard", async ({ page }) => {
  await page.goto("https://salestaxbot-landing-67sfxfk2q-liddy.vercel.app/dashboard.html");
  await expect(page.locator("text=SalesTaxBot")).toBeVisible();
  console.log("✅ Platform accessible");
});
