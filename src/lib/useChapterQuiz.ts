import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { LessonDetail } from "./types"

export interface ChapterQuizResponse {
  chapterId: string
  courseId: string
  courseTitle: string
  title: string
  description: string
  quiz: NonNullable<LessonDetail["quiz"]>
  answers: Record<string, number | string>
  passed: boolean
  grade: number | null
  feedback: any | null
}

export function useChapterQuiz(chapterId: string | undefined) {
  return useQuery({
    queryKey: ["chapter-quiz", chapterId],
    queryFn: () => fetchJson<ChapterQuizResponse>(`/api/chapters/${chapterId}/quiz`),
    enabled: Boolean(chapterId),
  })
}
