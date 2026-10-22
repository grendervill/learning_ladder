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

  it("uses a single practice tab with the 50/50 quiz for general courses", async () => {
    const general = {
      id: "econ-1",
      title: "Инфляция",
      theoryMarkdown: "## Инфляция\n\nЦены растут, деньги дешевеют.",
      practiceIntro: "",
      tasks: [],
      quiz: {
        title: "Проверка знаний",
        questions: [
          { id: "q1", type: "single", prompt: "Что растёт?", options: ["Цены", "Налоги"] },
          { id: "q2", type: "single", prompt: "Что падает?", options: ["Спрос", "Способность"] },
          { id: "q3", type: "text", prompt: "Объясните причину." },
          { id: "q4", type: "text", prompt: "Приведите пример." },
        ],
      },
      errors: [],
      answers: {},
      access: "available",
      chapterId: "econ-c1",
      chapterTitle: "Деньги",
      course: {
        id: "econ",
        title: "Экономика",
        mode: "general",
        settings: {
          runtime: "none",
          runCommand: "",
          lspCommand: "",
          lspArgs: [],
          fileExtension: ".txt",
          entry: "main.txt",
        },
      },
    }
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: true,
      json: async () => general,
    }))

    renderWithProviders(<LessonPage lessonId="econ-1" />)
    expect(await screen.findByRole("heading", { name: "Инфляция", level: 1 })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Практика" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Вопросы" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Практика" }))
    expect(await screen.findByText("Проверка знаний")).toBeInTheDocument()
    expect(screen.getByText("Готов сдать урок?")).toBeInTheDocument()
  })
})
