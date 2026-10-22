import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SubmitPanel } from "./SubmitPanel"
import { renderWithProviders } from "../../test/render"
import type { LessonDetail } from "../../lib/types"

const lesson: LessonDetail = {
  id: "02-variables-types",
  title: "Переменные и типы",
  theoryMarkdown: "",
  practiceIntro: "",
  tasks: [
    {
      id: "task1",
      title: "Типы",
      prompt: "Сделай",
      kind: "code",
      entry: "main.lua",
      files: [{ name: "main.lua", content: 'print("ok")' }],
      args: [],
      stdin: "",
      timeoutMs: 3000,
    },
  ],
  quiz: {
    title: "Проверь себя",
    questions: [
      { id: "q1", type: "single", prompt: "1?", options: ["a", "b"] },
      { id: "q2", type: "text", prompt: "2?" },
    ],
  },
  errors: [],
  answers: { q1: 0, q2: "ответ" },
  access: "available",
  chapterId: "foundations",
  chapterTitle: "Основы",
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        grade: 4,
        verdict: "pass",
        passed: true,
        feedback: {
          grade: 4,
          verdict: "pass",
          summary: "Хорошая работа",
          strengths: ["Типы"],
          issues: ["Крайние случаи"],
          nextStep: "Дальше",
          tasks: [{ taskId: "task1", status: "ok", comment: "Верно" }],
          quiz: [{ questionId: "q1", correct: true, comment: "Верно" }],
        },
        nextLessonId: "03-control-flow",
        attempts: 1,
      }),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("SubmitPanel", () => {
  it("submits a complete lesson and shows the review", async () => {
    renderWithProviders(<SubmitPanel lesson={lesson} />)
    fireEvent.click(screen.getByRole("button", { name: "Сдать урок" }))

    expect(await screen.findByText("Урок закрыт")).toBeInTheDocument()
    expect(screen.getByText("Хорошая работа")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Следующий урок/ })).toHaveAttribute(
      "href",
      "/lessons/03-control-flow",
    )
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/submit"),
        expect.objectContaining({ method: "POST" }),
      ),
    )
  })
})
