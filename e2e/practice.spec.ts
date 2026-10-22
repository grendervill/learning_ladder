import { expect, test } from "@playwright/test"
import { dismissReport } from "./helpers"

test("runs code and shows LSP diagnostics", async ({ page }) => {
  await page.goto("/lessons/02-variables-types?tab=practice")
  await dismissReport(page)
  await expect(page.locator(".cm-editor")).toBeVisible()
  await expect(page.locator(".lsp-status")).toContainText(/LSP live|LSP недоступен/, { timeout: 15_000 })

  await page.locator(".cm-content").click()
  await page.keyboard.press("Control+End")
  await page.keyboard.type('\nlocal = 1')
  await expect(page.locator(".cm-lintRange-error").first()).toBeVisible({ timeout: 15_000 })

  await page.getByRole("button", { name: "Проверить" }).click()
  await expect(page.locator(".run-console__stdout")).toBeVisible({ timeout: 15_000 })
})
