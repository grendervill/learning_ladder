import { useQuery } from "@tanstack/react-query"
import { fetchJson } from "./api"
import type { LessonDetail } from "./types"

export function useLesson(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fetchJson<LessonDetail>(`/api/lessons/${lessonId}`),
    enabled: Boolean(lessonId),
  })
}
