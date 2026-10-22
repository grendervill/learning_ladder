import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  KEEP_KEY,
  maskKey,
  readSettings,
  resolveApiKey,
  settingsForClient,
  writeSettings,
} from "./settings"

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lua-settings-"))
  process.env.LEARNINGLUA_SETTINGS_PATH = join(dir, "settings.json")
})

afterEach(() => {
  delete process.env.LEARNINGLUA_SETTINGS_PATH
  delete process.env.DEEPSEEK_API_KEY
  rmSync(dir, { recursive: true, force: true })
})

describe("settings store", () => {
  it("returns opencode defaults when no file exists", () => {
    const settings = readSettings()
    expect(settings.network.provider).toBe("opencode")
    expect(settings.network.model).toBe("opencode-go/deepseek-v4.1-flash")
    expect(settings.network.reasoning).toBe("off")
    expect(settings.providers).toEqual({})
  })

  it("persists provider keys and network changes", () => {
    writeSettings({
      network: { provider: "deepseek", model: "deepseek-reasoner", reasoning: "high" },
      providers: { deepseek: { apiKey: "  sk-secret-123456  " } },
    })
    const settings = readSettings()
    expect(settings.network).toEqual({
      provider: "deepseek",
      model: "deepseek-reasoner",
      reasoning: "high",
      baseUrl: "",
    })
    expect(settings.providers.deepseek.apiKey).toBe("sk-secret-123456")
    const raw = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"))
    expect(raw.providers.deepseek.apiKey).toBe("sk-secret-123456")
  })

  it("keeps a key when KEEP_KEY is sent and clears it on an empty string", () => {
    writeSettings({ providers: { anthropic: { apiKey: "sk-ant-1234567890" } } })
    writeSettings({ providers: { anthropic: { apiKey: KEEP_KEY } } })
    expect(readSettings().providers.anthropic.apiKey).toBe("sk-ant-1234567890")
    writeSettings({ providers: { anthropic: { apiKey: "" } } })
    expect(readSettings().providers.anthropic).toBeUndefined()
  })

  it("falls back to environment variables and masks secrets for the client", () => {
    process.env.DEEPSEEK_API_KEY = "sk-env-abcdefghijkl"
    expect(resolveApiKey("deepseek")).toBe("sk-env-abcdefghijkl")
    const client = settingsForClient()
    expect(client.providers.deepseek.hasKey).toBe(true)
    expect(client.providers.deepseek.fromEnv).toBe(true)
    expect(client.providers.deepseek.keyPreview).toBe("sk-e…ijkl")
    expect(JSON.stringify(client)).not.toContain("sk-env-abcdefghijkl")
  })

  it("masks short and long keys", () => {
    expect(maskKey("")).toBe("")
    expect(maskKey("abcd")).toBe("ab…cd")
    expect(maskKey("sk-1234567890abcdef")).toBe("sk-1…cdef")
  })

  it("ignores an unknown provider from a corrupted file", () => {
    writeSettings({ network: { provider: "opencode" } })
    const file = join(dir, "settings.json")
    const raw = JSON.parse(readFileSync(file, "utf8"))
    raw.network.provider = "not-a-provider"
    writeFileSync(file, JSON.stringify(raw), "utf8")
    expect(readSettings().network.provider).toBe("opencode")
  })
})
