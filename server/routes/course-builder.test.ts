import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createApp } from "../app"
import { createAttachment } from "../attachments/store"
import { migrate, openDatabase } from "../db"
import { DEFAULT_LUA_COURSE_META } from "../content/defaults"
import type { CourseSnapshot } from "../content/types"
import type { CourseGenerator } from "../courses/generator"
import type { CourseJob } from "../courses/jobs"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-builder-api-"))
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

function makeApp(builder: CourseGenerator) {
  const db = openDatabase(":memory:")
  migrate(db)
  return createApp({
    db,
    course: snapshot(),
    root: dir,
    progressPath: join(dir, "missing.md"),
    courseBuilder: builder,
  })
}

const questions = [
  {
    id: "goal",
    prompt: "Что важно?",
    type: "multiple" as const,
    options: ["Основы", "Практика"],
  },
]

const job: CourseJob = {
  id: "job-1",
  status: "lessons",
  phase: "Урок 1 из 2",
  completed: 1,
  total: 2,
  title: "Курс",
  courseId: "course-1",
  error: null,
  cancelRequested: false,
  createdAt: "2026-10-22T10:00:00.000Z",
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=",
  "base64",
)

function fakeBuilder(overrides: Partial<CourseGenerator> = {}): CourseGenerator {
  return {
    clarify: async () => questions,
    start: () => "job-1",
    getJob: (id) => (id === "job-1" ? job : undefined),
    cancelJob: () => true,
    ...overrides,
  }
}

describe("course builder api", () => {
  it("returns clarifying questions", async () => {
    const res = await request(makeApp(fakeBuilder())).post("/api/courses/clarify").send({ topic: "экономика" })
    expect(res.status).toBe(200)
    expect(res.body.questions).toEqual(questions)
  })

  it("falls back to safe questions when clarification fails", async () => {
    const res = await request(
      makeApp(fakeBuilder({ clarify: async () => { throw new Error("llm down") } })),
    )
      .post("/api/courses/clarify")
      .send({ topic: "экономика" })
    expect(res.status).toBe(200)
    expect(res.body.fallback).toBe(true)
    expect(res.body.questions.length).toBeGreaterThanOrEqual(2)
  })

  it("starts a generation job with answers and volume", async () => {
    const start = vi.fn(() => "job-1")
    const res = await request(makeApp(fakeBuilder({ start })))
      .post("/api/courses/generate")
      .send({
        topic: "экономика",
        volume: "short",
        answers: [{ question: "Что важно?", answer: "Основы" }],
      })
    expect(res.status).toBe(202)
    expect(res.body).toEqual({ jobId: "job-1" })
    expect(start).toHaveBeenCalledWith({
      topic: "экономика",
      volume: "short",
      answers: [{ question: "Что важно?", answer: "Основы" }],
    })
  })

  it("passes attachment materials and the keep choice to the generator", async () => {
    const attachment = await createAttachment(dir, {
      originalname: "notes.md",
      mimetype: "text/markdown",
      size: 16,
      buffer: Buffer.from("Hello material"),
    })
    let clarifyMaterials: any
    let startInput: any
    const builder = fakeBuilder({
      clarify: async (_topic, materials) => {
        clarifyMaterials = materials
        return questions
      },
      start: (input) => {
        startInput = input
        return "job-1"
      },
    })
    const app = makeApp(builder)

    const clarified = await request(app)
      .post("/api/courses/clarify")
      .send({ topic: "экономика", attachmentIds: [attachment.id], keepAttachments: true })
    expect(clarified.status).toBe(200)
    expect(clarifyMaterials.text).toContain("Hello material")
    expect(clarifyMaterials.keep).toBe(true)

    const generated = await request(app)
      .post("/api/courses/generate")
      .send({
        topic: "экономика",
        volume: "short",
        answers: [],
        attachmentIds: [attachment.id],
        keepAttachments: true,
      })
    expect(generated.status).toBe(202)
    expect(startInput.materials.text).toContain("Hello material")
    expect(startInput.materials.attachments).toHaveLength(1)
    expect(startInput.materials.keep).toBe(true)
  })

  it("rejects missing attachments", async () => {
    const response = await request(makeApp(fakeBuilder()))
      .post("/api/courses/generate")
      .send({ topic: "экономика", volume: "short", attachmentIds: ["missing-id"] })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe("attachment_not_found")
  })

  it("rejects images for a text-only model", async () => {
    const previous = process.env.LEARNINGLUA_SETTINGS_PATH
    process.env.LEARNINGLUA_SETTINGS_PATH = join(dir, "data", "settings.json")
    mkdirSync(join(dir, "data"), { recursive: true })
    writeFileSync(
      process.env.LEARNINGLUA_SETTINGS_PATH,
      JSON.stringify({
        network: { provider: "deepseek", model: "deepseek-flash", reasoning: "off", baseUrl: "" },
        providers: {},
      }),
    )
    try {
      const attachment = await createAttachment(dir, {
        originalname: "chart.png",
        mimetype: "image/png",
        size: PNG.length,
        buffer: PNG,
      })
      const response = await request(makeApp(fakeBuilder()))
        .post("/api/courses/generate")
        .send({
          topic: "экономика",
          volume: "short",
          attachmentIds: [attachment.id],
        })
      expect(response.status).toBe(400)
      expect(response.body.error).toBe("model_without_vision")
    } finally {
      if (previous === undefined) delete process.env.LEARNINGLUA_SETTINGS_PATH
      else process.env.LEARNINGLUA_SETTINGS_PATH = previous
    }
  })

  it("rejects an empty topic and an unknown volume", async () => {
    const app = makeApp(fakeBuilder())
    expect((await request(app).post("/api/courses/generate").send({ volume: "short" })).status).toBe(400)
    expect(
      (await request(app).post("/api/courses/generate").send({ topic: "x", volume: "huge" })).status,
    ).toBe(400)
  })

  it("returns and cancels a job", async () => {
    const app = makeApp(fakeBuilder())
    const current = await request(app).get("/api/courses/jobs/job-1")
    expect(current.status).toBe(200)
    expect(current.body).toMatchObject({ status: "lessons", completed: 1, total: 2 })
    const cancelled = await request(app).post("/api/courses/jobs/job-1/cancel")
    expect(cancelled.status).toBe(200)
    expect(cancelled.body).toEqual({ cancelled: true })
    expect((await request(app).get("/api/courses/jobs/missing")).status).toBe(404)
  })
})
