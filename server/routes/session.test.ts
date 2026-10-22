import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { MentorService } from "../mentor/service"
import type { CourseSnapshot, LessonContent } from "../content/types"

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
      lessonIds: ["01-hello-lua"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: { "01-hello-lua": lesson("01-hello-lua") },
  unassigned: [],
  errors: [],
}

function mentor(): MentorService {
  return {
    createSession: async () => "mentor",
    deleteSession: async () => {},
    reviewLesson: async () => {
      throw new Error("not used")
    },
    askMentor: async () => "",
    summarizeSession: async () =>
      "## Общая оценка\nХорошо\n## Что прошёл\nОсновы\n## Процент от задуманного\n50%\n## Сильные стороны\n- Да\n## Слабые стороны\n- Нет\n## Напутствие\nДальше\n## Рекомендации по текущей главе\nПовтори\n## Рекомендации на следующую главу\nЧитай",
    classifyFolders: async () => ({ assignments: [], newChapters: [], reason: "" }),
  }
}

function makeApp() {
  const db = openDatabase(":memory:")
  migrate(db)
  return createApp({
    db,
    course: snapshot,
    progressPath: resolve(process.cwd(), "does-not-exist.md"),
    mentor: mentor(),
  })
}

describe("session api", () => {
  it("starts, records activity and returns a report", async () => {
    const app = makeApp()
    const started = await request(app).post("/api/session/start").send({})
    expect(started.body.sessionId).toMatch(/^sess_/)

    await request(app)
      .post("/api/session/activity")
      .send({ kind: "run", lessonId: "01-hello-lua" })

    const ended = await request(app).post("/api/session/end").send({ wait: true })
    expect(ended.body.status).toBe("completed")
    expect(ended.body.report.summary_md).toContain("Сильные стороны")

    const current = await request(app).get("/api/session/current")
    expect(current.body.lastReport.id).toBe(started.body.sessionId)
  })

  it("discards a visit without meaningful activity", async () => {
    const app = makeApp()
    await request(app).post("/api/session/start").send({})
    const ended = await request(app).post("/api/session/end").send({ wait: true })
    expect(ended.body.status).toBe("discarded")
  })
})
