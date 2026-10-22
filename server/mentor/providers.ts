import type { ReasoningLevel } from "../settings"

export interface DirectGenerateInput {
  provider: string
  model: string
  reasoning: ReasoningLevel
  apiKey: string
  baseUrl?: string
  system?: string
  prompt: string
  maxTokens?: number
  signal?: AbortSignal
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com/v1beta",
}

const ANTHROPIC_VERSION = "2023-06-01"

function trimmedBaseUrl(input: DirectGenerateInput): string {
  const base = (input.baseUrl || DEFAULT_BASE_URLS[input.provider] || "").trim()
  return base.replace(/\/+$/, "")
}

function thinkingBudget(level: ReasoningLevel): number {
  if (level === "low") return 2048
  if (level === "medium") return 8192
  if (level === "high") return 16384
  return 0
}

function reasoningEffort(provider: string, level: ReasoningLevel): string | null {
  if (level === "off") return null
  if (provider === "deepseek") {
    if (level === "high") return "max"
    if (level === "medium") return "high"
    return "low"
  }
  return level
}

async function readError(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return text.slice(0, 400)
  } catch {
    return response.statusText
  }
}

function requestSignal(signal?: AbortSignal, timeoutMs = 120_000): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function messageContent(value: unknown): string {
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n")
  }
  return ""
}

async function generateOpenAiCompatible(input: DirectGenerateInput): Promise<string> {
  const base = trimmedBaseUrl(input)
  if (!base) throw new Error("provider_base_url_missing")
  const messages: Array<{ role: string; content: string }> = []
  if (input.system?.trim()) messages.push({ role: "system", content: input.system.trim() })
  messages.push({ role: "user", content: input.prompt })
  const maxTokens = input.maxTokens ?? 4096
  const body: Record<string, unknown> = {
    model: input.model,
    messages,
  }
  if (input.provider === "openai") {
    body.max_completion_tokens = maxTokens
  } else {
    body.max_tokens = maxTokens
  }
  const effort = reasoningEffort(input.provider, input.reasoning)
  if (effort) {
    body.reasoning_effort = effort
  }
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: requestSignal(input.signal),
  })
  if (!response.ok) throw new Error(`http_${response.status}: ${await readError(response)}`)
  const data = (await response.json()) as any
  const text = messageContent(data?.choices?.[0]?.message?.content).trim()
  if (!text) throw new Error("provider_empty_response")
  return text
}

async function generateAnthropic(input: DirectGenerateInput): Promise<string> {
  const base = trimmedBaseUrl(input)
  const maxTokens = input.maxTokens ?? (input.reasoning === "off" ? 4096 : 8192)
  const body: Record<string, unknown> = {
    model: input.model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: input.prompt }],
  }
  if (input.system?.trim()) body.system = input.system.trim()
  if (input.reasoning === "off") {
    body.thinking = { type: "disabled" }
  } else {
    body.thinking = { type: "adaptive" }
    body.output_config = { effort: input.reasoning }
  }
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": input.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: requestSignal(input.signal),
  })
  if (!response.ok) throw new Error(`http_${response.status}: ${await readError(response)}`)
  const data = (await response.json()) as any
  const text = (data?.content ?? [])
    .filter((block: any) => block?.type === "text" && typeof block.text === "string")
    .map((block: any) => block.text)
    .join("\n")
    .trim()
  if (!text) throw new Error("provider_empty_response")
  return text
}

async function generateGoogle(input: DirectGenerateInput): Promise<string> {
  const base = trimmedBaseUrl(input)
  const thinking = (() => {
    if (input.reasoning === "off") return null
    if (/^gemini-(3|4)/.test(input.model)) {
      return { thinkingLevel: input.reasoning === "high" ? "high" : "low" }
    }
    return { thinkingBudget: thinkingBudget(input.reasoning) }
  })()
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: input.prompt }] }],
    generationConfig: {
      maxOutputTokens: input.maxTokens ?? 4096,
      ...(thinking ? { thinkingConfig: thinking } : {}),
    },
  }
  if (input.system?.trim()) {
    body.system_instruction = { parts: [{ text: input.system.trim() }] }
  }
  const response = await fetch(`${base}/models/${encodeURIComponent(input.model)}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": input.apiKey,
    },
    body: JSON.stringify(body),
    signal: requestSignal(input.signal),
  })
  if (!response.ok) throw new Error(`http_${response.status}: ${await readError(response)}`)
  const data = (await response.json()) as any
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim()
  if (!text) throw new Error("provider_empty_response")
  return text
}

export async function generateDirect(input: DirectGenerateInput): Promise<string> {
  if (!input.model?.trim()) throw new Error("provider_model_missing")
  if (input.provider === "anthropic") return generateAnthropic(input)
  if (input.provider === "google") return generateGoogle(input)
  return generateOpenAiCompatible(input)
}

export function describeProviderError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError") return "Превышено время ожидания ответа."
    return error.message
  }
  return String(error)
}
