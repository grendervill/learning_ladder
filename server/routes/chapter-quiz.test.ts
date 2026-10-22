import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { MentorService } from "../mentor/service"
import type { CourseSnapshot, LessonContent, Quiz } from "../content/types"

const quiz: Quiz = {
  title: "Квиз главы",
  questions: [
    { id: "q1", type: "single", prompt: "1?", options: ["a", "b"], correct: 0, explanation: "a" },
    { id: "q2", type: "single", prompt: "2?", options: ["a", "b"], correct: 1, explanation: "b" },
    { id: "q3", type: "text", prompt: "3?", referenceAnswer: "a", criteria: ["a"] },
    { id: "q4", type: "text", prompt: "4?", referenceAnswer: "b", criteria: ["b"] },
  ],
}

function lesson(id: string): LessonContent {
  return {
    id,
    title: id,
    theoryMarkdown: "",
    practiceIntro: "",
    tasks: [],
    quiz: {
      title: "Урок",
      questions: [
        { id: "l1", type: "single", prompt: "1", options: ["a", "b"], correct: 0, explanation: "a" },
        { id: "l2", type: "single", prompt: "2", options: ["a", "b"], correct: 0, explanation: "a" },
        { id: "l3", type: "text", prompt: "3", referenceAnswer: "a", criteria: ["a"] },
        { id: "l4", type: "text", prompt: "4", referenceAnswer: "a", criteria: ["a"] },
      ],
    },
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
    "01-hello-lua": lesson("01-hello-lua"),
    "02-variables-types": lesson("02-variables-types"),
    "03-control-flow": lesson("03-control-flow"),
    "04-functions": lesson("04-functions"),
  },
  unassigned: [],
  errors: [],
}

function mentor(grade = 4): MentorService {
  return {
    createSession: async () => "m",
    deleteSession: async () => {},
    reviewLesson: async () => ({
      grade,
      verdict: grade >= 4 ? "pass" : "retry",
      summary: "Разбор главы",
      strengths: ["Сильная"],
      issues: ["Слабая"],
      nextStep: "Дальше",
      tasks: [],
      quiz: quiz.questions.map((q) => ({ questionId: q.id, correct: true, comment: "Верно" })),
    }),
    askMentor: async () => "Подсказка",
    summarizeSession: async () => "## Отчёт",
    classifyFolders: async () => ({ assignments: [], newChapters: [], reason: "" }),
  }
}

function makeApp(allPassed: boolean, grade = 4) {
  const db = openDatabase(":memory:")
  migrate(db)
  for (const lessonId of ["01-hello-lua", "02-variables-types", "03-control-flow"]) {
    const passed = allPassed || lessonId === "01-hello-lua"
    db.prepare(
      "insert into lesson_progress (lesson_id, status, best_grade, attempts, passed_at) values (?, ?, ?, 1, ?)",
    ).run(lessonId, passed ? "passed" : "available", passed ? 4 : null, passed ? new Date().toISOString() : null)
  }
  return {
    db,
    app: createApp({
      db,
      course: snapshot,
      progressPath: resolve(process.cwd(), "PROGRESS.md"),
      mentor: mentor(grade),
    }),
  }
}

describe("chapter quiz api", () => {
  it("refuses a chapter quiz while lessons are not closed", async () => {
    const res = await request(makeApp(false).app).get("/api/chapters/foundations/quiz")
    expect(res.status).toBe(403)
  })

  it("opens next chapter after passing the chapter quiz", async () => {
    const { db, app } = makeApp(true)
    const before = await request(app).get("/api/chapters/foundations/quiz")
    expect(before.status).toBe(200)
    expect(before.body.quiz.questions[0].correct).toBeUndefined()

    await request(app)
      .put("/api/chapters/foundations/quiz-answers")
      .send({ answers: { q1: 0, q2: 1, q3: "a", q4: "b" } })

    const submitted = await request(app).post("/api/chapters/foundations/quiz/submit").send({})
    expect(submitted.status).toBe(200)
    expect(submitted.body.passed).toBe(true)
    expect(submitted.body.nextLessonId).toBe("04-functions")

    const course = await request(app).get("/api/course")
    expect(course.body.access.lessons["04-functions"]).toBe("available")

    const progress = db.prepare("select * from chapter_progress where chapter_id = 'foundations'").get() as any
    expect(progress.status).toBe("passed")
    const attempt = db.prepare("select * from attempts where scope = 'chapter' order by id desc limit 1").get() as any
    expect(attempt.grade).toBe(4)

    const after = await request(app).get("/api/chapters/foundations/quiz")
    expect(after.body.quiz.questions[0].correct).toBe(0)
  })

  it("does not open next chapter on grade 3", async () => {
    const { app } = makeApp(true, 3)
    const res = await request(app).post("/api/chapters/foundations/quiz/submit").send({})
    expect(res.body.passed).toBe(false)
    const course = await request(app).get("/api/course")
    expect(course.body.access.lessons["04-functions"]).toBe("locked")
  })
})
