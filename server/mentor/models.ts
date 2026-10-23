import { spawnSync } from "node:child_process"
import {
  providerById,
  readSettings,
  resolveApiKey,
  type ProviderInfo,
} from "../settings"
import { listOpencodeModels, type OpencodeModelInfo } from "./client"

export type ModelSource = "opencode" | "api" | "preset" | "cli"

export interface ReasoningOption {
  id: string
  label: string
}

export interface ModelOption {
  id: string
  label: string
  reasoning: ReasoningOption[]
}

export interface ModelCatalog {
  provider: string
  models: string[]
  options: ModelOption[]
  source: ModelSource
  error?: string
  fetchedAt: string
}

export interface ModelDiscoveryOptions {
  baseUrl?: string
  apiKey?: string
  fetchImpl?: typeof fetch
  opencodeModels?: () => Promise<OpencodeModelInfo[]>
}

const REASONING_LABELS: Record<string, string> = {
  off: "Выкл",
  none: "Выкл",
  minimal: "Минимальный",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  xhigh: "Очень высокий",
  max: "Максимальный",
}

const OFF: ReasoningOption = { id: "off", label: "Выкл" }

function reasoningLabel(id: string): string {
  return REASONING_LABELS[id] ?? id
}

function reasoningOptions(ids: string[]): ReasoningOption[] {
  const seen = new Set<string>(["off"])
  const options = [OFF]
  for (const id of ids) {
    if (!id || id === "off" || seen.has(id)) continue
    seen.add(id)
    options.push({ id, label: reasoningLabel(id) })
  }
  return options
}

function catalog(
  provider: string,
  options: ModelOption[],
  source: ModelSource,
  error?: string,
): ModelCatalog {
  const deduped: ModelOption[] = []
  const seen = new Set<string>()
  for (const option of options) {
    if (!option.id || seen.has(option.id)) continue
    seen.add(option.id)
    deduped.push(option)
  }
  return {
    provider,
    models: deduped.map((option) => option.id),
    options: deduped,
    source,
    ...(error ? { error } : {}),
    fetchedAt: new Date().toISOString(),
  }
}

function presetCatalog(info: ProviderInfo, error?: string): ModelCatalog {
  return catalog(
    info.id,
    info.models.map((id) => ({
      id,
      label: id,
      reasoning: directReasoning(info.id, id),
    })),
    "preset",
    error,
  )
}

function directReasoning(provider: string, model: string, meta?: any): ReasoningOption[] {
  const ids: string[] = []
  const add = (level: string) => {
    if (!ids.includes(level)) ids.push(level)
  }

  if (provider === "anthropic") {
    const caps = meta?.capabilities
    const effort = caps?.effort
    if (effort && typeof effort === "object" && effort.supported !== false) {
      const supported = Array.isArray(effort.levels) ? effort.levels : []
      for (const level of ["low", "medium", "high", "max"]) {
        if (effort[level] === true || supported.includes(level)) add(level)
      }
    }
    if (ids.length === 0 && (caps?.thinking || /claude-[a-z]+-[5-9]/i.test(model))) {
      add("low")
      add("medium")
      add("high")
    }
  } else if (provider === "google") {
    if (/gemini-(3|4)/i.test(model)) {
      add("low")
      add("high")
    } else if (/gemini-2\.5/i.test(model)) {
      add("low")
      add("medium")
      add("high")
    }
  } else if (provider === "openai") {
    if (/^(o[1-9]|gpt-5|gpt-6)/i.test(model)) {
      add("low")
      add("medium")
      add("high")
    }
  } else if (provider === "deepseek") {
    add("low")
    add("medium")
    add("high")
  } else if (provider === "custom") {
    add("low")
    add("medium")
    add("high")
  }

  return reasoningOptions(ids)
}

function baseFor(info: ProviderInfo, override?: string): string {
  if (override?.trim()) return override.trim().replace(/\/+$/, "")
  if (info.id === "custom") {
    return (readSettings().network.baseUrl ?? "").trim().replace(/\/+$/, "")
  }
  return (info.defaultBaseUrl ?? "").trim().replace(/\/+$/, "")
}

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(10_000)
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function readJson(response: Response): Promise<any> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function directLabel(raw: any, id: string): string {
  for (const key of ["display_name", "displayName", "name", "label"]) {
    if (typeof raw?.[key] === "string" && raw[key].trim()) return raw[key].trim()
  }
  return id
}

