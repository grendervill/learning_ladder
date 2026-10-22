import { existsSync, readdirSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildContext } from "../context"
import { migrate, openDatabase } from "../db"
import type { MentorService } from "../mentor/service"
import type { CourseSnapshot, LessonContent } from "../content/types"
import { finalizeSession, getLastReport, recordActivity, startSession } from "./lifecycle"

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
