import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../app"
import { buildContext } from "../context"
import { migrate, openDatabase } from "../db"
import { DEFAULT_LUA_COURSE_META } from "../content/defaults"
import type { CourseSnapshot } from "../content/types"
import type { ProjectManager } from "../project-controller"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-project-api-"))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function snapshot(): CourseSnapshot {
  return {
    version: "test",
    courses: [DEFAULT_LUA_COURSE_META],
    chapters: [],
    lessons: {},
    unassigned: [],
    errors: [],
  }
}

function makeApp(project?: ProjectManager) {
  const db = openDatabase(":memory:")
  migrate(db)
  const course = snapshot()
  const context = buildContext(db, course, join(dir, "missing.md"), dir)
  return {
    app: createApp({ db, course, root: dir, progressPath: join(dir, "missing.md"), project }),
    context,
  }
}

describe("project api", () => {
  it("reports the current project path and course count", async () => {
    const { app } = makeApp()
    const res = await request(app).get("/api/project")
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ root: dir, courses: 1, exists: true, writable: true })
  })

  it("returns 501 when project switching is not configured", async () => {
    const { app } = makeApp()
    const res = await request(app).put("/api/project").send({ root: join(dir, "other") })
    expect(res.status).toBe(501)
  })

  it("validates the requested path and delegates the switch", async () => {
    const calls: string[] = []
    const target = resolve(dir, "next-project")
    const { app, context } = makeApp({
      getContext: () => context,
      root: () => dir,
      switch: async (root) => {
        calls.push(root)
        return { root: resolve(root), courses: 0 }
      },
    })

    const empty = await request(app).put("/api/project").send({})
    expect(empty.status).toBe(400)

    const switched = await request(app).put("/api/project").send({ root: target })
    expect(switched.status).toBe(200)
    expect(switched.body).toEqual({ root: target, courses: 0 })
    expect(calls).toEqual([target])
  })

  it("surfaces a failed folder switch", async () => {
    const { app, context } = makeApp({
      getContext: () => context,
      root: () => dir,
      switch: async () => {
        throw new Error("permission denied")
      },
    })
    const res = await request(app).put("/api/project").send({ root: join(dir, "blocked") })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: "project_switch_failed", message: "permission denied" })
  })
})
