import type { Page } from "@playwright/test"

export async function dismissReport(page: Page) {
  const close = page.locator(".report-card__foot button")
  await close.waitFor({ state: "visible", timeout: 2000 }).catch(() => {})
  if (await close.isVisible().catch(() => false)) {
    await close.click()
  }
}
