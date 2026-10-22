import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import { DEFAULT_COURSE_META, DEFAULT_LUA_COURSE_META } from "../content/defaults"
import type { CourseMeta, CourseSnapshot, LessonContent, Quiz } from "../content/types"

const quiz: Quiz = {
  title: "Проверка",
  questions: [
    { id: "s1", type: "single", prompt: "1", options: ["a", "b"], correct: 0, explanation: "a" },
    { id: "s2", type: "single", prompt: "2", options: ["a", "b"], correct: 1, explanation: "b" },
    { id: "t1", type: "text", prompt: "3", referenceAnswer: "a", criteria: ["a"] },
    { id: "t2", type: "text", prompt: "4", referenceAnswer: "b", criteria: ["b"] },
  ],
}

function lesson(id: string, courseId: string, title: string): LessonContent {
  return {
    id,
    courseId,
    title,
    theoryMarkdown: "## Теория\n\nТекст",
    practiceIntro: "",
    tasks: [],
    quiz,
    errors: [],
  }
}

const luaMeta: CourseMeta = {
  ...DEFAULT_LUA_COURSE_META,
  createdAt: "2026-10-22T00:00:00.000Z",
}
const econMeta: CourseMeta = {
  ...DEFAULT_COURSE_META,
  format: "generated",
  id: "econ",
  title: "Экономика",
  description: "Рынки, деньги и решения.",
  theme: "amber",
  icon: "chart",
  mode: "general",
  builtIn: false,
  createdAt: "2026-10-22T12:00:00.000Z",
}

