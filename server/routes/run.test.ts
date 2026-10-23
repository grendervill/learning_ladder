import { resolve } from "node:path"
import request from "supertest"
import { describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { CourseSnapshot, LessonContent, TaskContent } from "../content/types"

function task(overrides: Partial<TaskContent> = {}): TaskContent {
  return {
    id: "task1",
    title: "Печать",
    prompt: "",
    kind: "code",
    entry: "main.lua",
    files: [{ name: "main.lua", content: 'print("ok")' }],
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
    theoryMarkdown: "",
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
      task({ id: "love", kind: "love", entry: "main.lua" }),
      task({
        id: "steps",
        kind: "steps",
        entry: "solution.json",
        files: [{ name: "solution.json", content: '{"steps":[],"answer":""}' }],
      }),
    ]),
    "03-control-flow": lesson("03-control-flow", [task({ id: "locked" })]),
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

describe("run api", () => {
  it("runs a task and returns stdout", async () => {
    const res = await request(app()).post("/api/tasks/02-variables-types/task1/run").send({})
    expect(res.status).toBe(200)
    expect(res.body.stdout.trim()).toBe("ok")
    expect(res.body.exitCode).toBe(0)
  })

  it("passes stdin and args", async () => {
    const res = await request(app())
      .post("/api/tasks/02-variables-types/task1/run")
      .send({
        files: [{ name: "main.lua", content: "print(arg[1]); print(io.read())" }],
        args: ["a"],
        stdin: "b\n",
      })
    expect(res.body.stdout.trim().split("\n")).toEqual(["a", "b"])
  })

  it("refuses to run a locked lesson", async () => {
    const res = await request(app()).post("/api/tasks/03-control-flow/locked/run").send({})
    expect(res.status).toBe(403)
  })

  it("does not run love tasks on the server", async () => {
    const res = await request(app()).post("/api/tasks/02-variables-types/love/run").send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("love_preview_is_client_side")
  })

  it("does not run step-by-step math tasks", async () => {
    const res = await request(app()).post("/api/tasks/02-variables-types/steps/run").send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("steps_task_is_not_runnable")
  })
})
