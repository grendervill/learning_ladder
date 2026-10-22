import { expect, test } from "@playwright/test"
import { dismissReport } from "./helpers"

test("switches between light and dark theme", async ({ page }) => {
  await page.goto("/")
  await dismissReport(page)
  const toggle = page.locator(".sidebar .theme-toggle")
  await toggle.click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await toggle.click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
})
