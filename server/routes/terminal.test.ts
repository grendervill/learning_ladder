import { rmSync } from "node:fs"
import { resolve } from "node:path"
import request from "supertest"
import { afterEach, describe, expect, it } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { CourseSnapshot, LessonContent, TaskContent } from "../content/types"

function task(overrides: Partial<TaskContent> = {}): TaskContent {
  return {
    id: "terminal-task",
    title: "Терминал",
    prompt: "Введи команду",
    kind: "terminal",
    entry: "",
    files: [],
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
      id: "tools",
      title: "Инструменты",
      description: "",
      lessonIds: ["terminal-basics", "03-control-flow"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: {
    "terminal-basics": lesson("terminal-basics", [task()]),
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

afterEach(() => {
  rmSync(resolve(process.cwd(), "data", "workspaces", "terminal-basics", "terminal-task"), {
    recursive: true,
    force: true,
  })
})

describe("terminal api", () => {
  it("runs a command and returns history", async () => {
    const testApp = app()
    const run = await request(testApp)
      .post("/api/tasks/terminal-basics/terminal-task/terminal")
      .send({ command: "pwd" })
    expect(run.status).toBe(200)
    expect(run.body.stdout).toContain("terminal-task")

    const state = await request(testApp).get("/api/tasks/terminal-basics/terminal-task/terminal")
    expect(state.body.history[0].command).toBe("pwd")
  })

  it("persists cd between requests", async () => {
    const testApp = app()
    await request(testApp)
      .post("/api/tasks/terminal-basics/terminal-task/terminal")
      .send({ command: "mkdir sub" })
    const cd = await request(testApp)
      .post("/api/tasks/terminal-basics/terminal-task/terminal")
      .send({ command: "cd sub" })
    expect(cd.body.cwd.endsWith("/sub")).toBe(true)
    const pwd = await request(testApp)
      .post("/api/tasks/terminal-basics/terminal-task/terminal")
      .send({ command: "pwd" })
    expect(pwd.body.stdout.trim().endsWith("/sub")).toBe(true)
  })

  it("refuses a locked lesson", async () => {
    const res = await request(app())
      .post("/api/tasks/03-control-flow/locked/terminal")
      .send({ command: "pwd" })
    expect(res.status).toBe(403)
  })
})
