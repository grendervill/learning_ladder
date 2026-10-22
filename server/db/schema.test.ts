import { describe, expect, it } from "vitest"
import { openDatabase, migrate } from "./index"

describe("migrate", () => {
  it("creates all tables and is idempotent", () => {
    const db = openDatabase(":memory:")
    migrate(db)
    migrate(db)
    const names = db
      .prepare("select name from sqlite_master where type='table'")
      .all()
      .map((row: any) => row.name)
    expect(names).toEqual(
      expect.arrayContaining([
        "study_sessions",
        "activity_events",
        "lesson_progress",
        "chapter_progress",
        "quiz_answers",
        "task_files",
        "task_runs",
        "attempts",
        "mentor_messages",
        "content_versions",
        "terminal_state",
        "terminal_commands",
      ]),
    )
  })

  it("enables foreign keys", () => {
    const db = openDatabase(":memory:")
    migrate(db)
    const row = db.prepare("pragma foreign_keys").get() as any
    expect(Object.values(row)[0]).toBe(1)
  })
})
