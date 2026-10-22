import { expect, test } from "@playwright/test"
import { dismissReport } from "./helpers"

const checks = {
  generatedAt: new Date().toISOString(),
  summary: { ok: 3, warn: 1, fail: 0 },
  checks: [
    { id: "server", group: "Система", label: "Сервер кабинета", status: "ok", detail: "Node v26.12.0 · darwin arm64" },
    { id: "lua", group: "Инструменты", label: "Lua", status: "ok", detail: "Lua 5.5.1" },
    { id: "opencode-service", group: "Инструменты", label: "Служба OpenCode", status: "warn", detail: "timeout", hint: "Поднимется при первом обращении." },
    { id: "network", group: "Наставник", label: "Нейросеть наставника", status: "ok", detail: "OpenCode · deepseek-v4.1-flash" },
  ],
}

test("shows settings checks and tabs", async ({ page }) => {
  await page.route("**/api/settings/checks", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(checks) }),
  )
  await page.route("**/api/settings/mentor-prompt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ prompt: "Ты наставник по Lua. Не давай готовый код.", path: "/tmp/lua-mentor.md" }),
    }),
  )

  await page.goto("/settings")
  await dismissReport(page)
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible()
  await expect(page.getByText("Все проверки пройдены")).toHaveCount(0)
  await expect(page.getByText("1 с замечаниями")).toBeVisible()
  await expect(page.locator(".check-row")).toHaveCount(4)

  await page.getByRole("tab", { name: "Наставник" }).click()
  await expect(page.locator(".mentor-textarea")).toHaveValue(/Не давай готовый код/)

  await page.getByRole("tab", { name: "Нейросеть" }).click()
  await expect(page.getByRole("radiogroup", { name: "Провайдер нейросети" })).toBeVisible()
  await expect(page.locator(".provider-card")).toHaveCount(6)
  await expect(page.locator(".settings-input").first()).toHaveValue(/deepseek/)
})
