import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"
import { createApp } from "../app"
import { createAttachment } from "../attachments/store"
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

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=",
  "base64",
)

function makeApp(root = process.cwd()) {
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
      root,
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

  it("passes text materials and saves attachments when keep is on", async () => {
    const root = mkdtempSync(join(tmpdir(), "ladder-mentor-attachments-"))
    try {
      const attachment = await createAttachment(root, {
        originalname: "notes.md",
        mimetype: "text/markdown",
        size: 13,
        buffer: Buffer.from("Hello mentor"),
      })
      const { app, askMentor, db } = makeApp(root)
      const response = await request(app)
        .post("/api/mentor/ask")
        .send({
          question: "Посмотри файл",
          attachmentIds: [attachment.id],
          keepAttachments: true,
        })

      expect(response.status).toBe(200)
      const context = askMentor.mock.calls[0][1] as any
      expect(context.materials).toContain("Hello mentor")
      expect(context.imageAttachments).toEqual([])
      expect(
        existsSync(
          join(root, "data", "attachments", "mentor", response.body.conversationId, "notes.md"),
        ),
      ).toBe(true)
      expect(existsSync(attachment.dir)).toBe(false)
      const row = db
        .prepare("select attachments_json as json from mentor_messages where role = 'user' order by id limit 1")
        .get() as any
      expect(row.json).toContain("notes.md")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("deletes temporary attachments when keep is off", async () => {
    const root = mkdtempSync(join(tmpdir(), "ladder-mentor-attachments-"))
    try {
      const attachment = await createAttachment(root, {
        originalname: "notes.md",
        mimetype: "text/markdown",
        size: 5,
        buffer: Buffer.from("Hello"),
      })
      const { app } = makeApp(root)
      const response = await request(app)
        .post("/api/mentor/ask")
        .send({ question: "Посмотри файл", attachmentIds: [attachment.id] })

      expect(response.status).toBe(200)
      expect(existsSync(attachment.dir)).toBe(false)
      expect(
        existsSync(
          join(root, "data", "attachments", "mentor", response.body.conversationId),
        ),
      ).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("passes images to the mentor when the model supports vision", async () => {
    const root = mkdtempSync(join(tmpdir(), "ladder-mentor-attachments-"))
    const previous = process.env.LEARNINGLUA_SETTINGS_PATH
    try {
      process.env.LEARNINGLUA_SETTINGS_PATH = join(root, "data", "settings.json")
      mkdirSync(join(root, "data"), { recursive: true })
      writeFileSync(
        process.env.LEARNINGLUA_SETTINGS_PATH,
        JSON.stringify({
          network: { provider: "openai", model: "gpt-5.6-sol", reasoning: "off", baseUrl: "" },
          providers: {},
        }),
      )
      const attachment = await createAttachment(root, {
        originalname: "chart.png",
        mimetype: "image/png",
        size: PNG.length,
        buffer: PNG,
      })
      const { app, askMentor } = makeApp(root)
      const response = await request(app)
        .post("/api/mentor/ask")
        .send({ question: "Что на картинке?", attachmentIds: [attachment.id] })

      expect(response.status).toBe(200)
      const context = askMentor.mock.calls[0][1] as any
      expect(context.imageAttachments).toHaveLength(1)
      expect(context.imageAttachments[0].name).toBe("chart.png")
    } finally {
      if (previous === undefined) delete process.env.LEARNINGLUA_SETTINGS_PATH
      else process.env.LEARNINGLUA_SETTINGS_PATH = previous
      rmSync(root, { recursive: true, force: true })
    }
  })

  it("rejects missing attachments", async () => {
    const response = await request(makeApp().app)
      .post("/api/mentor/ask")
      .send({ question: "Посмотри файл", attachmentIds: ["missing-id"] })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe("attachment_not_found")
  })
})
