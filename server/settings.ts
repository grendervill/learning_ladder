import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

export type ReasoningLevel = "off" | "low" | "medium" | "high"

export const REASONING_LEVELS: ReasoningLevel[] = ["off", "low", "medium", "high"]

export interface NetworkSettings {
  provider: string
  model: string
  reasoning: ReasoningLevel
  baseUrl: string
}

export interface ProviderSettings {
  apiKey: string
}

export interface AppSettings {
  network: NetworkSettings
  providers: Record<string, ProviderSettings>
}

export type ProviderKind = "opencode" | "openai-compatible" | "anthropic" | "google"

export interface ProviderInfo {
  id: string
  label: string
  kind: ProviderKind
  needsKey: boolean
  envVar?: string
  defaultBaseUrl?: string
  defaultModel: string
  models: string[]
  hint?: string
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "opencode",
    label: "OpenCode (локальный)",
    kind: "opencode",
    needsKey: false,
    defaultModel: "opencode-go/deepseek-v4.1-flash",
    models: [],
    hint: "Работает без ключа: используется локальный OpenCode и его авторизация. Модель выбирается из списка opencode models.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    needsKey: true,
    envVar: "DEEPSEEK_API_KEY",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-flash",
    models: ["deepseek-flash", "deepseek-v4-pro"],
    hint: "Уровень размышлений передаётся как reasoning_effort: low / high / max.",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "anthropic",
    needsKey: true,
    envVar: "ANTHROPIC_API_KEY",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-5-5",
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
    hint: "Для моделей 5.x используется адаптивное мышление и output_config.effort.",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    needsKey: true,
    envVar: "OPENAI_API_KEY",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.6-sol",
    models: ["gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.5", "gpt-5.4"],
    hint: "Уровень размышлений передаётся как reasoning_effort. Новейшие модели GPT-6 доступны через Responses API.",
  },
  {
    id: "google",
    label: "Google Gemini",
    kind: "google",
    needsKey: true,
    envVar: "GEMINI_API_KEY",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.8-flash",
    models: ["gemini-4-argon", "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"],
    hint: "Для Gemini 3+ используется thinkingLevel, для 2.5 — thinkingBudget.",
  },
  {
    id: "custom",
    label: "Свой OpenAI-совместимый сервис",
    kind: "openai-compatible",
    needsKey: true,
    defaultModel: "",
    models: [],
    hint: "Подойдёт Ollama, LM Studio, vLLM и другие. Укажите адрес вида http://127.0.0.1:11434/v1",
  },
]

export const KEEP_KEY = "__KEEP__"

const DEFAULTS: AppSettings = {
  network: {
    provider: "opencode",
    model: "opencode-go/deepseek-v4.1-flash",
    reasoning: "off",
    baseUrl: "",
  },
  providers: {},
}

export function settingsFilePath(): string {
  return process.env.LEARNINGLUA_SETTINGS_PATH ?? join(process.cwd(), "data", "settings.json")
}

export function providerById(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((provider) => provider.id === id)
}

function normalizeReasoning(value: unknown): ReasoningLevel {
  return REASONING_LEVELS.includes(value as ReasoningLevel) ? (value as ReasoningLevel) : "off"
}

function normalizeSettings(raw: unknown): AppSettings {
  const source = raw && typeof raw === "object" ? (raw as Record<string, any>) : {}
  const network = source.network && typeof source.network === "object" ? source.network : {}
  const providers: Record<string, ProviderSettings> = {}
  if (source.providers && typeof source.providers === "object") {
    for (const [id, value] of Object.entries(source.providers as Record<string, any>)) {
      const apiKey = typeof value?.apiKey === "string" ? value.apiKey : ""
      if (apiKey) providers[id] = { apiKey }
    }
  }
  return {
    network: {
      provider:
        typeof network.provider === "string" && providerById(network.provider)
          ? network.provider
          : DEFAULTS.network.provider,
      model: typeof network.model === "string" ? network.model : DEFAULTS.network.model,
      reasoning: normalizeReasoning(network.reasoning),
      baseUrl: typeof network.baseUrl === "string" ? network.baseUrl : "",
    },
    providers,
  }
}

export function readSettings(): AppSettings {
  const path = settingsFilePath()
  if (!existsSync(path)) return normalizeSettings(DEFAULTS)
  try {
    return normalizeSettings(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return normalizeSettings(DEFAULTS)
  }
}

export function writeSettings(patch: {
  network?: Partial<NetworkSettings>
  providers?: Record<string, { apiKey?: string }>
}): AppSettings {
  const current = readSettings()
  const next: AppSettings = {
    network: { ...current.network, ...(patch.network ?? {}) },
    providers: { ...current.providers },
  }
  if (patch.providers) {
    for (const [id, value] of Object.entries(patch.providers)) {
      const incoming = typeof value?.apiKey === "string" ? value.apiKey : undefined
      if (incoming === undefined || incoming === KEEP_KEY) continue
      if (incoming === "") {
        delete next.providers[id]
      } else {
        next.providers[id] = { apiKey: incoming.trim() }
      }
    }
  }
  const path = settingsFilePath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  const normalized = normalizeSettings(next)
  writeFileSync(tmp, `${JSON.stringify(normalized, null, 2)}\n`, "utf8")
  renameSync(tmp, path)
  return normalized
}

export function maskKey(key: string): string {
  if (!key) return ""
  if (key.length <= 10) return `${key.slice(0, 2)}…${key.slice(-2)}`
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}

export function envKeyFor(provider: string): string | null {
  const info = providerById(provider)
  if (!info?.envVar) return null
  const value = process.env[info.envVar]
  return value && value.trim() ? value.trim() : null
}

export function resolveApiKey(provider: string, settings = readSettings()): string | null {
  const stored = settings.providers[provider]?.apiKey
  if (stored) return stored
  return envKeyFor(provider)
}

export interface ClientProviderState {
  hasKey: boolean
  keyPreview: string | null
  fromEnv: boolean
}

export function settingsForClient(settings = readSettings()) {
  const providers: Record<string, ClientProviderState> = {}
  for (const info of PROVIDERS) {
    const stored = settings.providers[info.id]?.apiKey ?? ""
    const env = envKeyFor(info.id)
    providers[info.id] = {
      hasKey: Boolean(stored || env),
      keyPreview: stored ? maskKey(stored) : env ? maskKey(env) : null,
      fromEnv: !stored && Boolean(env),
    }
  }
  return {
    network: settings.network,
    providers,
    catalog: PROVIDERS,
    settingsPath: settingsFilePath(),
  }
}
