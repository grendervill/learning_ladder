import { expect, test } from "@playwright/test"
import { dismissReport } from "./helpers"

test("opens the program and shows the current lesson", async ({ page }) => {
  await page.goto("/")
  await dismissReport(page)
  await expect(page.getByRole("heading", { name: "Твои курсы" })).toBeVisible()
  const card = page.locator(".course-card:not(.course-card--create)", { hasText: "Lua" }).first()
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.getByRole("heading", { name: "Lua", level: 1 })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Основы", level: 3 })).toBeVisible()
  await expect(page.getByText("Переменные и типы", { exact: false }).first()).toBeVisible()
})

test("searches courses and clears an empty result", async ({ page }) => {
  await page.goto("/")
  await dismissReport(page)
  await page.getByLabel("Поиск по курсам").fill("экономика")
  await expect(page.getByText("По запросу «экономика» ничего не нашлось.")).toBeVisible()
  await page.getByRole("button", { name: "Сбросить поиск" }).click()
  await expect(page.locator(".course-card:not(.course-card--create)", { hasText: "Lua" })).toBeVisible()
})

test("passes lesson 02 with a mocked mentor", async ({ page }) => {
  await page.route("**/api/lessons/02-variables-types", async (route) => {
    const response = await route.fetch()
    const json = await response.json()
    await route.fulfill({ response, json: { ...json, answers: {} } })
  })
  await page.route("**/api/lessons/02-variables-types/quiz-answers", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }),
  )
  await page.route("**/api/lessons/02-variables-types/submit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        grade: 4,
        verdict: "pass",
        passed: true,
        nextLessonId: "03-control-flow",
        attempts: 1,
        feedback: {
          grade: 4,
          verdict: "pass",
          summary: "Хорошая работа",
          strengths: ["Типы"],
          issues: ["Крайние случаи"],
          nextStep: "Дальше",
          tasks: [{ taskId: "task1_types", status: "ok", comment: "Верно" }],
          quiz: [
            { questionId: "type-number", correct: true, comment: "Верно" },
            { questionId: "false-values", correct: true, comment: "Верно" },
            { questionId: "why-local", correct: true, comment: "Верно" },
            { questionId: "read-input", correct: true, comment: "Верно" },
          ],
        },
      }),
    })
  })

  await page.goto("/lessons/02-variables-types")
  await dismissReport(page)
  await expect(page.getByRole("heading", { name: /Переменные и типы данных/ })).toBeVisible()

  await page.getByRole("tab", { name: "Вопросы" }).click()
  await page.locator(".quiz-option input[type=radio]").first().check()
  await page.locator(".quiz-question").nth(1).locator("input[type=radio]").first().check()
  const textareas = page.locator(".quiz-textarea")
  await textareas.nth(0).fill("local ограничивает область видимости")
  await textareas.nth(1).fill("io.read() и tonumber")
  await expect(page.locator(".quiz-save")).toContainText("сохранено")

  await page.getByRole("tab", { name: "Практика" }).click()
  await page.getByRole("button", { name: "Сдать урок" }).click()
  await expect(page.getByText("Урок закрыт")).toBeVisible()
  await expect(page.getByRole("link", { name: /Следующий урок/ })).toHaveAttribute(
    "href",
    "/courses/lua/lessons/03-control-flow",
  )
})
