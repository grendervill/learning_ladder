import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createApp } from "../app"
import { migrate, openDatabase } from "../db"
import type { CourseSnapshot, LessonContent } from "../content/types"

vi.mock("@opencode/client/service", () => ({
  Service: {
    ensure: async () => ({ url: "http://127.0.0.1:4096" }),
    headers: () => ({}),
  },
}))

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
      lessonIds: ["01-hello-lua"],
      quiz: null,
      errors: [],
    },
  ],
  lessons: { "01-hello-lua": lesson("01-hello-lua") },
  unassigned: [],
  errors: [],
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lua-settings-api-"))
  process.env.LEARNINGLUA_SETTINGS_PATH = join(dir, "settings.json")
  process.env.LEARNINGLUA_MENTOR_PROMPT_PATH = join(dir, "lua-mentor.md")
  writeFileSync(
    process.env.LEARNINGLUA_MENTOR_PROMPT_PATH,
    "---\ndescription: test agent\nmodel: opencode-go/deepseek-v4.1-flash\n---\n\nИсходный промпт наставника.\n",
    "utf8",
  )
})

afterEach(() => {
  delete process.env.LEARNINGLUA_SETTINGS_PATH
  delete process.env.LEARNINGLUA_MENTOR_PROMPT_PATH
  rmSync(dir, { recursive: true, force: true })
})

function makeApp() {
  const db = openDatabase(":memory:")
  migrate(db)
  return createApp({
    db,
    course: snapshot,
    progressPath: resolve(process.cwd(), "does-not-exist.md"),
  })
}

describe("settings api", () => {
  it("returns defaults and a provider catalog without secrets", async () => {
    const res = await request(makeApp()).get("/api/settings")
    expect(res.status).toBe(200)
    expect(res.body.network.provider).toBe("opencode")
    expect(res.body.catalog.length).toBeGreaterThan(3)
    expect(res.body.providers.deepseek).toEqual({ hasKey: false, keyPreview: null, fromEnv: false })
  })

  it("saves a provider key and returns only a masked preview", async () => {
    const app = makeApp()
    const saved = await request(app)
      .put("/api/settings")
      .send({ providers: { deepseek: { apiKey: "sk-test-1234567890" } } })
    expect(saved.status).toBe(200)
    expect(saved.body.providers.deepseek.hasKey).toBe(true)
    expect(saved.body.providers.deepseek.keyPreview).toBe("sk-t…7890")
    expect(JSON.stringify(saved.body)).not.toContain("sk-test-1234567890")
    const raw = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"))
    expect(raw.providers.deepseek.apiKey).toBe("sk-test-1234567890")

    const kept = await request(app)
      .put("/api/settings")
      .send({ providers: { deepseek: { apiKey: "__KEEP__" } } })
    expect(kept.body.providers.deepseek.hasKey).toBe(true)

    const cleared = await request(app)
      .put("/api/settings")
      .send({ providers: { deepseek: { apiKey: "" } } })
    expect(cleared.body.providers.deepseek.hasKey).toBe(false)
  })

  it("updates the mentor prompt and preserves the agent frontmatter", async () => {
    const app = makeApp()
    const res = await request(app)
      .put("/api/settings")
      .send({ mentorPrompt: "Новый промпт: объясняй, но не давай готовый код." })
    expect(res.status).toBe(200)
    const file = readFileSync(join(dir, "lua-mentor.md"), "utf8")
    expect(file).toContain("description: test agent")
    expect(file).toContain("model: opencode-go/deepseek-v4.1-flash")
    expect(file).toContain("Новый промпт: объясняй, но не давай готовый код.")
    const prompt = await request(app).get("/api/settings/mentor-prompt")
    expect(prompt.body.prompt).toContain("Новый промпт")
    expect(prompt.body.prompt).not.toContain("description: test agent")
  })

  it("lists models for a direct provider", async () => {
    const res = await request(makeApp()).get("/api/settings/models?provider=deepseek")
    expect(res.status).toBe(200)
    expect(res.body.models).toContain("deepseek-flash")
  })

  it("reports checks for tools, data and the mentor", async () => {
    const res = await request(makeApp()).get("/api/settings/checks")
    expect(res.status).toBe(200)
    const ids = res.body.checks.map((check: any) => check.id)
    expect(ids).toEqual(
      expect.arrayContaining(["server", "workspace", "lua", "lsp", "opencode-service", "database", "content", "mentor-prompt", "network"]),
    )
    const { ok, warn, fail } = res.body.summary
    expect(ok + warn + fail).toBe(res.body.checks.length)
    expect(res.body.checks.every((check: any) => ["ok", "warn", "fail"].includes(check.status))).toBe(true)
  })
})
