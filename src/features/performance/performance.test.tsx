import { fireEvent, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PerformancePage } from "./PerformancePage"
import { renderWithProviders } from "../../test/render"

const settings = {
  runtime: "none" as const,
  runCommand: "",
  lspCommand: "",
  lspArgs: [],
  fileExtension: ".txt",
  entry: "main.txt",
}

function meta(id: string, title: string) {
  return {
    id,
    title,
    description: `${title} — описание`,
    theme: "forest" as const,
    icon: "book" as const,
    mode: "general" as const,
    settings,
    builtIn: false,
    createdAt: "2026-10-22T00:00:00.000Z",
  }
}

const courseA = meta("a", "Курс A")
const courseB = meta("b", "Курс B")

const cardA = {
  ...courseA,
  progress: { passed: 1, total: 1, percent: 100, nextLessonId: null, chapterCount: 1 },
}
const cardB = {
  ...courseB,
  progress: { passed: 0, total: 1, percent: 0, nextLessonId: "b-1", chapterCount: 1 },
}

function detail(course: typeof courseA, chapterId: string, chapterTitle: string, lessonId: string, lessonTitle: string) {
  return {
    course,
    progress: course.id === "a" ? cardA.progress : cardB.progress,
    chapters: [
      {
        id: chapterId,
        title: chapterTitle,
        description: "",
        lessonIds: [lessonId],
        quiz: null,
        errors: [],
      },
    ],
    lessons: [{ id: lessonId, title: lessonTitle, errors: [] }],
    access: {
      lessons: { [lessonId]: course.id === "a" ? "passed" : "available" },
      chapters: { [chapterId]: course.id === "a" ? "passed" : "available" },
      nextLessonId: lessonId,
      nextChapterQuizId: null,
    },
    errors: [],
    unassigned: [],
  }
}

const progressA = {
  courseId: "a",
  courseTitle: "Курс A",
  access: {
    lessons: { "a-1": "passed" },
    chapters: { "a-1": "passed" },
    nextLessonId: "a-1",
    nextChapterQuizId: null,
  },
  lessons: {
    "a-1": {
      lessonId: "a-1",
      title: "Урок A",
      status: "passed",
      bestGrade: 5,
      lastGrade: 5,
      attempts: 1,
      passedAt: "2026-10-22T10:00:00.000Z",
      importedFrom: null,
      feedback: null,
    },
  },
  chapters: {
    "a-1": {
      chapterId: "a-1",
      status: "passed",
      grade: 5,
      bestGrade: 5,
      attempts: 1,
      passedAt: "2026-10-22T10:00:00.000Z",
      feedback: null,
    },
  },
  attempts: [
    {
      id: 1,
      scope: "lesson",
      scopeId: "a-1",
      kind: "submit",
      submittedAt: "2026-10-22T10:00:00.000Z",
      grade: 5,
      courseId: "a",
      courseTitle: "Курс A",
      itemTitle: "Урок A",
      feedback: { summary: "Разбор A", strengths: [], issues: [] },
    },
  ],
  sessions: [],
}

const progressB = {
  courseId: "b",
  courseTitle: "Курс B",
  access: {
    lessons: { "b-1": "available" },
    chapters: { "b-1": "available" },
    nextLessonId: "b-1",
    nextChapterQuizId: null,
  },
  lessons: {
    "b-1": {
      lessonId: "b-1",
      title: "Урок B",
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
    "b-1": {
      chapterId: "b-1",
      status: "available",
      grade: null,
      bestGrade: null,
      attempts: 0,
      passedAt: null,
      feedback: null,
    },
  },
  attempts: [
    {
      id: 2,
      scope: "lesson",
      scopeId: "b-1",
      kind: "submit",
      submittedAt: "2026-10-23T10:00:00.000Z",
      grade: 4,
      courseId: "b",
      courseTitle: "Курс B",
      itemTitle: "Урок B",
      feedback: { summary: "Разбор B", strengths: [], issues: [] },
    },
  ],
  sessions: [],
}

function json(value: unknown) {
  return { ok: true, json: async () => value }
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: any) => {
      const url = String(input)
      if (url === "/api/courses?query=&page=1") {
        return json({
          courses: [cardA, cardB],
          total: 2,
          page: 1,
          pageSize: 25,
          pages: 1,
        })
      }
      if (url === "/api/courses/a") return json(detail(courseA, "a-1", "Глава A", "a-1", "Урок A"))
      if (url === "/api/courses/b") return json(detail(courseB, "b-1", "Глава B", "b-1", "Урок B"))
      if (url === "/api/progress?courseId=a") return json(progressA)
      if (url === "/api/progress?courseId=b") return json(progressB)
      return json({})
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("PerformancePage", () => {
  it("switches courses and labels attempts with the course and lesson", async () => {
    renderWithProviders(<PerformancePage />, { route: "/performance" })

    const select = await screen.findByRole("combobox", { name: "смотреть курс" })
    expect(select).toHaveValue("a")
    expect(await screen.findByText("Глава A")).toBeInTheDocument()

    fireEvent.change(select, { target: { value: "b" } })

    expect(await screen.findByText("Глава B")).toBeInTheDocument()
    expect(screen.getByText("Разбор B")).toBeInTheDocument()
    expect(document.querySelector(".attempt-course")?.textContent).toBe("Курс B")
    expect(screen.getAllByText("Урок B").length).toBeGreaterThan(0)
  })
})
