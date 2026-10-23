import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import { DEFAULT_COURSE_META } from "../content/defaults"
import type { CourseSnapshot, LessonContent } from "../content/types"

function lesson(id: string, courseId: string, title: string): LessonContent {
  return {
    id,
    courseId,
    title,
    theoryMarkdown: "## Тема",
    practiceIntro: "",
    tasks: [],
    quiz: null,
    errors: [],
  }
}

const snapshot: CourseSnapshot = {
  version: "test",
  courses: [
    {
      ...DEFAULT_COURSE_META,
      id: "course-a",
      title: "Курс A",
      mode: "general",
      builtIn: false,
    },
    {
      ...DEFAULT_COURSE_META,
      id: "course-b",
      title: "Курс B",
      mode: "math",
      builtIn: false,
    },
  ],
  chapters: [
    {
      id: "a-chapter",
      courseId: "course-a",
      title: "Глава A",
      description: "",
      lessonIds: ["a-1"],
      quiz: null,
      errors: [],
    },
    {
      id: "b-chapter",
      courseId: "course-b",
      title: "Глава B",
      description: "",
      lessonIds: ["b-1"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: {
    "a-1": lesson("a-1", "course-a", "Урок A"),
    "b-1": lesson("b-1", "course-b", "Урок B"),
  },
  unassigned: [],
  errors: [],
}

function app() {
  const db = openDatabase(":memory:")
  migrate(db)
  db.prepare(
    "insert into lesson_progress (lesson_id, status, best_grade, last_grade, attempts, passed_at) values (?, ?, ?, ?, ?, ?)",
  ).run("a-1", "passed", 5, 5, 1, new Date().toISOString())
  db.prepare(
    "insert into lesson_progress (lesson_id, status, best_grade, last_grade, attempts, passed_at) values (?, ?, ?, ?, ?, ?)",
  ).run("b-1", "passed", 4, 4, 1, new Date().toISOString())
  db.prepare(
    "insert into chapter_progress (chapter_id, status, chapter_quiz_grade, best_grade, attempts, passed_at) values (?, ?, ?, ?, ?, ?)",
  ).run("a-chapter", "passed", 5, 5, 1, new Date().toISOString())
  db.prepare(
    "insert into chapter_progress (chapter_id, status, chapter_quiz_grade, best_grade, attempts, passed_at) values (?, ?, ?, ?, ?, ?)",
  ).run("b-chapter", "passed", 4, 4, 1, new Date().toISOString())
  const insertAttempt = db.prepare(
    "insert into attempts (scope, scope_id, kind, submitted_at, code_json, runs_json, quiz_json, grade, feedback_json) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
  insertAttempt.run(
    "lesson",
    "a-1",
    "submit",
    new Date().toISOString(),
    "{}",
    "{}",
    "{}",
    5,
    JSON.stringify({ summary: "Разбор A", strengths: [], issues: [] }),
  )
  insertAttempt.run(
    "lesson",
    "b-1",
    "submit",
    new Date().toISOString(),
    "{}",
    "{}",
    "{}",
    4,
    JSON.stringify({ summary: "Разбор B", strengths: [], issues: [] }),
  )
  return createApp({
    db,
    course: snapshot,
    progressPath: resolve(process.cwd(), "does-not-exist-progress.md"),
  })
}

describe("per-course progress", () => {
  it("filters lessons, chapters and attempts by course", async () => {
    const res = await request(app()).get("/api/progress?courseId=course-b")
    expect(res.status).toBe(200)
    expect(res.body.courseId).toBe("course-b")
    expect(res.body.courseTitle).toBe("Курс B")
    expect(Object.keys(res.body.lessons)).toEqual(["b-1"])
    expect(Object.keys(res.body.chapters)).toEqual(["b-chapter"])
    expect(res.body.attempts).toHaveLength(1)
    expect(res.body.attempts[0]).toMatchObject({
      scopeId: "b-1",
      courseId: "course-b",
      courseTitle: "Курс B",
      itemTitle: "Урок B",
      grade: 4,
    })
  })

  it("keeps the first course as the default", async () => {
    const res = await request(app()).get("/api/progress")
    expect(res.status).toBe(200)
    expect(res.body.courseId).toBe("course-a")
    expect(res.body.attempts[0].courseTitle).toBe("Курс A")
    expect(res.body.lessons["a-1"].bestGrade).toBe(5)
  })
})
