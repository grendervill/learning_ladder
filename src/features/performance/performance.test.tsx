import { cleanup, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PerformancePage } from "./PerformancePage"
import { renderWithProviders } from "../../test/render"

const course = {
  version: "test",
  chapters: [
    {
      id: "foundations",
      title: "Основы",
      description: "",
      lessonIds: ["01-hello-lua", "02-variables-types"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: [
    { id: "01-hello-lua", title: "Hello, Lua", errors: [] },
    { id: "02-variables-types", title: "Переменные и типы", errors: [] },
  ],
  unassigned: [],
  errors: [],
  access: {
    lessons: { "01-hello-lua": "passed", "02-variables-types": "available" },
    chapters: { foundations: "in_progress" },
    nextLessonId: "02-variables-types",
    nextChapterQuizId: null,
  },
  currentSession: null,
}

const progress = {
  access: course.access,
  lessons: {
    "01-hello-lua": {
      lessonId: "01-hello-lua",
      title: "Hello, Lua",
      status: "passed",
      bestGrade: 5,
      lastGrade: 5,
      attempts: 1,
      passedAt: new Date().toISOString(),
      importedFrom: "PROGRESS.md",
      feedback: null,
    },
    "02-variables-types": {
      lessonId: "02-variables-types",
      title: "Переменные и типы",
      status: "available",
      bestGrade: null,
      lastGrade: null,
      attempts: 0,
      passedAt: null,
      importedFrom: null,
      feedback: null,
    },
  },
  chapters: {
    foundations: {
      chapterId: "foundations",
      status: "in_progress",
      grade: null,
      bestGrade: null,
      attempts: 0,
      passedAt: null,
      feedback: null,
    },
  },
  attempts: [
    {
      id: 1,
      scope: "lesson",
      scopeId: "01-hello-lua",
      kind: "lesson",
      submittedAt: new Date().toISOString(),
      grade: 5,
      feedback: { summary: "Отличная работа" },
    },
  ],
  sessions: [
    {
      id: "sess_1",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: "completed",
      summaryMd: "## Общая оценка\nХорошее занятие.\n## Сильные стороны\n- Терпение.",
      statsJson: null,
    },
  ],
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (String(url).includes("/api/progress") ? progress : course),
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("PerformancePage", () => {
  it("shows grades, attempts and reports", async () => {
    renderWithProviders(<PerformancePage />)
    expect(await screen.findByText("Твой маршрут целиком")).toBeInTheDocument()
    expect(screen.getByText("Основы")).toBeInTheDocument()
    expect(screen.getAllByText("5").length).toBeGreaterThan(0)
    expect(screen.getByText("Отличная работа")).toBeInTheDocument()
    expect(screen.getByText("Итоги занятий")).toBeInTheDocument()
  })
})