function snapshot(extraCourses = 0): CourseSnapshot {
  const extra: CourseMeta[] = Array.from({ length: extraCourses }, (_, index) => ({
    ...DEFAULT_COURSE_META,
    format: "generated",
    id: `extra-${index + 1}`,
    title: `Курс ${index + 1}`,
    description: "Дополнительный курс.",
    createdAt: `2026-09-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
  }))
  return {
    version: "test",
    courses: [luaMeta, econMeta, ...extra],
    chapters: [
      {
        id: "lua-foundations",
        courseId: "lua",
        title: "Основы",
        description: "",
        lessonIds: ["lua-1", "lua-2", "lua-3"],
        quiz,
        errors: [],
      },
      {
        id: "lua-next",
        courseId: "lua",
        title: "Дальше",
        description: "",
        lessonIds: ["lua-4"],
        quiz,
        errors: [],
      },
      {
        id: "econ-c1",
        courseId: "econ",
        title: "Деньги",
        description: "",
        lessonIds: ["econ-1", "econ-2"],
        quiz: null,
        errors: [],
      },
      {
        id: "econ-c2",
        courseId: "econ",
        title: "Рынки",
        description: "",
        lessonIds: ["econ-3"],
        quiz: null,
        errors: [],
      },
    ],
    lessons: {
      "lua-1": lesson("lua-1", "lua", "Первый"),
      "lua-2": lesson("lua-2", "lua", "Второй"),
      "lua-3": lesson("lua-3", "lua", "Третий"),
      "lua-4": lesson("lua-4", "lua", "Четвёртый"),
      "econ-1": lesson("econ-1", "econ", "Инфляция"),
      "econ-2": lesson("econ-2", "econ", "Спрос"),
      "econ-3": lesson("econ-3", "econ", "Рынки"),
    },
    unassigned: [],
    errors: [],
  }
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-courses-api-"))
  mkdirSync(join(dir, "courses", "econ"), { recursive: true })
  writeFileSync(
    join(dir, "courses", "econ", "course.json"),
    JSON.stringify({ ...econMeta, format: "generated", chapters: [], lessons: {} }),
    "utf8",
  )
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function makeApp(extraCourses = 0) {
  const db = openDatabase(":memory:")
  migrate(db)
  const course = snapshot(extraCourses)
  const app = createApp({
    db,
    course,
    root: dir,
    progressPath: resolve(dir, "missing-progress.md"),
  })
  return { app, db }
}

function markPassed(db: ReturnType<typeof openDatabase>, lessonId: string) {
  db.prepare("insert into lesson_progress (lesson_id, status, best_grade) values (?, 'passed', 5)").run(
    lessonId,
  )
}

describe("courses api", () => {
  it("lists courses with progress and search", async () => {
    const { app } = makeApp()
    const all = await request(app).get("/api/courses")
    expect(all.status).toBe(200)
    expect(all.body.total).toBe(2)
    expect(all.body.courses).toHaveLength(2)
    const econ = all.body.courses.find((course: any) => course.id === "econ")
    expect(econ).toMatchObject({ title: "Экономика", theme: "amber", icon: "chart" })
    expect(econ.progress).toMatchObject({ passed: 0, total: 3, percent: 0, nextLessonId: "econ-1", chapterCount: 2 })

    const search = await request(app).get("/api/courses?query=эконом")
    expect(search.body.total).toBe(1)
    expect(search.body.courses[0].id).toBe("econ")

    const none = await request(app).get("/api/courses?query=физика")
    expect(none.body.total).toBe(0)
    expect(none.body.courses).toEqual([])
  })

  it("caps the page at 25 courses", async () => {
    const { app } = makeApp(26)
    const first = await request(app).get("/api/courses?page=1")
    expect(first.body.pageSize).toBe(25)
    expect(first.body.total).toBe(28)
    expect(first.body.courses).toHaveLength(25)
    expect(first.body.pages).toBe(2)

    const second = await request(app).get("/api/courses?page=2")
    expect(second.body.page).toBe(2)
    expect(second.body.courses).toHaveLength(3)
  })

  it("returns a course with only its own chapters and lessons", async () => {
    const { app } = makeApp()
    const res = await request(app).get("/api/courses/econ")
    expect(res.status).toBe(200)
    expect(res.body.course.id).toBe("econ")
    expect(res.body.chapters).toHaveLength(2)
    expect(res.body.lessons).toHaveLength(3)
    expect(res.body.access.lessons["econ-1"]).toBe("available")
    expect(res.body.access.lessons["econ-2"]).toBe("locked")
    expect(res.body.lessons.map((item: any) => item.id)).not.toContain("lua-1")
    expect(res.body.progress.nextLessonId).toBe("econ-1")
  })

  it("keeps the Lua chapter quiz gate and auto-passes generated chapters", async () => {
    const { app, db } = makeApp()
    markPassed(db, "lua-1")
    markPassed(db, "lua-2")
    markPassed(db, "lua-3")
    const lua = await request(app).get("/api/courses/lua")
    expect(lua.body.access.chapters["lua-foundations"]).toBe("in_progress")
    expect(lua.body.access.lessons["lua-4"]).toBe("locked")

    markPassed(db, "econ-1")
    markPassed(db, "econ-2")
    markPassed(db, "econ-3")
    const econ = await request(app).get("/api/courses/econ")
    expect(econ.body.access.chapters["econ-c1"]).toBe("passed")
    expect(econ.body.access.chapters["econ-c2"]).toBe("passed")
  })

  it("returns the course runtime with a lesson", async () => {
    const { app } = makeApp()
    const res = await request(app).get("/api/lessons/econ-1")
    expect(res.status).toBe(200)
    expect(res.body.course).toMatchObject({ id: "econ", mode: "general" })
    expect(res.body.course.settings.runtime).toBe("none")
    expect(res.body.quiz.questions).toHaveLength(4)
  })

  it("updates course settings and preserves generated content", async () => {
    const { app } = makeApp()
    const res = await request(app)
      .put("/api/courses/econ/settings")
      .send({
        title: "Экономика для жизни",
        theme: "ocean",
        mode: "general",
        settings: {
          runtime: "python",
          runCommand: "python3 {file}",
          lspCommand: "pyright-langserver",
          lspArgs: ["--stdio"],
          fileExtension: ".py",
          entry: "main.py",
        },
      })
    expect(res.status).toBe(200)
    expect(res.body.course).toMatchObject({ title: "Экономика для жизни", theme: "ocean" })
    const raw = JSON.parse(readFileSync(join(dir, "courses", "econ", "course.json"), "utf8"))
    expect(raw.title).toBe("Экономика для жизни")
    expect(raw.settings).toMatchObject({ runtime: "python", fileExtension: ".py" })
    expect(raw.chapters).toEqual([])
  })

  it("rejects invalid course settings", async () => {
    const { app } = makeApp()
    const badTheme = await request(app).put("/api/courses/econ/settings").send({ theme: "rainbow" })
    expect(badTheme.status).toBe(400)
    const badRuntime = await request(app)
      .put("/api/courses/econ/settings")
      .send({ settings: { runtime: "brainfuck" } })
    expect(badRuntime.status).toBe(400)
  })

  it("reads and writes the course mentor prompt", async () => {
    const { app } = makeApp()
    const initial = await request(app).get("/api/courses/econ/mentor-prompt")
    expect(initial.status).toBe(200)
    expect(initial.body.prompt).toContain("Лестница обучения")
    const saved = await request(app)
      .put("/api/courses/econ/mentor-prompt")
      .send({ prompt: "Только экономика, без Lua." })
    expect(saved.status).toBe(200)
    expect(readFileSync(join(dir, "courses", "econ", "mentor.md"), "utf8")).toContain("Только экономика")
    const read = await request(app).get("/api/courses/econ/mentor-prompt")
    expect(read.body.prompt).toBe("Только экономика, без Lua.")
  })

  it("reports course checks", async () => {
    const { app } = makeApp()
    const res = await request(app).get("/api/courses/econ/checks")
    expect(res.status).toBe(200)
    const ids = res.body.checks.map((check: any) => check.id)
    expect(ids).toEqual(expect.arrayContaining(["materials", "runtime", "lsp", "mentor-prompt"]))
    expect(res.body.checks.find((check: any) => check.id === "runtime").status).toBe("ok")
  })
})
