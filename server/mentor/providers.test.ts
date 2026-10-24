import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generateDirect, type DirectGenerateInput } from "./providers"

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z2S8AAAAASUVORK5CYII=",
  "base64",
)

let dir: string
let imagePath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ladder-providers-"))
  imagePath = join(dir, "chart.png")
  writeFileSync(imagePath, PNG)
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

function input(provider: string, baseUrl: string): DirectGenerateInput {
  return {
    provider,
    model: "vision-model",
    reasoning: "off",
    apiKey: "key",
    baseUrl,
    prompt: "Что на картинке?",
    attachments: [{ kind: "image", name: "chart.png", mime: "image/png", path: imagePath }],
  }
}

describe("direct provider attachments", () => {
  it("sends OpenAI images as data URLs", async () => {
    const bodies: any[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "ok" } }] }),
        }
      }),
    )

    await generateDirect(input("openai", "https://api.example/v1"))

    const content = bodies[0].messages[0].content
    expect(content[0]).toEqual({ type: "text", text: "Что на картинке?" })
    expect(content[1].type).toBe("image_url")
    expect(content[1].image_url.url).toMatch(/^data:image\/png;base64,/)
  })

  it("sends Anthropic images as base64 blocks", async () => {
    const bodies: any[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: [{ type: "text", text: "ok" }] }),
        }
      }),
    )

    await generateDirect(input("anthropic", "https://api.example"))

    const content = bodies[0].messages[0].content
    expect(content[1]).toMatchObject({
      type: "image",
      source: { type: "base64", media_type: "image/png" },
    })
  })

  it("sends Google images as inline data", async () => {
    const bodies: any[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)))
        return {
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
        }
      }),
    )

    await generateDirect(input("google", "https://api.example"))

    const parts = bodies[0].contents[0].parts
    expect(parts[0]).toEqual({ text: "Что на картинке?" })
    expect(parts[1]).toMatchObject({ inline_data: { mime_type: "image/png" } })
  })
})
