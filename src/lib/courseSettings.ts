import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { CourseMeta, CourseSettings } from "./types"

export interface CourseSettingsResponse {
  course: CourseMeta
}

export interface CourseChecksResponse {
  checks: Array<{
    id: string
    label: string
    status: "ok" | "warn" | "fail"
    detail: string
    hint?: string
  }>
}

export interface MentorPromptResponse {
  prompt: string
  path?: string
}

export interface ConstructorPromptResponse {
  prompt: string
  path: string
  defaultPrompt?: string
}

export function useCourseSettings(courseId?: string) {
  return useQuery({
    queryKey: ["course-settings", courseId],
    queryFn: () => fetchJson<CourseSettingsResponse>(`/api/courses/${courseId}/settings`),
    enabled: Boolean(courseId),
    staleTime: 0,
    refetchOnMount: "always",
  })
}

export function saveCourseSettings(
  courseId: string,
  payload: {
    title?: string
    description?: string
    theme?: CourseMeta["theme"]
    icon?: CourseMeta["icon"]
    mode?: CourseMeta["mode"]
    settings?: Partial<CourseSettings>
  },
): Promise<CourseSettingsResponse> {
  return fetchJson<CourseSettingsResponse>(`/api/courses/${courseId}/settings`, {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export function useCourseMentorPrompt(courseId?: string) {
  return useQuery({
    queryKey: ["course-mentor-prompt", courseId],
    queryFn: () => fetchJson<MentorPromptResponse>(`/api/courses/${courseId}/mentor-prompt`),
    enabled: Boolean(courseId),
    staleTime: 0,
    refetchOnMount: "always",
  })
}

export function saveCourseMentorPrompt(courseId: string, prompt: string) {
  return fetchJson<{ prompt: string }>(`/api/courses/${courseId}/mentor-prompt`, {
    method: "PUT",
    body: JSON.stringify({ prompt }),
  })
}

export function useCourseChecks(courseId?: string) {
  return useQuery({
    queryKey: ["course-checks", courseId],
    queryFn: () => fetchJson<CourseChecksResponse>(`/api/courses/${courseId}/checks`),
    enabled: Boolean(courseId),
    staleTime: 0,
    refetchOnMount: "always",
  })
}

export function useConstructorPrompt() {
  return useQuery({
    queryKey: ["constructor-prompt"],
    queryFn: () => fetchJson<ConstructorPromptResponse>("/api/constructor-prompt"),
    staleTime: 0,
    refetchOnMount: "always",
  })
}

export function saveConstructorPrompt(prompt: string) {
  return fetchJson<{ prompt: string }>("/api/constructor-prompt", {
    method: "PUT",
    body: JSON.stringify({ prompt }),
  })
}
