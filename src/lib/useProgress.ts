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
  access: AccessState
  lessons: Record<string, ProgressLesson>
  chapters: Record<string, ProgressChapter>
  attempts: ProgressAttempt[]
  sessions: ProgressSession[]
}

export function useProgress() {
  return useQuery({
    queryKey: ["progress"],
    queryFn: () => fetchJson<ProgressResponse>("/api/progress"),
  })
}