async function discoverDirect(
  info: ProviderInfo,
  options: ModelDiscoveryOptions,
): Promise<ModelCatalog> {
  const apiKey = options.apiKey || resolveApiKey(info.id)
  if (!apiKey) {
    return presetCatalog(info, "provider_key_missing")
  }
  const base = baseFor(info, options.baseUrl)
  if (!base) {
    return presetCatalog(info, "provider_url_missing")
  }
  const fetchImpl = options.fetchImpl ?? fetch
  const headers: Record<string, string> = {}
  let url = ""

  if (info.id === "anthropic") {
    url = `${base}/v1/models?limit=1000`
    headers["x-api-key"] = apiKey
    headers["anthropic-version"] = "2023-06-01"
  } else if (info.id === "google") {
    url = `${base}/models`
    headers["x-goog-api-key"] = apiKey
  } else {
    url = `${base}/models`
    headers.authorization = `Bearer ${apiKey}`
  }

  try {
    const response = await fetchImpl(url, { headers, signal: requestSignal() })
    if (!response.ok) throw new Error(`http_${response.status}`)
    const data = await readJson(response)
    const rawModels: any[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : []
    const options: ModelOption[] = []
    for (const raw of rawModels) {
      if (typeof raw === "string") {
        options.push({ id: raw, label: raw, reasoning: directReasoning(info.id, raw) })
        continue
      }
      let id = String(raw?.id ?? raw?.name ?? "").trim()
      if (!id) continue
      if (info.id === "google") {
        id = id.replace(/^models\//, "")
        if (
          Array.isArray(raw.supportedGenerationMethods) &&
          !raw.supportedGenerationMethods.includes("generateContent")
        ) {
          continue
        }
      }
      options.push({
        id,
        label: directLabel(raw, id),
        reasoning: directReasoning(info.id, id, raw),
      })
    }
    if (options.length === 0) {
      return presetCatalog(info, "provider_models_empty")
    }
    return catalog(info.id, options, "api")
  } catch (error) {
    return presetCatalog(info, `provider_models_unavailable: ${errorText(error)}`)
  }
}

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "")
}

function cliOpencodeModels(): string[] {
  const result = spawnSync("opencode", ["models"], {
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 2 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? `opencode_exit_${result.status}`)
  }
  return String(result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => stripAnsi(line).trim())
    .filter((line) => /^[\w.-]+\/[\w.#+-]+$/.test(line))
}

async function discoverOpencode(options: ModelDiscoveryOptions): Promise<ModelCatalog> {
  try {
    const list = await (options.opencodeModels ?? listOpencodeModels)()
    const models = list
      .filter((model) => model.enabled !== false)
      .map((model) => ({
        id: `${model.providerID}/${model.modelID}`,
        label: `${model.name} · ${model.providerID}/${model.modelID}`,
        reasoning: reasoningOptions(
          model.variants.filter((variant) => variant !== "none"),
        ),
      }))
    if (models.length === 0) throw new Error("opencode_models_empty")
    return catalog("opencode", models, "opencode")
  } catch (error) {
    try {
      const ids = cliOpencodeModels()
      if (ids.length === 0) throw new Error("opencode_models_empty")
      const models = ids.map((id) => ({
        id,
        label: id,
        reasoning: reasoningOptions([]),
      }))
      return catalog(
        "opencode",
        models,
        "cli",
        `opencode_variants_unavailable: ${errorText(error)}`,
      )
    } catch (fallbackError) {
      return catalog(
        "opencode",
        [],
        "preset",
        `opencode_models_unavailable: ${errorText(fallbackError)}`,
      )
    }
  }
}

export async function discoverProviderModels(
  provider: string,
  options: ModelDiscoveryOptions = {},
): Promise<ModelCatalog> {
  const info = providerById(provider)
  if (!info) throw new Error("unknown_provider")
  if (provider === "opencode") return discoverOpencode(options)
  return discoverDirect(info, options)
}

export function reasoningLabelFor(id: string): string {
  return reasoningLabel(id)
}
