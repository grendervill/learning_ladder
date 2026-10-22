import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
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
    tasks: [
      {
        id: "task1",
        title: "Задание",
        prompt: "",
        kind: "code",
        entry: "main.lua",
        files: [{ name: "main.lua", content: "print(1)" }],
        args: [],
        stdin: "",
        timeoutMs: 3000,
      },
    ],
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
      lessonIds: ["02-variables-types", "03-control-flow"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: {
    "02-variables-types": lesson("02-variables-types"),
    "03-control-flow": lesson("03-control-flow"),
  },
  unassigned: [],
  errors: [],
}

function makeApp() {
  const db = openDatabase(":memory:")
  migrate(db)
  const askMentor = vi.fn(async (_sessionId: string, _context: unknown, _question: string) => "Попробуй проверить type(42) в REPL.")
  const mentor: MentorService = {
    createSession: async () => "m",
    deleteSession: async () => {},
    reviewLesson: async () => {
      throw new Error("not used")
    },
    askMentor,
    summarizeSession: async () => "",
    classifyFolders: async () => ({ assignments: [], newChapters: [], reason: "" }),
  }
  return {
    db,
    askMentor,
    app: createApp({
      db,
      course: snapshot,
      progressPath: resolve(process.cwd(), "PROGRESS.md"),
      mentor,
    }),
  }
}

describe("mentor ask api", () => {
  it("answers and stores the conversation", async () => {
    const { db, app } = makeApp()
    const res = await request(app)
      .post("/api/mentor/ask")
      .send({
        lessonId: "02-variables-types",
        taskId: "task1",
        question: "Почему type выдаёт string?",
      })
    expect(res.status).toBe(200)
    expect(res.body.answer).toContain("type")
    expect(res.body.conversationId).toBeTruthy()
    const count = db.prepare("select count(*) as c from mentor_messages").get() as any
    expect(count.c).toBe(2)
  })

  it("sends prior history on a repeated conversation", async () => {
    const { app, askMentor } = makeApp()
    const first = await request(app)
      .post("/api/mentor/ask")
      .send({ lessonId: "02-variables-types", taskId: "task1", question: "Первый вопрос" })
    await request(app)
      .post("/api/mentor/ask")
      .send({
        lessonId: "02-variables-types",
        taskId: "task1",
        question: "Второй вопрос",
        conversationId: first.body.conversationId,
      })
    const context = askMentor.mock.calls[1][1] as any
    expect(context.history?.length).toBe(2)
    expect(context.history?.[0].content).toBe("Первый вопрос")
  })

  it("rejects an empty question", async () => {
    const res = await request(makeApp().app).post("/api/mentor/ask").send({ question: "  " })
    expect(res.status).toBe(400)
  })

  it("refuses a locked lesson", async () => {
    const res = await request(makeApp().app)
      .post("/api/mentor/ask")
      .send({ lessonId: "03-control-flow", taskId: "task1", question: "Можно?" })
    expect(res.status).toBe(403)
  })
})
