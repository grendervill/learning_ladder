import { afterEach, describe, expect, it, vi } from "vitest"
import { generateDirect } from "./providers"

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("direct provider calls", () => {
  it("calls an OpenAI-compatible endpoint with system and reasoning settings", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ choices: [{ message: { content: "  работает  " } }] }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const text = await generateDirect({
      provider: "deepseek",
      model: "deepseek-reasoner",
      reasoning: "high",
      apiKey: "sk-test",
      system: "Ты наставник.",
      prompt: "Проверь код.",
    })

    expect(text).toBe("работает")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.deepseek.com/v1/chat/completions")
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test")
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe("deepseek-reasoner")
    expect(body.messages).toEqual([
      { role: "system", content: "Ты наставник." },
      { role: "user", content: "Проверь код." },
    ])
    expect(body.reasoning_effort).toBe("max")
    expect(body.max_tokens).toBe(4096)
  })

  it("uses a custom base URL and max_completion_tokens for OpenAI", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse({ choices: [{ message: { content: "ок" } }] }))
    vi.stubGlobal("fetch", fetchMock)

    await generateDirect({
      provider: "openai",
      model: "gpt-5.2",
      reasoning: "off",
      apiKey: "sk-openai",
      prompt: "привет",
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.openai.com/v1/chat/completions")
    const body = JSON.parse(String(init.body))
    expect(body.max_completion_tokens).toBe(4096)
    expect(body.reasoning_effort).toBeUndefined()
  })

  it("enables Anthropic adaptive thinking with an effort level and keeps only text blocks", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({
        content: [
          { type: "thinking", thinking: "размышляю" },
          { type: "text", text: "Ответ наставника." },
        ],
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const text = await generateDirect({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      reasoning: "medium",
      apiKey: "sk-ant",
      system: "система",
      prompt: "вопрос",
    })

    expect(text).toBe("Ответ наставника.")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.anthropic.com/v1/messages")
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant")
    const body = JSON.parse(String(init.body))
    expect(body.thinking).toEqual({ type: "adaptive" })
    expect(body.output_config).toEqual({ effort: "medium" })
    expect(body.max_tokens).toBe(8192)
    expect(body.system).toBe("система")
  })

  it("calls the Gemini API with an api key header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: "привет" }] } }] }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const text = await generateDirect({
      provider: "google",
      model: "gemini-3-pro",
      reasoning: "low",
      apiKey: "goog-key",
      prompt: "привет",
    })

    expect(text).toBe("привет")
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent",
    )
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("goog-key")
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "low" })
  })

  it("surfaces HTTP errors with status and body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("invalid api key", { status: 401 })),
    )
    await expect(
      generateDirect({
        provider: "deepseek",
        model: "deepseek-chat",
        reasoning: "off",
        apiKey: "bad",
        prompt: "привет",
      }),
    ).rejects.toThrow(/http_401/)
  })

  it("requires a model", async () => {
    await expect(
      generateDirect({
        provider: "custom",
        model: " ",
        reasoning: "off",
        apiKey: "x",
        prompt: "привет",
      }),
    ).rejects.toThrow("provider_model_missing")
  })
})
