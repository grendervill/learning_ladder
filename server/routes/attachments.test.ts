import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../app"
import { DEFAULT_LUA_COURSE_META } from "../content/defaults"
import type { CourseSnapshot } from "../content/types"
import { migrate, openDatabase } from "../db"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-attachments-api-"))
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

function makeApp() {
  const db = openDatabase(":memory:")
  migrate(db)
  return createApp({
    db,
    course: snapshot(),
    root: dir,
    progressPath: join(dir, "missing.md"),
  })
}

describe("attachments api", () => {
  it("uploads a text file and deletes it", async () => {
    const app = makeApp()
    const uploaded = await request(app)
      .post("/api/attachments")
      .attach("files", Buffer.from("Hello attachment"), {
        filename: "notes.txt",
        contentType: "text/plain",
      })

    expect(uploaded.status).toBe(201)
    expect(uploaded.body.attachments).toHaveLength(1)
    expect(uploaded.body.attachments[0]).toMatchObject({
      name: "notes.txt",
      mime: "text/plain",
      kind: "text",
    })
    const id = uploaded.body.attachments[0].id
    const tmp = join(dir, "data", "attachments", "tmp", id)
    expect(existsSync(join(tmp, "notes.txt"))).toBe(true)
    expect(readdirSync(tmp)).toContain("meta.json")

    const deleted = await request(app).delete(`/api/attachments/${id}`)
    expect(deleted.status).toBe(200)
    expect(deleted.body).toEqual({ deleted: true })
    expect(existsSync(tmp)).toBe(false)
  })

  it("limits the number of files", async () => {
    const req = request(makeApp()).post("/api/attachments")
    for (let index = 0; index < 6; index += 1) {
      req.attach("files", Buffer.from("x"), {
        filename: `file-${index}.txt`,
        contentType: "text/plain",
      })
    }
    const response = await req
    expect(response.status).toBe(400)
    expect(response.body.error).toBe("limit_file_count")
  })

  it("preserves Cyrillic filenames", async () => {
    const response = await request(makeApp())
      .post("/api/attachments")
      .attach("files", Buffer.from("Конспект"), {
        filename: "Конспект лекции.txt",
        contentType: "text/plain",
      })

    expect(response.status).toBe(201)
    expect(response.body.attachments[0].name).toBe("Конспект лекции.txt")
  })

  it("rejects corrupt documents with a clear error", async () => {
    const response = await request(makeApp())
      .post("/api/attachments")
      .attach("files", Buffer.from("not a pdf"), {
        filename: "broken.pdf",
        contentType: "application/pdf",
      })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe("unreadable_file")
  })

  it("rejects unsupported files", async () => {
    const app = makeApp()
    const response = await request(app)
      .post("/api/attachments")
      .attach("files", Buffer.from("MZ"), {
        filename: "virus.exe",
        contentType: "application/octet-stream",
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("unsupported_type")
  })

  it("requires at least one file", async () => {
    const response = await request(makeApp()).post("/api/attachments")
    expect(response.status).toBe(400)
    expect(response.body.error).toBe("files_required")
  })
})
