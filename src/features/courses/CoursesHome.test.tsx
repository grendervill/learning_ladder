import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CoursesHome } from "./CoursesHome"
import { renderWithProviders } from "../../test/render"
import type { CourseCard } from "../../lib/types"

const settings = {
  runtime: "none" as const,
  runCommand: "",
  lspCommand: "",
  lspArgs: [],
  fileExtension: ".txt",
  entry: "main.txt",
}

function card(id: string, title: string, percent: number): CourseCard {
  return {
    id,
    title,
    description: "Короткое описание курса.",
    theme: "forest",
    icon: "book",
    mode: "general",
    settings,
    builtIn: false,
    createdAt: "2026-10-22T00:00:00.000Z",
    progress: { passed: 0, total: 4, percent, nextLessonId: `${id}-1`, chapterCount: 2 },
  }
}

function response(value: unknown) {
  return { ok: true, json: async () => value }
}

let courses: CourseCard[]
let total: number

beforeEach(() => {
  courses = [card("lua", "Lua", 25), card("econ", "Экономика", 0)]
  total = 2
  window.scrollTo = vi.fn()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = new URL(String(input), "http://localhost")
      if (url.pathname === "/api/project") {
        return response({
          root: "/tmp/ladder-project",
          courses: total,
          exists: true,
          writable: true,
          defaultRoot: "/tmp/ladder-project",
          isDefault: true,
        })
      }
      if (url.pathname === "/api/courses") {
        const page = Number(url.searchParams.get("page") ?? 1)
        const query = (url.searchParams.get("query") ?? "").toLowerCase()
        const filtered = courses.filter((course) =>
          `${course.title} ${course.description}`.toLowerCase().includes(query),
        )
        const start = (page - 1) * 25
        return response({
          courses: filtered.slice(start, start + 25),
          total: filtered.length,
          page,
          pageSize: 25,
          pages: Math.ceil(filtered.length / 25),
        })
      }
      return response({})
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("CoursesHome", () => {
  it("renders course cards with progress and the create card", async () => {
    renderWithProviders(<CoursesHome />)
    expect(await screen.findByRole("heading", { name: "Lua" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Экономика" })).toBeInTheDocument()
    expect(screen.getByText("25%")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Создать курс/ }).length).toBeGreaterThan(0)
  })

  it("filters cards by the search query", async () => {
    renderWithProviders(<CoursesHome />)
    await screen.findByRole("heading", { name: "Lua" })
    fireEvent.change(screen.getByLabelText("Поиск по курсам"), { target: { value: "эконом" } })
    expect(await screen.findByRole("heading", { name: "Экономика" })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Lua" })).not.toBeInTheDocument())
  })

  it("shows the project fallback warning", async () => {
    courses = []
    total = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: any) => {
        const url = new URL(String(input), "http://localhost")
        if (url.pathname === "/api/project") {
          return response({
            root: "/tmp/fallback",
            courses: 0,
            exists: true,
            writable: true,
            defaultRoot: "/tmp/default",
            isDefault: false,
            fallbackError: "Сохранённая папка недоступна",
          })
        }
        if (url.pathname === "/api/courses") {
          return response({ courses: [], total: 0, page: 1, pageSize: 25, pages: 0 })
        }
        return response({})
      }),
    )
    renderWithProviders(<CoursesHome />)
    expect(await screen.findByText("Сохранённая папка недоступна")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Настройки папки" })).toBeInTheDocument()
  })

  it("shows the project path when there are no courses", async () => {
    courses = []
    total = 0
    renderWithProviders(<CoursesHome />)
    expect(await screen.findByText("Пока ни одного курса")).toBeInTheDocument()
    expect(screen.getByText("/tmp/ladder-project")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Изменить папку проекта" })).toBeInTheDocument()
  })

  it("paginates twenty-five cards per page", async () => {
    courses = Array.from({ length: 26 }, (_, index) =>
      card(`course-${index + 1}`, `Курс ${index + 1}`, 0),
    )
    total = 26
    renderWithProviders(<CoursesHome />)
    expect(await screen.findByRole("heading", { name: "Курс 1" })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { name: /^Курс / })).toHaveLength(25)
    expect(screen.getByText("Страница 1 из 2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Вперёд/ }))
    expect(await screen.findByText("Страница 2 из 2")).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getAllByRole("heading", { name: /^Курс / })).toHaveLength(1),
    )
  })
})
