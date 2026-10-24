import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { closeDb } from "./db"
import {
  appConfigPath,
  ensureProjectLayout,
  migrateLegacyLua,
  projectRootCandidates,
  readConfiguredProjectRoot,
  resolveProjectPaths,
  resolveUsableProjectRoot,
  writeConfiguredProjectRoot,
} from "./project"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-project-"))
  process.env.LEARNINGLUA_CONFIG = join(dir, "app-config.json")
})

afterEach(() => {
  delete process.env.LEARNINGLUA_CONFIG
  rmSync(dir, { recursive: true, force: true })
})

describe("project paths and config", () => {
  it("resolves every project subpath from the root", () => {
    const root = join(dir, "project")
    const paths = resolveProjectPaths(root)
    expect(paths.root).toBe(resolve(root))
    expect(paths.dataDir).toBe(join(resolve(root), "data"))
    expect(paths.settingsPath).toBe(join(resolve(root), "data", "settings.json"))
    expect(paths.dbPath).toBe(join(resolve(root), "data", "learninglua.db"))
    expect(paths.workspacesDir).toBe(join(resolve(root), "data", "workspaces"))
    expect(paths.coursesDir).toBe(join(resolve(root), "courses"))
    expect(paths.promptsDir).toBe(join(resolve(root), "prompts"))
    expect(paths.reportsDir).toBe(join(resolve(root), "reports"))
    expect(paths.constructorPromptPath).toBe(join(resolve(root), "prompts", "constructor.md"))
  })

  it("round-trips the configured project root", () => {
    const root = join(dir, "workspace")
    expect(readConfiguredProjectRoot(join(dir, "fallback"))).toBe(resolve(join(dir, "fallback")))
    writeConfiguredProjectRoot(root)
    expect(appConfigPath()).toBe(join(dir, "app-config.json"))
    expect(JSON.parse(readFileSync(appConfigPath(), "utf8"))).toEqual({ projectRoot: resolve(root) })
    expect(readConfiguredProjectRoot(join(dir, "fallback"))).toBe(resolve(root))
  })
})

describe("project root candidates", () => {
  it("orders configured, fallback, home and cwd without duplicates", () => {
    const configured = join(dir, "configured")
    const fallback = join(dir, "fallback")
    const candidates = projectRootCandidates(fallback, configured)
    expect(candidates[0]).toBe(resolve(configured))
    expect(candidates[1]).toBe(resolve(fallback))
    expect(candidates).toContain(resolve(join(homedir(), "Лестница обучения")))
    expect(candidates).toContain(resolve(process.cwd()))
    expect(new Set(candidates).size).toBe(candidates.length)
  })

  it("uses the next candidate when the configured root cannot be opened", () => {
    const configured = join(dir, "blocked")
    const fallback = join(dir, "fallback")
    writeFileSync(configured, "not a directory", "utf8")

    const result = resolveUsableProjectRoot([configured, fallback])

    expect(result.root).toBe(resolve(fallback))
    expect(result.error).toContain("blocked")
    expect(existsSync(join(fallback, "data"))).toBe(true)
  })
})

describe("project layout and migration", () => {
  it("creates the data, courses, prompts, reports and agent folders", () => {
    const root = join(dir, "project")
    const paths = ensureProjectLayout(root)
    for (const path of [paths.dataDir, paths.coursesDir, paths.promptsDir, paths.reportsDir, paths.workspacesDir]) {
      expect(existsSync(path)).toBe(true)
    }
    expect(existsSync(join(root, ".opencode", "agents", "course-mentor.md"))).toBe(true)
    expect(existsSync(join(root, ".opencode", "agents", "course-constructor.md"))).toBe(true)
  })

  it("migrates the legacy Lua folders once and keeps the mentor prompt body", () => {
    const root = join(dir, "project")
    mkdirSync(join(root, "lessons", "01-hello"), { recursive: true })
    writeFileSync(join(root, "lessons", "01-hello", "README.md"), "# Урок\n", "utf8")
    mkdirSync(join(root, "course"), { recursive: true })
    writeFileSync(join(root, "course", "chapters.json"), '{"chapters":[]}', "utf8")
    mkdirSync(join(root, ".opencode", "agents"), { recursive: true })
    writeFileSync(
      join(root, ".opencode", "agents", "lua-mentor.md"),
      "---\ndescription: test\nmodel: lua\n---\n\nТы — наставник по Lua.\n",
      "utf8",
    )

    expect(migrateLegacyLua(root)).toBe(true)
    expect(existsSync(join(root, "courses", "lua", "lessons", "01-hello", "README.md"))).toBe(true)
    expect(existsSync(join(root, "courses", "lua", "course", "chapters.json"))).toBe(true)
    const meta = JSON.parse(readFileSync(join(root, "courses", "lua", "course.json"), "utf8"))
    expect(meta).toMatchObject({
      format: "legacy",
      id: "lua",
      mode: "programming",
      builtIn: true,
      settings: { runtime: "lua", fileExtension: ".lua" },
    })
    const mentor = readFileSync(join(root, "courses", "lua", "mentor.md"), "utf8")
    expect(mentor).toContain("Ты — наставник по Lua.")
    expect(mentor).not.toContain("description: test")

    expect(migrateLegacyLua(root)).toBe(false)
  })

  it("refuses a project root that is an existing file", () => {
    const blocked = join(dir, "blocked")
    writeFileSync(blocked, "not a directory", "utf8")
    expect(() => ensureProjectLayout(blocked)).toThrow()
  })

  it("closeDb is safe when no database is open", () => {
    expect(() => closeDb()).not.toThrow()
  })
})
