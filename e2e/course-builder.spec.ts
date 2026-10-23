import { expect, test } from "@playwright/test"
import { dismissReport } from "./helpers"

const questions = [
  {
    id: "goal",
    prompt: "Что для вас важно?",
    type: "multiple",
    options: ["Понять основы", "Решать задачи"],
  },
  {
    id: "level",
    prompt: "Какой у вас уровень?",
    type: "single",
    options: ["С нуля", "Что-то знаю"],
  },
]

const job = {
  id: "job-1",
  status: "done",
  phase: "Курс готов",
  completed: 2,
  total: 2,
  title: "Личные финансы с нуля",
  courseId: "course-test",
  lessonTitles: ["Бюджет", "Инфляция"],
  error: null,
  cancelRequested: false,
  createdAt: new Date().toISOString(),
}

test("creates a course through the wizard with a mocked constructor", async ({ page }) => {
  await page.route("**/api/courses/clarify", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ questions }) }),
  )
  await page.route("**/api/courses/generate", (route) =>
    route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ jobId: "job-1" }) }),
  )
  await page.route("**/api/courses/jobs/job-1", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(job) }),
  )

  await page.goto("/")
  await dismissReport(page)
  await page.locator(".courses-head .courses-button--primary").click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByPlaceholder(/Например/).fill("личные финансы")
  await page.getByRole("button", { name: /Продолжить/ }).click()
  await expect(page.getByText("Что для вас важно?")).toBeVisible()
  await page.getByLabel("Понять основы").check()
  await page.getByLabel("С нуля").check()
  await page.getByRole("button", { name: /Короткий/ }).click()
  await page.getByRole("button", { name: /Собрать курс/ }).click()
  await expect(page.getByRole("heading", { name: "Личные финансы с нуля" })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole("button", { name: /Открыть курс/ })).toBeVisible()
})
