import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { CourseSnapshot, LessonContent, TaskContent } from "../content/types"

function task(overrides: Partial<TaskContent> = {}): TaskContent {
  return {
    id: "task1_types",
    title: "Типы",
    prompt: "Посмотри на типы",
    kind: "code",
    entry: "task1_types.lua",
    files: [{ name: "task1_types.lua", content: 'local values = {}\nprint(type(values))' }],
    args: [],
    stdin: "",
    timeoutMs: 3000,
    ...overrides,
  }
}

function lesson(id: string, tasks: TaskContent[]): LessonContent {
  return {
    id,
    title: id,
    theoryMarkdown: "## Теория",
    practiceIntro: "",
    tasks,
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
    "02-variables-types": lesson("02-variables-types", [
      task(),
      task({
        id: "project",
        title: "Проект",
        kind: "project",
        entry: "main.lua",
        files: [{ name: "main.lua", content: "print('project')" }],
      }),
    ]),
    "03-control-flow": lesson("03-control-flow", [task({ id: "task_locked" })]),
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

describe("task files api", () => {
  it("returns starter files, stores edits and resets", async () => {
    const testApp = app()
    const initial = await request(testApp).get("/api/tasks/02-variables-types/task1_types/files")
    expect(initial.status).toBe(200)
    expect(initial.body.files[0].content).toContain("local values")

    const put = await request(testApp)
      .put("/api/tasks/02-variables-types/task1_types/files")
      .send({ files: [{ name: "task1_types.lua", content: "local x = 1" }] })
    expect(put.status).toBe(200)

    const saved = await request(testApp).get("/api/tasks/02-variables-types/task1_types/files")
    expect(saved.body.files[0].content).toBe("local x = 1")

    const reset = await request(testApp).post("/api/tasks/02-variables-types/task1_types/reset")
    expect(reset.body.files[0].content).toContain("local values")
  })

  it("allows extra files for project tasks but rejects traversal", async () => {
    const testApp = app()
    const ok = await request(testApp)
      .put("/api/tasks/02-variables-types/project/files")
      .send({
        files: [
          { name: "main.lua", content: "print('project')" },
          { name: "notes.md", content: "план" },
        ],
      })
    expect(ok.status).toBe(200)

    const bad = await request(testApp)
      .put("/api/tasks/02-variables-types/project/files")
      .send({
        files: [
          { name: "main.lua", content: "print('project')" },
          { name: "../evil.lua", content: "bad" },
        ],
      })
    expect(bad.status).toBe(400)
  })

  it("rejects extra files for a normal code task", async () => {
    const res = await request(app())
      .put("/api/tasks/02-variables-types/task1_types/files")
      .send({
        files: [
          { name: "task1_types.lua", content: "local x = 1" },
          { name: "extra.lua", content: "print(1)" },
        ],
      })
    expect(res.status).toBe(400)
  })

  it("refuses files for a locked lesson", async () => {
    const res = await request(app()).get("/api/tasks/03-control-flow/task_locked/files")
    expect(res.status).toBe(403)
  })
})
