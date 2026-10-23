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
  await page.route("**/api/constructor-prompt", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        prompt: "Ты методист. Собирай курс по схеме.",
        defaultPrompt: "Стандартный промпт.",
        path: "/tmp/constructor.md",
      }),
    }),
  )

  await page.goto("/settings")
  await dismissReport(page)
  await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible()
  await expect(page.getByText("Все проверки пройдены")).toHaveCount(0)
  await expect(page.getByText("1 с замечаниями")).toBeVisible()
  await expect(page.locator(".check-row")).toHaveCount(4)

  await page.getByRole("tab", { name: "Конструктор" }).click()
  await expect(page.locator(".mentor-textarea")).toHaveValue(/Ты методист/)

  await page.getByRole("tab", { name: "Нейросеть" }).click()
  await expect(page.getByRole("radiogroup", { name: "Провайдер нейросети" })).toBeVisible()
  await expect(page.locator(".provider-card")).toHaveCount(6)
  await expect(page.locator(".settings-input").first()).toHaveValue(/deepseek/)

  await page.getByRole("tab", { name: "Папка проекта" }).click()
  await expect(page.getByRole("heading", { name: "Папка проекта" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Сменить папку проекта" })).toBeVisible()
})

test("shows per-course settings and mentor prompt", async ({ page }) => {
  await page.goto("/courses/lua/settings")
  await dismissReport(page)
  await expect(page.getByRole("heading", { name: "Настройки курса" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Карточка" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Наставник" })).toBeVisible()
  await expect(page.getByLabel("Промпт наставника курса")).toHaveValue(/наставник/i)
  await expect(page.getByRole("heading", { name: "Практика" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Проверки курса" })).toBeVisible()
})
