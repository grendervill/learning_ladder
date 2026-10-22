import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { CourseSnapshot, LessonContent, Quiz } from "../content/types"

const quiz: Quiz = {
  title: "Проверь себя",
  questions: [
    { id: "q1", type: "single", prompt: "1", options: ["a", "b"], correct: 0, explanation: "a" },
    { id: "q2", type: "single", prompt: "2", options: ["a", "b"], correct: 1, explanation: "b" },
    { id: "q3", type: "text", prompt: "3", referenceAnswer: "a", criteria: ["a"] },
    { id: "q4", type: "text", prompt: "4", referenceAnswer: "b", criteria: ["b"] },
  ],
}

function lesson(id: string, title: string): LessonContent {
  return {
    id,
    title,
    theoryMarkdown: "## Теория\n\nТекст",
    practiceIntro: "Практика",
    tasks: [
      {
        id: "task1",
        title: "Задание",
        prompt: "Сделай",
        kind: "code",
        entry: "task1.lua",
        files: [{ name: "task1.lua", content: 'print("ok")' }],
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
    {
      id: "next",
      title: "Дальше",
      description: "",
      lessonIds: ["04-functions"],
      quiz,
      errors: [],
    },
  ],
  lessons: {
    "01-hello-lua": lesson("01-hello-lua", "Hello, Lua"),
    "02-variables-types": lesson("02-variables-types", "Переменные и типы"),
    "03-control-flow": lesson("03-control-flow", "Управление потоком"),
    "04-functions": lesson("04-functions", "Функции"),
    "99-unassigned": lesson("99-unassigned", "Новая тема"),
  },
  unassigned: [],
  errors: [],
}

function app() {
  const db = openDatabase(":memory:")
  migrate(db)
  return createApp({ db, course: snapshot, progressPath: resolve(process.cwd(), "PROGRESS.md") })
}

describe("course api", () => {
  it("returns course without correct answers", async () => {
    const res = await request(app()).get("/api/course")
    expect(res.status).toBe(200)
    expect(res.body.chapters).toHaveLength(2)
    expect(JSON.stringify(res.body)).not.toContain("referenceAnswer")
    expect(JSON.stringify(res.body)).not.toContain('"correct"')
    expect(res.body.access.lessons["02-variables-types"]).toBe("available")
  })

  it("returns a lesson with tasks and quiz", async () => {
    const res = await request(app()).get("/api/lessons/02-variables-types")
    expect(res.status).toBe(200)
    expect(res.body.tasks).toHaveLength(1)
    expect(res.body.quiz.questions).toHaveLength(4)
    expect(res.body.quiz.questions[0].correct).toBeUndefined()
  })

  it("does not open a lesson that is not assigned to a chapter", async () => {
    const res = await request(app()).get("/api/lessons/99-unassigned")
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("lesson_locked")
  })

  it("returns progress with grades and attempts", async () => {
    const res = await request(app()).get("/api/progress")
    expect(res.status).toBe(200)
    expect(res.body.lessons["01-hello-lua"].bestGrade).toBe(5)
    expect(res.body.lessons["02-variables-types"].status).toBe("available")
  })
})
