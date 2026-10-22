import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QuizTab } from "./QuizTab"
import { renderWithProviders } from "../../test/render"

const lesson = {
  id: "02-variables-types",
  title: "Переменные и типы",
  theoryMarkdown: "",
  practiceIntro: "",
  tasks: [],
  quiz: {
    title: "Проверь себя",
    questions: [
      {
        id: "q1",
        type: "single",
        prompt: "Что вернёт type(42)?",
        options: ["number", "string"],
      },
      {
        id: "q2",
        type: "text",
        prompt: "Почему local лучше глобала?",
        placeholder: "Ответь своими словами",
      },
    ],
  },
  errors: [],
  access: "available",
  chapterId: "foundations",
  chapterTitle: "Основы",
  answers: {},
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return { ok: true, json: async () => ({ ok: true }) }
      }
      return { ok: true, json: async () => lesson }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("QuizTab", () => {
  it("renders mixed questions and saves answers", async () => {
    renderWithProviders(<QuizTab lessonId="02-variables-types" />)

    expect(await screen.findByRole("radio", { name: "number" })).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.getByText(/отвечено 0 из 2/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("radio", { name: "number" }))
    await waitFor(
      () =>
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining("/quiz-answers"),
          expect.objectContaining({ method: "PUT" }),
        ),
      { timeout: 1500 },
    )
    expect(await screen.findByText(/отвечено 1 из 2/)).toBeInTheDocument()
  })
})
