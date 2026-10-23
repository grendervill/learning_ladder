import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { discoverProviderModels } from "./models"

let dir: string
const previousSettings = process.env.LEARNINGLUA_SETTINGS_PATH

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-models-"))
  process.env.LEARNINGLUA_SETTINGS_PATH = join(dir, "settings.json")
})

afterEach(() => {
  if (previousSettings === undefined) delete process.env.LEARNINGLUA_SETTINGS_PATH
  else process.env.LEARNINGLUA_SETTINGS_PATH = previousSettings
  rmSync(dir, { recursive: true, force: true })
})

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  })) as unknown as typeof fetch
}

describe("model discovery", () => {
  it("loads OpenAI-compatible models and derives reasoning levels", async () => {
    const seen: Array<{ url: string; auth?: string }> = []
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen.push({
        url: String(url),
        auth: (init?.headers as Record<string, string> | undefined)?.authorization,
      })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "gpt-5.6-sol" }, { id: "gpt-4o-mini" }],
        }),
      }
    }) as unknown as typeof fetch

    const catalog = await discoverProviderModels("openai", {
      apiKey: "sk-test",
      baseUrl: "https://api.example/v1",
      fetchImpl,
    })

    expect(catalog.source).toBe("api")
    expect(catalog.models).toEqual(["gpt-5.6-sol", "gpt-4o-mini"])
    expect(seen[0]).toEqual({
      url: "https://api.example/v1/models",
      auth: "Bearer sk-test",
    })
    expect(catalog.options[0].reasoning.map((item) => item.id)).toEqual([
      "off",
      "low",
      "medium",
      "high",
    ])
    expect(catalog.options[1].reasoning.map((item) => item.id)).toEqual(["off"])
  })

  it("uses Anthropic capabilities and Google generation methods", async () => {
    const anthropic = await discoverProviderModels("anthropic", {
      apiKey: "sk-ant",
      baseUrl: "https://anthropic.example",
      fetchImpl: fakeFetch({
        data: [
          {
            id: "claude-sonnet-5-5",
            display_name: "Claude Sonnet 5.5",
            capabilities: { effort: { supported: true, low: true, medium: true, high: true } },
          },
        ],
      }),
    })
    expect(anthropic.options[0].label).toBe("Claude Sonnet 5.5")
    expect(anthropic.options[0].reasoning.map((item) => item.id)).toEqual([
      "off",
      "low",
      "medium",
      "high",
    ])

    const google = await discoverProviderModels("google", {
      apiKey: "gm-key",
      baseUrl: "https://google.example/v1beta",
      fetchImpl: fakeFetch({
        models: [
          {
            name: "models/gemini-4-argon",
            displayName: "Gemini 4 Argon",
            supportedGenerationMethods: ["generateContent"],
          },
          {
            name: "models/text-embedding-004",
            supportedGenerationMethods: ["embedContent"],
          },
        ],
      }),
    })
    expect(google.models).toEqual(["gemini-4-argon"])
    expect(google.options[0].label).toBe("Gemini 4 Argon")
    expect(google.options[0].reasoning.map((item) => item.id)).toEqual(["off", "low", "high"])
  })

  it("returns the saved preset when a provider has no key", async () => {
    const catalog = await discoverProviderModels("custom", {
      baseUrl: "http://127.0.0.1:11434/v1",
      fetchImpl: fakeFetch({ data: [] }),
    })
    expect(catalog.source).toBe("preset")
    expect(catalog.error).toBe("provider_key_missing")
    expect(catalog.options).toEqual([])
  })

  it("falls back to presets when the provider API fails", async () => {
    const catalog = await discoverProviderModels("deepseek", {
      apiKey: "bad-key",
      fetchImpl: fakeFetch({ error: "unauthorized" }, 401),
    })
    expect(catalog.source).toBe("preset")
    expect(catalog.error).toContain("http_401")
    expect(catalog.models).toContain("deepseek-flash")
    expect(catalog.options.find((item) => item.id === "deepseek-flash")?.reasoning.length).toBeGreaterThan(1)
  })

  it("uses OpenCode model variants as reasoning choices", async () => {
    const catalog = await discoverProviderModels("opencode", {
      opencodeModels: async () => [
        {
          providerID: "opencode-go",
          modelID: "deepseek-v4.1-flash",
          name: "DeepSeek V4.1 Flash",
          variants: ["low", "high", "max"],
          enabled: true,
          status: "active",
        },
        {
          providerID: "opencode-go",
          modelID: "hidden",
          name: "Hidden",
          variants: [],
          enabled: false,
          status: "active",
        },
      ],
    })
    expect(catalog.source).toBe("opencode")
    expect(catalog.models).toEqual(["opencode-go/deepseek-v4.1-flash"])
    expect(catalog.options[0].label).toContain("DeepSeek V4.1 Flash")
    expect(catalog.options[0].reasoning.map((item) => item.id)).toEqual([
      "off",
      "low",
      "high",
      "max",
    ])
  })
})
