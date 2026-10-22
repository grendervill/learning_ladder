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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => courseResponse,
    })),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.removeAttribute("data-theme")
})

describe("AppShell", () => {
  it("renders chapters and locked lessons", async () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>child</div>} />
        </Route>
      </Routes>,
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
