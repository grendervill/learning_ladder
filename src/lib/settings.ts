import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"

export type ReasoningLevel = "off" | "low" | "medium" | "high"

export interface ProviderInfo {
  id: string
  label: string
  kind: "opencode" | "openai-compatible" | "anthropic" | "google"
  needsKey: boolean
  envVar?: string
  defaultBaseUrl?: string
  defaultModel: string
  models: string[]
  hint?: string
}

export interface ClientProviderState {
  hasKey: boolean
  keyPreview: string | null
  fromEnv: boolean
}

export interface NetworkSettings {
  provider: string
  model: string
  reasoning: string
  baseUrl: string
}

export interface SettingsResponse {
  network: NetworkSettings
  providers: Record<string, ClientProviderState>
  catalog: ProviderInfo[]
  settingsPath: string
}

export interface CheckResult {
  id: string
  group: string
  label: string
  status: "ok" | "warn" | "fail"
  detail: string
  hint?: string
}

export interface ChecksResponse {
  generatedAt: string
  summary: { ok: number; warn: number; fail: number }
  checks: CheckResult[]
}

export interface MentorPromptResponse {
  prompt: string
  path: string
}

export interface MentorTestResult {
  ok: boolean
  provider: string
  model: string
  ms: number
  reply?: string
  error?: string
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchJson<SettingsResponse>("/api/settings"),
  })
}

export function useChecks(enabled = true) {
  return useQuery({
    queryKey: ["settings-checks"],
    queryFn: () => fetchJson<ChecksResponse>("/api/settings/checks"),
    staleTime: 0,
    refetchOnMount: "always",
    enabled,
  })
}

export function useMentorPrompt() {
  return useQuery({
    queryKey: ["settings-mentor-prompt"],
    queryFn: () => fetchJson<MentorPromptResponse>("/api/settings/mentor-prompt"),
  })
}

export interface ProviderModelsResponse {
  provider: string
  models: string[]
  options: ModelOption[]
  source: "opencode" | "api" | "preset" | "cli"
  error?: string
  fetchedAt: string
}

export interface ReasoningOption {
  id: string
  label: string
}

export interface ModelOption {
  id: string
  label: string
  reasoning: ReasoningOption[]
}

export function useProviderModels(provider: string | undefined) {
  return useQuery({
    queryKey: ["settings-models", provider],
    queryFn: () =>
      fetchJson<ProviderModelsResponse>(
        `/api/settings/models?provider=${encodeURIComponent(provider ?? "")}`,
      ),
    enabled: Boolean(provider),
    staleTime: 60_000,
  })
}

export function saveSettings(payload: {
  network?: Partial<NetworkSettings>
  providers?: Record<string, { apiKey?: string }>
  mentorPrompt?: string
}): Promise<SettingsResponse> {
  return fetchJson<SettingsResponse>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function saveMentorPrompt(mentorPrompt: string): Promise<SettingsResponse> {
  return saveSettings({ mentorPrompt })
}

export function testNetwork(payload: {
  provider?: string
  model?: string
  reasoning?: string
  apiKey?: string
  baseUrl?: string
}): Promise<MentorTestResult> {
  return fetchJson<MentorTestResult>("/api/settings/test-network", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const REASONING_LABELS: Record<string, string> = {
  off: "Выкл",
  none: "Выкл",
  minimal: "Минимальный",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  xhigh: "Очень высокий",
  max: "Максимальный",
}

export function reasoningLabel(id: string): string {
  return REASONING_LABELS[id] ?? id
}
