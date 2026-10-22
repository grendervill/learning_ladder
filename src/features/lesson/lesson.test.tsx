import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LessonPage } from "./LessonPage"
import { TheoryTab } from "./TheoryTab"
import { renderWithProviders } from "../../test/render"

const lesson = {
  id: "02-variables-types",
  title: "Переменные и типы данных",
  theoryMarkdown:
    "## Переменные: global и local\n\nВ Lua переменная появляется в момент присваивания.\n\n```lua\nlocal x = 10\n```\n\n## Восемь типов\n\nВсего типов восемь.",
  practiceIntro: "1. `task1_types.lua` — угадай типы.",
  tasks: [
    {
      id: "task1_types",
      title: "Угадай тип",
      prompt: "Посмотри на значения.",
      kind: "code",
      entry: "task1_types.lua",
      files: [{ name: "task1_types.lua", content: "local values = {}" }],
      args: [],
      stdin: "",
      timeoutMs: 3000,
    },
  ],
  quiz: {
    title: "Проверь себя",
    questions: [
      { id: "q1", type: "single", prompt: "Что такое Lua?", options: ["язык", "редактор"] },
      { id: "q2", type: "text", prompt: "Зачем local?" },
    ],
  },
  errors: [],
  answers: {},
  access: "available",
  chapterId: "foundations",
  chapterTitle: "Основы",
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/files")) {
        return {
          ok: true,
          json: async () => ({
            files: lesson.tasks[0].files,
            starterFiles: lesson.tasks[0].files,
            kind: "code",
          }),
        }
      }
      return { ok: true, json: async () => lesson }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("LessonPage", () => {
  it("renders theory only and keeps practice in its tab", async () => {
    renderWithProviders(<LessonPage lessonId="02-variables-types" />)

    expect(
      await screen.findByRole("heading", { name: /Переменные: global и local/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText("task1_types.lua")).not.toBeInTheDocument()
  })

  it("switches tabs and renders practice intro", async () => {
    renderWithProviders(<LessonPage lessonId="02-variables-types" />)

    fireEvent.click(await screen.findByRole("tab", { name: "Практика" }))
    expect((await screen.findAllByText(/task1_types.lua/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Угадай тип/)).toBeInTheDocument()
  })

  it("does not render raw html from markdown", () => {
    renderWithProviders(<TheoryTab markdown={'<script>alert(1)</script>'} />)
    expect(document.querySelector("script")).toBeNull()
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument()
  })
})
