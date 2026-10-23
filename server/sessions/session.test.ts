import { existsSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildContext } from "../context"
import { DEFAULT_COURSE_META } from "../content/defaults"
import { migrate, openDatabase } from "../db"
import type { MentorService } from "../mentor/service"
import type { CourseSnapshot, LessonContent } from "../content/types"
import {
  buildSessionStats,
  finalizeSession,
  finalizeStaleSessions,
  getLastReport,
  recordActivity,
  startSession,
} from "./lifecycle"

function lesson(id: string): LessonContent {
  return {
    id,
    title: id,
    theoryMarkdown: "",
    practiceIntro: "",
    tasks: [],
    quiz: null,
    errors: [],
  }
}

const snapshot: CourseSnapshot = {
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
  lessons: {
    "01-hello-lua": lesson("01-hello-lua"),
    "02-variables-types": lesson("02-variables-types"),
  },
  unassigned: [],
  errors: [],
}

function context() {
  const db = openDatabase(":memory:")
  migrate(db)
  db.prepare("insert into lesson_progress (lesson_id, status, best_grade, attempts) values ('01-hello-lua', 'passed', 5, 1)").run()
  return buildContext(db, snapshot, resolve(process.cwd(), "does-not-exist.md"))
}

const multiSnapshot: CourseSnapshot = {
  version: "test",
  courses: [
    { ...DEFAULT_COURSE_META, id: "lua", title: "Lua", mode: "programming", builtIn: true },
    { ...DEFAULT_COURSE_META, id: "econ", title: "Экономика", mode: "general", builtIn: false },
  ],
  chapters: [
    {
      id: "lua-c1",
      courseId: "lua",
      title: "Основы Lua",
      description: "",
      lessonIds: ["lua-1"],
      quiz: null,
      errors: [],
    },
    {
      id: "econ-c1",
      courseId: "econ",
      title: "Деньги",
      description: "",
      lessonIds: ["econ-1"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: {
    "lua-1": { ...lesson("lua-1"), courseId: "lua", title: "Первый запуск" },
    "econ-1": { ...lesson("econ-1"), courseId: "econ", title: "Бюджет" },
  },
  unassigned: [],
  errors: [],
}

function multiContext() {
  const db = openDatabase(":memory:")
  migrate(db)
  db.prepare(
    "insert into lesson_progress (lesson_id, status, best_grade, attempts) values ('lua-1', 'passed', 5, 1)",
  ).run()
  db.prepare(
    "insert into lesson_progress (lesson_id, status, best_grade, attempts) values ('econ-1', 'passed', 4, 1)",
  ).run()
  return buildContext(db, multiSnapshot, resolve(process.cwd(), "does-not-exist.md"))
}

function mentor(overrides: Partial<MentorService> = {}): MentorService {
  return {
    createSession: async () => "mentor-session",
    deleteSession: async () => {},
    reviewLesson: async () => {
      throw new Error("not used")
    },
    askMentor: async () => "",
    summarizeSession: async () => `## Общая оценка
Хорошо.
## Что прошёл
Основы.
## Процент от задуманного
50%.
## Сильные стороны
- Терпение.
## Слабые стороны
- Спешка.
## Напутствие
Продолжай.
## Рекомендации по текущей главе
Повтори local.
## Рекомендации на следующую главу
Повтори таблицы.`,
    classifyFolders: async () => ({ assignments: [], newChapters: [], reason: "" }),
    ...overrides,
  }
}

const files: string[] = []

afterEach(() => {
  for (const file of files.splice(0)) rmSync(file, { force: true })
})

describe("study sessions", () => {
  it("discards a short visit without an ai call", async () => {
    const ctx = context()
    const summarize = vi.fn(mentor().summarizeSession)
    const session = startSession(ctx)
    const result = await finalizeSession(ctx, mentor({ summarizeSession: summarize }), session.id)
    expect(result.status).toBe("discarded")
    expect(summarize).not.toHaveBeenCalled()
  })

  it("clears the mentor session when a visit is discarded", async () => {
    const ctx = context()
    const session = startSession(ctx)
    ctx.db.prepare("update study_sessions set mentor_session_id = 'm' where id = ?").run(session.id)
    const deleteSession = vi.fn(async () => {})
    const result = await finalizeSession(ctx, mentor({ deleteSession }), session.id)
    expect(deleteSession).toHaveBeenCalledWith("m")
    expect(result.mentor_session_id).toBeNull()
  })

  it("finalizes sessions idle longer than 30 minutes", async () => {
    const ctx = context()
    const session = startSession(ctx)
    ctx.db
      .prepare("update study_sessions set started_at = ? where id = ?")
      .run(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), session.id)
    const count = await finalizeStaleSessions(ctx, mentor())
    expect(count).toBe(1)
    const row = ctx.db.prepare("select status from study_sessions where id = ?").get(session.id) as any
    expect(row.status).toBe("discarded")
  })

  it("creates a report after meaningful activity", async () => {
    const ctx = context()
    const session = startSession(ctx)
    recordActivity(ctx, { kind: "run", lessonId: "01-hello-lua" })
    const result = await finalizeSession(ctx, mentor(), session.id)
    expect(result.status).toBe("completed")
    expect(result.summary_md).toContain("Сильные стороны")
    const report = getLastReport(ctx.db)
    expect(report?.id).toBe(session.id)
    const reportFiles = readdirSync(resolve(process.cwd(), "reports"))
    const file = reportFiles.find((name) => name.includes(session.id.slice(-8)))
    expect(file).toBeTruthy()
    if (file) files.push(resolve(process.cwd(), "reports", file))
  })

  it("groups session stats by course", () => {
    const ctx = multiContext()
    const session = startSession(ctx)
    const stats = buildSessionStats(ctx, session)
    expect(stats.courses.map((course) => course.title)).toEqual(["Lua", "Экономика"])
    expect(stats.courses[0]).toMatchObject({ passed: 1, total: 1, percent: 100 })
    expect(stats.courses[1].lessons[0].title).toBe("Бюджет")
    expect(stats.lessons).toHaveLength(2)
    expect(stats.percent).toBe(100)
  })

  it("falls back without ai when the mentor is down", async () => {
    const ctx = context()
    const session = startSession(ctx)
    recordActivity(ctx, { kind: "quiz_answer", lessonId: "01-hello-lua" })
    const result = await finalizeSession(
      ctx,
      mentor({
        summarizeSession: async () => {
          throw new Error("mentor_down")
        },
      }),
      session.id,
    )
    expect(result.status).toBe("completed_with_warnings")
    expect(result.summary_md).toContain("без ИИ")
  })
})
