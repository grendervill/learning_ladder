import { cleanup, fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Route, Routes } from "react-router-dom"
import { AppShell } from "./AppShell"
import { ThemeToggle } from "../components/ThemeToggle"
import { renderWithProviders } from "../test/render"

const courseResponse = {
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
    {
      id: "functions-and-data",
      title: "Функции и данные",
      description: "",
      lessonIds: ["04-functions"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: [
    { id: "01-hello-lua", title: "Hello, Lua", errors: [] },
    { id: "02-variables-types", title: "Переменные и типы", errors: [] },
    { id: "04-functions", title: "Функции", errors: [] },
  ],
  unassigned: [],
  errors: [],
  access: {
    lessons: {
      "01-hello-lua": "passed",
      "02-variables-types": "available",
      "04-functions": "locked",
    },
    chapters: {
      foundations: "in_progress",
      "functions-and-data": "locked",
    },
    nextLessonId: "02-variables-types",
    nextChapterQuizId: null,
  },
  currentSession: null,
}

const progress = {
  passed: 1,
  total: 3,
  percent: 33,
  nextLessonId: "02-variables-types",
  chapterCount: 2,
}

const detailResponse = {
  course: {
    id: "lua",
    title: "Lua",
    description: "Курс Lua",
    theme: "forest",
    icon: "code",
    mode: "programming",
    settings: {
      runtime: "lua",
      runCommand: "lua {file}",
      lspCommand: "lua-language-server",
      lspArgs: [],
      fileExtension: ".lua",
      entry: "main.lua",
    },
    builtIn: true,
    createdAt: "2026-10-22T00:00:00.000Z",
    format: "legacy",
  },
  progress,
  chapters: courseResponse.chapters,
  lessons: courseResponse.lessons,
  access: courseResponse.access,
  errors: [],
  unassigned: [],
}

const coursesResponse = {
  courses: [
    {
      ...detailResponse.course,
      progress,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  pages: 1,
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input)
      const payload = url.includes("/api/courses/lua")
        ? detailResponse
        : url.includes("/api/courses")
          ? coursesResponse
          : url.includes("/api/course")
            ? courseResponse
            : {}
      return { ok: true, json: async () => payload }
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.removeAttribute("data-theme")
})

describe("AppShell", () => {
  it("lists courses on the home screen", async () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>child</div>} />
        </Route>
      </Routes>,
    )

    expect(await screen.findByText("Lua")).toBeInTheDocument()
    expect(screen.getByText("Создать курс")).toBeInTheDocument()
    expect(screen.getByText("1 курс в проекте")).toBeInTheDocument()
  })

  it("renders chapters and locked lessons inside a course", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/courses/:courseId" element={<AppShell />}>
          <Route index element={<div>child</div>} />
        </Route>
      </Routes>,
      { route: "/courses/lua" },
    )

    expect(await screen.findByText("Основы")).toBeInTheDocument()
    expect(screen.getByText("Функции и данные")).toBeInTheDocument()
    expect(screen.getByText("Переменные и типы")).toBeInTheDocument()
    expect(screen.getAllByText("закрыто").length).toBeGreaterThan(0)
  })

  it("persists theme choice", () => {
    renderWithProviders(<ThemeToggle />)
    fireEvent.click(screen.getByRole("button", { name: /тёмная тема/i }))
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(localStorage.getItem("learninglua.theme")).toBe("dark")
  })
})
