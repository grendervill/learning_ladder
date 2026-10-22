import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { CourseSnapshot, LessonContent, Quiz } from "../content/types"

const quiz: Quiz = {
  title: "Проверь себя",
  questions: [
    { id: "q1", type: "single", prompt: "Что вернёт type(42)?", options: ["number", "string"], correct: 0, explanation: "number" },
    { id: "q2", type: "single", prompt: "Что такое nil?", options: ["ничего", "ноль"], correct: 0, explanation: "ничего" },
    { id: "q3", type: "text", prompt: "Зачем local?", referenceAnswer: "область видимости", criteria: ["область"] },
    { id: "q4", type: "text", prompt: "Что такое таблица?", referenceAnswer: "ассоциативный массив", criteria: ["массив"] },
  ],
}

function lesson(id: string): LessonContent {
  return {
    id,
    title: id,
    theoryMarkdown: "## Теория",
    practiceIntro: "",
    tasks: [],
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
      lessonIds: ["02-variables-types", "03-control-flow"],
      quiz,
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

function app() {
  const db = openDatabase(":memory:")
  migrate(db)
  return createApp({
    db,
    course: snapshot,
    progressPath: resolve(process.cwd(), "PROGRESS.md"),
  })
}

describe("quiz answers api", () => {
  it("saves answers and returns them without correct options", async () => {
    const testApp = app()
    const put = await request(testApp)
      .put("/api/lessons/02-variables-types/quiz-answers")
      .send({ answers: { q1: 1, q3: "чтобы не засорять глобалы" } })

    expect(put.status).toBe(200)
    const res = await request(testApp).get("/api/lessons/02-variables-types")
    expect(res.body.answers).toEqual({ q1: 1, q3: "чтобы не засорять глобалы" })
    expect(res.body.quiz.questions[0]).not.toHaveProperty("correct")
    expect(JSON.stringify(res.body)).not.toContain("referenceAnswer")
  })

  it("rejects an answer with an invalid option", async () => {
    const res = await request(app())
      .put("/api/lessons/02-variables-types/quiz-answers")
      .send({ answers: { q1: 9 } })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("answer_invalid")
  })

  it("refuses to save answers for a locked lesson", async () => {
    const res = await request(app())
      .put("/api/lessons/03-control-flow/quiz-answers")
      .send({ answers: { q1: 0 } })
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("lesson_locked")
  })
})
