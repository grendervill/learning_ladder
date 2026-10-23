import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { AccessState } from "./types"

export interface ProgressLesson {
  lessonId: string
  title: string
  status: string
  bestGrade: number | null
  lastGrade: number | null
  attempts: number
  passedAt: string | null
  importedFrom: string | null
  feedback: any | null
}

export interface ProgressChapter {
  chapterId: string
  status: string
  grade: number | null
  bestGrade: number | null
  attempts: number
  passedAt: string | null
  feedback: any | null
}

export interface ProgressAttempt {
  id: number
  scope: string
  scopeId: string
  kind: string
  submittedAt: string
  grade: number
  courseId: string
  courseTitle: string
  itemTitle: string
  feedback: any | null
}

export interface ProgressSession {
  id: string
  startedAt: string
  endedAt: string | null
  status: string
  summaryMd: string | null
  statsJson: string | null
}

export interface ProgressResponse {
  courseId: string
  courseTitle: string
  access: AccessState
  lessons: Record<string, ProgressLesson>
  chapters: Record<string, ProgressChapter>
  attempts: ProgressAttempt[]
  sessions: ProgressSession[]
}

export function useProgress(courseId?: string) {
  return useQuery({
    queryKey: ["progress", courseId ?? "active"],
    queryFn: () =>
      fetchJson<ProgressResponse>(
        `/api/progress${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ""}`,
      ),
    enabled: Boolean(courseId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  })
}
