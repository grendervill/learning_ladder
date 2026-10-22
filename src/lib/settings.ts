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
  reasoning: ReasoningLevel
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

export function useProviderModels(provider: string | undefined) {
  return useQuery({
    queryKey: ["settings-models", provider],
    queryFn: () => fetchJson<{ provider: string; models: string[]; error?: string }>(
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
  reasoning?: ReasoningLevel
  apiKey?: string
  baseUrl?: string
}): Promise<MentorTestResult> {
  return fetchJson<MentorTestResult>("/api/settings/test-network", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export const REASONING_LABELS: Record<ReasoningLevel, string> = {
  off: "Выкл",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
}
