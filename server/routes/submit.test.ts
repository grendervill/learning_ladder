import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { MentorService } from "../mentor/service"
import type { CourseSnapshot, LessonContent, Quiz } from "../content/types"

const quiz: Quiz = {
  title: "Проверь себя",
  questions: [
    { id: "q1", type: "single", prompt: "type(42)?", options: ["number", "string"], correct: 0, explanation: "number" },
    { id: "q2", type: "single", prompt: "false?", options: ["false", "0"], correct: 0, explanation: "false" },
    { id: "q3", type: "text", prompt: "Зачем local?", referenceAnswer: "область видимости", criteria: ["область"] },
    { id: "q4", type: "text", prompt: "Что такое nil?", referenceAnswer: "ничего", criteria: ["ничего"] },
  ],
}

function lesson(id: string): LessonContent {
  return {
    id,
    title: id,
    theoryMarkdown: "## Теория",
    practiceIntro: "",
    tasks: [
      {
        id: "task1",
        title: "Задание",
        prompt: "Сделай",
        kind: "code",
        entry: "main.lua",
        files: [{ name: "main.lua", content: 'print("ok")' }],
        args: [],
        stdin: "",
        timeoutMs: 3000,
      },
    ],
    quiz,
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
      lessonIds: ["01-hello-lua", "02-variables-types", "03-control-flow"],
      quiz,
      errors: [],
    },
  ],
  lessons: {
    "01-hello-lua": lesson("01-hello-lua"),
    "02-variables-types": lesson("02-variables-types"),
    "03-control-flow": lesson("03-control-flow"),
  },
  unassigned: [],
  errors: [],
}

function fakeMentor(grade: number): MentorService {
  return {
    createSession: async () => "mock-session",
    deleteSession: async () => {},
    reviewLesson: async () => ({
      grade,
      verdict: grade >= 4 ? "pass" : "retry",
      summary: "Разбор",
      strengths: ["Плюс"],
      issues: ["Минус"],
      nextStep: "Дальше",
      tasks: [{ taskId: "task1", status: "ok", comment: "Верно" }],
      quiz: quiz.questions.map((q) => ({ questionId: q.id, correct: true, comment: "Верно" })),
    }),
    askMentor: async () => "Подсказка",
    summarizeSession: async () => "## Отчёт",
    classifyFolders: async () => ({ assignments: [], newChapters: [], reason: "" }),
  }
}

function makeApp(grade: number) {
  const db = openDatabase(":memory:")
  migrate(db)
  return {
    db,
    app: createApp({
      db,
      course: snapshot,
      progressPath: resolve(process.cwd(), "PROGRESS.md"),
      mentor: fakeMentor(grade),
    }),
  }
}

describe("lesson submit", () => {
  it("unlocks next lesson on grade 4 and stores a full attempt", async () => {
    const { db, app } = makeApp(4)
    const res = await request(app)
      .post("/api/lessons/02-variables-types/submit")
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(true)
    expect(res.body.grade).toBe(4)

    const course = await request(app).get("/api/course")
    expect(course.body.access.lessons["03-control-flow"]).toBe("available")

    const attempt = db.prepare("select * from attempts order by id desc limit 1").get() as any
    expect(attempt.grade).toBe(4)
    expect(JSON.parse(attempt.code_json).task1[0].content).toContain("print")
    expect(JSON.parse(attempt.quiz_json)).toEqual({})

    const lesson = await request(app).get("/api/lessons/02-variables-types")
    expect(lesson.body.quiz.questions[0].correct).toBe(0)
  })

  it("does not unlock on grade 3", async () => {
    const { app } = makeApp(3)
    const res = await request(app).post("/api/lessons/02-variables-types/submit").send({})
    expect(res.status).toBe(200)
    expect(res.body.passed).toBe(false)
    const course = await request(app).get("/api/course")
    expect(course.body.access.lessons["03-control-flow"]).toBe("locked")
  })

  it("refuses to submit a locked lesson", async () => {
    const { app } = makeApp(4)
    const res = await request(app).post("/api/lessons/03-control-flow/submit").send({})
    expect(res.status).toBe(403)
  })
})
