import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { openDatabase, migrate, type DatabaseSync } from "./index"
import { seedFromProgressIfEmpty } from "./seed"
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
      lessonIds: ["01-hello-lua", "02-variables-types", "03-control-flow"],
      quiz: null,
      errors: [],
    },
    {
      id: "functions",
      title: "Функции",
      description: "",
      lessonIds: ["04-functions"],
      quiz: null,
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

function row(db: DatabaseSync, lessonId: string) {
  return db.prepare("select * from lesson_progress where lesson_id = ?").get(lessonId) as any
}

describe("seedFromProgressIfEmpty", () => {
  it("imports old progress once", () => {
    const db = openDatabase(":memory:")
    migrate(db)

    expect(seedFromProgressIfEmpty(db, snapshot, resolve(process.cwd(), "PROGRESS.md"))).toBe(true)
    expect(row(db, "01-hello-lua")).toMatchObject({ status: "passed", best_grade: 5 })
    expect(row(db, "02-variables-types")).toMatchObject({ status: "available" })
    expect(seedFromProgressIfEmpty(db, snapshot, resolve(process.cwd(), "PROGRESS.md"))).toBe(false)
    const count = db.prepare("select count(*) as c from lesson_progress").get() as any
    expect(count.c).toBe(2)
  })

  it("opens the first lesson when there is no old progress", () => {
    const db = openDatabase(":memory:")
    migrate(db)
    seedFromProgressIfEmpty(db, snapshot, resolve(process.cwd(), "does-not-exist.md"))
    expect(row(db, "01-hello-lua")).toMatchObject({ status: "available" })
  })
})
