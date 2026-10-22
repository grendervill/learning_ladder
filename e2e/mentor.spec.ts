import { expect, test } from "@playwright/test"
import { dismissReport } from "./helpers"

test("mentor answers without giving ready code", async ({ page }) => {
  await page.route("**/api/mentor/ask", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "Проверь, что возвращает `type(42)`. Какой это тип?",
        conversationId: "e2e-chat",
      }),
    })
  })

  await page.goto("/lessons/02-variables-types?tab=practice")
  await dismissReport(page)
  await page.locator(".mentor-fab").click()
  await expect(page.getByRole("dialog", { name: "Наставник" })).toBeVisible()
  await page.getByRole("textbox", { name: "Сообщение наставнику" }).fill("Почему type выдаёт string?")
  await page.getByRole("button", { name: "Отправить" }).click()
  await expect(page.getByText(/Проверь, что возвращает/)).toBeVisible()
})

test("ends a session and shows the report", async ({ page }) => {
  const report = {
    id: "sess_e2e",
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
    status: "completed",
    summary_md: "## Общая оценка\nХорошо.\n## Сильные стороны\n- Терпение.",
    stats_json: null,
  }
  await page.route("**/api/session/start", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sessionId: "sess_e2e", startedAt: new Date().toISOString(), status: "active" }),
    }),
  )
  await page.route("**/api/session/current", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ session: null, lastReport: null }),
    }),
  )
  await page.route("**/api/session/activity", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  )
  await page.route("**/api/session/end", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "completed", report }),
    }),
  )

  await page.goto("/")
  await page.locator(".sidebar-session--button").click()
  await expect(page.getByRole("dialog", { name: "Итог занятия" })).toBeVisible()
  await expect(page.getByText("Что получилось сегодня")).toBeVisible()
})
